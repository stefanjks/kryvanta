import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { applyDiscount, commissionFor, parseRub } from "@/lib/money";
import { createOrder, confirmPayment, quote, refundPurchase } from "@/server/orders";
import { expireDueSubscriptions, activeVips, extendVip } from "@/server/vip";
import { makeCreator, makeUser, payOrder } from "./helpers";

const DAY = 86400_000;

describe("денежная математика", () => {
  it("скидка 10% и комиссия 25% от фактически оплаченной суммы", () => {
    const { discountKopecks, amountKopecks } = applyDiscount(19900, 1000);
    expect(discountKopecks).toBe(1990);
    expect(amountKopecks).toBe(17910); // 179,10 ₽
    expect(commissionFor(amountKopecks, 2500)).toBe(4477); // 25% от 179,10 = 44,775 → 44,77 ₽
    expect(commissionFor(19900, 2500)).not.toBe(commissionFor(amountKopecks, 2500));
  });
  it("парсинг рублей", () => {
    expect(parseRub("199")).toBe(19900);
    expect(parseRub("179,10")).toBe(17910);
    expect(() => parseRub("1.234")).toThrow();
  });
});

describe("покупка VIP", () => {
  it("промокод: скидка, привязка к блогеру, комиссия 25%, выдача VIP на 30 дней, уведомление серверу", async () => {
    const { creator, code } = await makeCreator();
    const { user, account } = await makeUser();

    const q = await quote("kryvanta-vip", code, user.id);
    expect(q.amountKopecks).toBe(17910);
    expect(q.promo?.creatorName).toBe(creator.displayName);

    const order = await createOrder(user.id, { productSlug: "kryvanta-vip", code: code.toLowerCase() });
    expect(order.confirmationUrl).toMatch(/^\/pay\/test\//);
    const purchase = await prisma.purchase.findUniqueOrThrow({ where: { id: order.purchaseId } });
    expect(purchase).toMatchObject({ status: "PENDING", amountKopecks: 17910, discountKopecks: 1990, creatorId: creator.id, commissionBps: 2500 });

    // До оплаты — ни комиссии, ни VIP
    expect(await prisma.commission.count({ where: { purchaseId: purchase.id } })).toBe(0);

    const r = await payOrder(purchase.id);
    expect(r.processed).toBe(true);

    const paid = await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(paid.status).toBe("PAID");
    const com = await prisma.commission.findMany({ where: { purchaseId: purchase.id } });
    expect(com).toHaveLength(1);
    expect(com[0]).toMatchObject({ type: "SALE", amountKopecks: 4477, baseKopecks: 17910, rateBps: 2500, status: "HOLD", creatorId: creator.id });

    const sub = await prisma.vipSubscription.findUniqueOrThrow({ where: { minecraftAccountId: account!.id } });
    expect(sub.status).toBe("ACTIVE");
    expect(Math.abs(sub.expiresAt.getTime() - Date.now() - 30 * DAY)).toBeLessThan(60_000);

    const deliveries = await prisma.pluginDelivery.findMany({ where: { playerUuid: account!.uuid } });
    expect(deliveries.map((d) => d.type).sort()).toEqual(["NOTIFY", "VIP_SYNC"]);
    expect((await prisma.creatorCode.findUniqueOrThrow({ where: { code } })).usesCount).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "payment.succeeded", entityId: purchase.id } })).toBe(1);
  });

  it("повторное и параллельное подтверждение одного платежа обрабатывается ровно один раз", async () => {
    const { code } = await makeCreator();
    const { user, account } = await makeUser();
    const order = await createOrder(user.id, { productSlug: "kryvanta-vip", code });
    const payment = await prisma.payment.findFirstOrThrow({ where: { purchaseId: order.purchaseId } });

    const results = await Promise.allSettled(Array.from({ length: 6 }, () => confirmPayment(payment.id, { source: "webhook" })));
    const processed = results.filter((r) => r.status === "fulfilled" && r.value.processed).length;
    expect(processed).toBe(1);
    expect(await prisma.commission.count({ where: { purchaseId: order.purchaseId } })).toBe(1);
    const sub = await prisma.vipSubscription.findUniqueOrThrow({ where: { minecraftAccountId: account!.id }, include: { history: true } });
    expect(sub.history).toHaveLength(1);
    expect(Math.abs(sub.expiresAt.getTime() - Date.now() - 30 * DAY)).toBeLessThan(60_000);

    const again = await confirmPayment(payment.id, { source: "webhook" });
    expect(again.processed).toBe(false);
  });

  it("сумма от провайдера, не совпадающая с заказом, отклоняется", async () => {
    const { user } = await makeUser();
    const order = await createOrder(user.id, { productSlug: "kryvanta-vip" });
    const payment = await prisma.payment.findFirstOrThrow({ where: { purchaseId: order.purchaseId } });
    await expect(confirmPayment(payment.id, { source: "webhook", providerAmountKopecks: 100 })).rejects.toThrow();
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");
  });

  it("саморефералы запрещены: блогер не может применить свой код", async () => {
    const { user, code } = await makeCreator();
    const q = await quote("kryvanta-vip", code, user.id);
    expect(q.promoError).toBe("self");
    expect(q.amountKopecks).toBe(19900);
    await expect(createOrder(user.id, { productSlug: "kryvanta-vip", code })).rejects.toMatchObject({ code: "promo_self" });
  });

  it("промокод: лимит, срок действия, отключение, одно использование на аккаунт", async () => {
    const { code } = await makeCreator();
    const { user } = await makeUser();
    const o = await createOrder(user.id, { productSlug: "kryvanta-vip", code });
    await payOrder(o.purchaseId);
    expect((await quote("kryvanta-vip", code, user.id)).promoError).toBe("already_used");

    await prisma.creatorCode.update({ where: { code }, data: { maxUses: 1 } });
    const { user: u2 } = await makeUser();
    expect((await quote("kryvanta-vip", code, u2.id)).promoError).toBe("limit");
    await prisma.creatorCode.update({ where: { code }, data: { maxUses: null, expiresAt: new Date(Date.now() - 1000) } });
    expect((await quote("kryvanta-vip", code, u2.id)).promoError).toBe("expired");
    await prisma.creatorCode.update({ where: { code }, data: { expiresAt: null, active: false } });
    expect((await quote("kryvanta-vip", code, u2.id)).promoError).toBe("inactive");
  });

  it("без привязанного Minecraft-аккаунта купить VIP нельзя", async () => {
    const { user } = await makeUser({ linked: false });
    await expect(createOrder(user.id, { productSlug: "kryvanta-vip" })).rejects.toMatchObject({ code: "minecraft_not_linked" });
  });

  it("продление: второй VIP добавляет 30 дней к текущему сроку", async () => {
    const { user, account } = await makeUser();
    const o1 = await createOrder(user.id, { productSlug: "kryvanta-vip" });
    await payOrder(o1.purchaseId);
    const first = await prisma.vipSubscription.findUniqueOrThrow({ where: { minecraftAccountId: account!.id } });
    const o2 = await createOrder(user.id, { productSlug: "kryvanta-vip" });
    await payOrder(o2.purchaseId);
    const second = await prisma.vipSubscription.findUniqueOrThrow({ where: { minecraftAccountId: account!.id } });
    expect(second.expiresAt.getTime() - first.expiresAt.getTime()).toBe(30 * DAY);
  });

  it("окончание VIP через 30 дней: статус EXPIRED и команда серверу снять группу", async () => {
    const { account } = await makeUser();
    await prisma.$transaction((tx) => extendVip(tx, account!.id, 30, { action: "MANUAL_GRANT" }));
    expect((await activeVips()).some((v) => v.minecraftAccount.uuid === account!.uuid)).toBe(true);

    // «перематываем» время на 30 дней + 1 минута
    const future = new Date(Date.now() + 30 * DAY + 60_000);
    await expireDueSubscriptions(future);
    const sub = await prisma.vipSubscription.findUniqueOrThrow({ where: { minecraftAccountId: account!.id } });
    expect(sub.status).toBe("EXPIRED");
    const last = await prisma.pluginDelivery.findFirstOrThrow({ where: { playerUuid: account!.uuid, type: "VIP_SYNC" }, orderBy: { createdAt: "desc" } });
    expect((last.payload as { expiresAt: string | null }).expiresAt).toBeNull();
    expect((await activeVips(future)).some((v) => v.minecraftAccount.uuid === account!.uuid)).toBe(false);
  });

  it("подарок VIP другому игроку", async () => {
    const { user } = await makeUser();
    const { account: friend } = await makeUser();
    const o = await createOrder(user.id, { productSlug: "kryvanta-vip-gift", giftTo: friend!.name });
    await payOrder(o.purchaseId);
    const sub = await prisma.vipSubscription.findUniqueOrThrow({ where: { minecraftAccountId: friend!.id }, include: { history: true } });
    expect(sub.history[0].action).toBe("GIFT");
  });

  it("возврат отменяет комиссию и уменьшает срок VIP", async () => {
    const { code } = await makeCreator();
    const { user, account } = await makeUser();
    const o = await createOrder(user.id, { productSlug: "kryvanta-vip", code });
    await payOrder(o.purchaseId);
    await refundPurchase(o.purchaseId, { source: "admin", reason: "test refund" });
    const c = await prisma.commission.findFirstOrThrow({ where: { purchaseId: o.purchaseId } });
    expect(c.status).toBe("CANCELLED");
    const sub = await prisma.vipSubscription.findUniqueOrThrow({ where: { minecraftAccountId: account!.id } });
    expect(sub.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    expect(sub.status).toBe("EXPIRED");
    const again = await refundPurchase(o.purchaseId, { source: "admin" });
    expect(again.processed).toBe(false);
  });

  it("БД запрещает менять сумму комиссии и удалять журнал", async () => {
    const c = await prisma.commission.findFirstOrThrow();
    await expect(prisma.commission.update({ where: { id: c.id }, data: { amountKopecks: c.amountKopecks + 1 } })).rejects.toThrow(/immutable/);
    const log = await prisma.auditLog.findFirstOrThrow();
    await expect(prisma.auditLog.delete({ where: { id: log.id } })).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.update({ where: { id: log.id }, data: { action: "x" } })).rejects.toThrow(/append-only/);
  });

  it("несуществующий платёж", async () => {
    await expect(confirmPayment(randomUUID(), { source: "test" })).rejects.toMatchObject({ status: 404 });
  });
});
