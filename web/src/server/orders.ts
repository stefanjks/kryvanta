import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma, type Tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { applyDiscount, commissionFor, formatRub } from "@/lib/money";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { env } from "@/lib/env";
import { checkPromo, effectiveCommissionBps, recomputeTier } from "./creators";
import { extendVip, queueDelivery, reduceVip } from "./vip";
import { activeAdapter } from "./payments";

const DAY = 86400_000;

export const PROMO_REASONS: Record<string, string> = {
  not_found: "Промокод не найден",
  inactive: "Промокод отключён",
  expired: "Срок действия промокода истёк",
  limit: "Лимит использований промокода исчерпан",
  self: "Нельзя использовать собственный промокод",
  already_used: "Вы уже использовали этот промокод",
  creator_inactive: "Партнёр не активен",
};

export async function quote(productSlug: string, code: string | null | undefined, userId: string | null) {
  const product = await prisma.product.findUnique({ where: { slug: productSlug } });
  if (!product || !product.active) throw notFound("product_not_found");
  let discountBps = 0;
  let promo: { code: string; creatorName: string } | null = null;
  let promoError: string | null = null;
  if (code && code.trim()) {
    const c = await checkPromo(code, userId);
    if (c.ok) {
      discountBps = c.discountBps;
      promo = { code: c.code, creatorName: c.creatorName };
    } else promoError = c.reason;
  }
  const { discountKopecks, amountKopecks } = applyDiscount(product.priceKopecks, discountBps);
  return { product, basePriceKopecks: product.priceKopecks, discountBps, discountKopecks, amountKopecks, promo, promoError };
}

type CreateOrderInput = { productSlug: string; code?: string | null; giftTo?: string | null };

/** Создаёт заказ (PENDING) и платёж у выбранного провайдера. Привязка к блогеру сохраняется в заказе. */
export async function createOrder(userId: string, input: CreateOrderInput) {
  const product = await prisma.product.findUnique({ where: { slug: input.productSlug } });
  if (!product || !product.active) throw notFound("product_not_found");

  const buyer = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { minecraftAccount: true } });

  // Получатель: для подарка — другой зарегистрированный игрок с привязанным Minecraft-аккаунтом.
  let recipient = buyer.minecraftAccount;
  if (product.type === "VIP_GIFT") {
    const target = (input.giftTo || "").trim();
    if (!target) throw badRequest("gift_recipient_required", "Укажите ник получателя");
    recipient = await prisma.minecraftAccount.findFirst({
      where: { OR: [{ name: { equals: target, mode: "insensitive" } }, { user: { username: { equals: target, mode: "insensitive" } } }] },
    });
    if (!recipient) throw badRequest("gift_recipient_not_found", "Получатель должен быть зарегистрирован на сайте и привязать Minecraft-аккаунт");
  }
  if (!recipient) throw badRequest("minecraft_not_linked", "Сначала привяжите Minecraft-аккаунт в личном кабинете");

  const pendingRecent = await prisma.purchase.count({ where: { userId, status: "PENDING", createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  if (pendingRecent >= 5) throw conflict("too_many_pending", "Слишком много неоплаченных заказов. Оплатите или отмените предыдущие.");

  const s = await getSettings();
  let discountBps = 0;
  let creatorCodeId: string | null = null;
  let creatorId: string | null = null;
  let commissionBps: number | null = null;
  if (input.code && input.code.trim()) {
    const c = await checkPromo(input.code, userId);
    if (!c.ok) throw badRequest("promo_" + c.reason, PROMO_REASONS[c.reason]);
    discountBps = c.discountBps;
    creatorCodeId = c.codeId;
    creatorId = c.creatorId;
    const creator = await prisma.creator.findUniqueOrThrow({ where: { id: c.creatorId } });
    commissionBps = effectiveCommissionBps(creator, s);
  }
  const { discountKopecks, amountKopecks } = applyDiscount(product.priceKopecks, discountBps);
  if (amountKopecks <= 0) throw badRequest("invalid_amount", "Сумма заказа должна быть больше нуля");

  const adapter = activeAdapter();
  const { purchase, payment } = await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({
      data: {
        userId,
        productId: product.id,
        recipientUuid: recipient!.uuid,
        recipientName: recipient!.name,
        basePriceKopecks: product.priceKopecks,
        discountKopecks,
        amountKopecks,
        creatorCodeId,
        creatorId,
        commissionBps,
        durationDays: product.durationDays,
      },
    });
    const payment = await tx.payment.create({
      data: { purchaseId: purchase.id, provider: adapter.id, idempotencyKey: randomUUID(), amountKopecks },
    });
    await audit({ actorUserId: userId, actorType: "USER", action: "order.create", entityType: "purchase", entityId: purchase.id, data: { product: product.slug, amountKopecks, code: input.code ?? null } }, tx);
    return { purchase, payment };
  });

  try {
    const res = await adapter.createPayment({
      paymentId: payment.id,
      purchaseId: purchase.id,
      amountKopecks,
      description: `KRYVANTA заказ #${purchase.orderNumber}: ${product.nameRu}`,
      idempotencyKey: payment.idempotencyKey,
      returnUrl: `${env.appUrl}/orders/${purchase.id}`,
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerPaymentId: res.providerPaymentId, confirmationUrl: res.confirmationUrl },
    });
    return { purchaseId: purchase.id, orderNumber: purchase.orderNumber, confirmationUrl: res.confirmationUrl, provider: adapter.id };
  } catch (e) {
    await prisma.$transaction([
      prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } }),
      prisma.purchase.update({ where: { id: purchase.id }, data: { status: "FAILED" } }),
    ]);
    console.error("[payments] create failed", e);
    throw conflict("payment_provider_error", "Платёжный провайдер недоступен. Попробуйте позже.");
  }
}

type ConfirmMeta = { source: "webhook" | "admin" | "test"; actorUserId?: string | null; providerAmountKopecks?: number };

/**
 * Идемпотентное подтверждение оплаты. Повторный вызов для того же платежа ничего не делает.
 * В одной транзакции: платёж → покупка → комиссия блогеру → VIP/выдача → уведомления → журнал.
 */
export async function confirmPayment(paymentId: string, meta: ConfirmMeta) {
  const run = () =>
    prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { purchase: { include: { product: true } } } });
      if (!payment) throw notFound("payment_not_found");
      if (meta.providerAmountKopecks !== undefined && meta.providerAmountKopecks !== payment.amountKopecks) {
        await audit({ actorType: "PAYMENT", action: "payment.amount_mismatch", entityType: "payment", entityId: payment.id, data: { expected: payment.amountKopecks, got: meta.providerAmountKopecks } }, tx);
        throw conflict("amount_mismatch", "Сумма платежа не совпадает с заказом");
      }
      // Ключевая защита от двойной обработки: условное обновление статуса.
      const upd = await tx.payment.updateMany({ where: { id: paymentId, status: "PENDING" }, data: { status: "SUCCEEDED" } });
      if (upd.count === 0) return { processed: false as const, purchaseId: payment.purchaseId };

      const now = new Date();
      const p = payment.purchase;
      const pu = await tx.purchase.updateMany({ where: { id: p.id, status: { in: ["PENDING", "CANCELLED", "FAILED"] } }, data: { status: "PAID", paidAt: now } });
      if (pu.count === 0) throw conflict("purchase_state", "Покупка уже обработана");

      // Комиссия блогеру — только при подтверждённой оплате, от фактически оплаченной суммы.
      if (p.creatorId && p.commissionBps !== null) {
        const creator = await tx.creator.findUnique({ where: { id: p.creatorId } });
        if (creator && creator.userId !== p.userId) {
          const s = await getSettings(tx);
          const amount = commissionFor(p.amountKopecks, p.commissionBps);
          if (amount > 0) {
            await tx.commission.create({
              data: {
                creatorId: creator.id,
                type: "SALE",
                status: "HOLD",
                amountKopecks: amount,
                baseKopecks: p.amountKopecks,
                rateBps: p.commissionBps,
                purchaseId: p.id,
                operationKey: `sale:${p.id}`,
                availableAt: new Date(now.getTime() + s.holdDays * DAY),
              },
            });
          }
          await tx.referralEvent.create({ data: { creatorId: creator.id, type: "PURCHASE", code: null, userId: p.userId } });
        } else if (creator) {
          await audit({ actorType: "SYSTEM", action: "commission.self_referral_blocked", entityType: "purchase", entityId: p.id }, tx);
        }
        if (p.creatorCodeId) await tx.creatorCode.update({ where: { id: p.creatorCodeId }, data: { usesCount: { increment: 1 } } });
      }

      await fulfill(tx, p);

      await tx.notification.create({
        data: { userId: p.userId, title: "Оплата получена", body: `Заказ #${p.orderNumber} (${p.product.nameRu}) оплачен: ${formatRub(p.amountKopecks)}.` },
      });
      await audit({ actorUserId: meta.actorUserId ?? null, actorType: meta.source === "admin" ? "ADMIN" : "PAYMENT", action: "payment.succeeded", entityType: "purchase", entityId: p.id, data: { paymentId, source: meta.source, amountKopecks: p.amountKopecks } }, tx);
      return { processed: true as const, purchaseId: p.id, creatorId: p.creatorId };
    });

  // Повтор при конфликте сериализации/уникальности (параллельные вебхуки)
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await run();
      if (r.processed && "creatorId" in r && r.creatorId) await recomputeTier(r.creatorId).catch(() => {});
      return r;
    } catch (e) {
      const retryable = e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2034" || e.code === "P2002");
      if (!retryable || attempt >= 2) throw e;
    }
  }
}

async function fulfill(tx: Tx, p: Prisma.PurchaseGetPayload<{ include: { product: true } }>) {
  const product = p.product;
  const account = await tx.minecraftAccount.findUnique({ where: { uuid: p.recipientUuid } });
  switch (product.type) {
    case "VIP":
    case "VIP_GIFT": {
      if (!account) throw conflict("recipient_missing", "Аккаунт получателя не найден");
      const days = p.durationDays ?? product.durationDays ?? 30;
      await extendVip(tx, account.id, days, { action: product.type === "VIP_GIFT" ? "GIFT" : "PURCHASE", purchaseId: p.id });
      await queueDelivery(tx, "NOTIFY", p.recipientUuid, {
        uuid: p.recipientUuid,
        message: product.type === "VIP_GIFT" ? `<gold>✦ Вам подарили KRYVANTA VIP на ${days} дн.!` : `<gold>✦ KRYVANTA VIP активирован на ${days} дн. Спасибо за поддержку!`,
      });
      if (product.type === "VIP_GIFT" && account.userId !== p.userId) {
        await tx.notification.create({ data: { userId: account.userId, title: "Вам подарили VIP", body: `KRYVANTA VIP на ${days} дн. уже активирован.` } });
      }
      break;
    }
    case "REWARD_KIT": {
      const key = String((product.payload as { rewardKey?: string })?.rewardKey ?? "");
      if (!key) throw conflict("product_misconfigured", "Не указан набор");
      await queueDelivery(tx, "REWARD_CREDIT", p.recipientUuid, { uuid: p.recipientUuid, rewardKey: key, count: 1, source: "PURCHASE", purchaseId: p.id });
      await queueDelivery(tx, "NOTIFY", p.recipientUuid, { uuid: p.recipientUuid, message: `<gold>✦ Покупка «${product.nameRu}» доступна в /viprewards` });
      break;
    }
    case "COMMANDS": {
      const cmds = ((product.payload as { commands?: string[] })?.commands ?? []).map((c) =>
        c.replaceAll("{player}", p.recipientName).replaceAll("{uuid}", p.recipientUuid),
      );
      await queueDelivery(tx, "COMMANDS", p.recipientUuid, { uuid: p.recipientUuid, commands: cmds, purchaseId: p.id });
      break;
    }
  }
}

/** Возврат: покупка → REFUNDED, комиссии отменяются, срок VIP уменьшается. Повторный вызов безопасен. */
export async function refundPurchase(purchaseId: string, meta: { source: "webhook" | "admin"; actorUserId?: string | null; reason?: string }) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.purchase.findUnique({ where: { id: purchaseId }, include: { product: true } });
    if (!p) throw notFound();
    const r = await tx.purchase.updateMany({ where: { id: purchaseId, status: "PAID" }, data: { status: "REFUNDED", refundedAt: new Date() } });
    if (r.count === 0) return { processed: false };
    await tx.payment.updateMany({ where: { purchaseId, status: "SUCCEEDED" }, data: { status: "REFUNDED" } });
    const cancelled = await tx.commission.updateMany({
      where: { purchaseId, status: { in: ["HOLD", "AVAILABLE"] } },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: meta.reason || "refund" },
    });
    if ((p.product.type === "VIP" || p.product.type === "VIP_GIFT") && p.durationDays) {
      const acc = await tx.minecraftAccount.findUnique({ where: { uuid: p.recipientUuid } });
      if (acc) await reduceVip(tx, acc.id, p.durationDays, { action: "REFUND", purchaseId, actorUserId: meta.actorUserId, reason: meta.reason });
    }
    await tx.notification.create({ data: { userId: p.userId, title: "Возврат", body: `Заказ #${p.orderNumber} возвращён.` } });
    await audit({ actorUserId: meta.actorUserId ?? null, actorType: meta.source === "admin" ? "ADMIN" : "PAYMENT", action: "purchase.refund", entityType: "purchase", entityId: purchaseId, data: { reason: meta.reason ?? null, commissionsCancelled: cancelled.count } }, tx);
    return { processed: true };
  });
}

export async function cancelPendingOrder(purchaseId: string, userId: string | null, meta: { source: "user" | "webhook" | "admin" }) {
  return prisma.$transaction(async (tx) => {
    const p = await tx.purchase.findUnique({ where: { id: purchaseId } });
    if (!p || (userId && p.userId !== userId && meta.source === "user")) throw notFound();
    const r = await tx.purchase.updateMany({ where: { id: purchaseId, status: "PENDING" }, data: { status: "CANCELLED" } });
    await tx.payment.updateMany({ where: { purchaseId, status: "PENDING" }, data: { status: "CANCELLED" } });
    if (r.count) await audit({ actorUserId: userId, actorType: meta.source === "admin" ? "ADMIN" : meta.source === "user" ? "USER" : "PAYMENT", action: "order.cancel", entityType: "purchase", entityId: purchaseId }, tx);
    return { processed: r.count > 0 };
  });
}

/** Регистрация события провайдера: true — событие новое, false — уже обрабатывалось. */
export async function registerPaymentEvent(provider: string, eventKey: string, payload: Prisma.InputJsonValue) {
  try {
    await prisma.paymentEvent.create({ data: { provider, eventKey, payload } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}
