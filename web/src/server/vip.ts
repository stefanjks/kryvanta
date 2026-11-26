import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { audit } from "@/lib/audit";

const DAY = 86400_000;

export async function queueDelivery(tx: Tx, type: string, playerUuid: string | null, payload: Prisma.InputJsonValue) {
  await tx.pluginDelivery.create({ data: { type, playerUuid, payload } });
}

type ExtendOpts = { action: string; purchaseId?: string; actorUserId?: string | null; reason?: string };

/** Выдать или продлить VIP. Если подписка активна — срок добавляется к текущей дате окончания. */
export async function extendVip(tx: Tx, minecraftAccountId: string, days: number, opts: ExtendOpts) {
  if (!Number.isInteger(days) || days <= 0 || days > 3650) throw new Error("invalid days");
  // блокируем строку подписки, чтобы параллельные покупки не потеряли продление
  await tx.$executeRaw`SELECT 1 FROM vip_subscriptions WHERE "minecraftAccountId" = ${minecraftAccountId}::uuid FOR UPDATE`;
  const now = new Date();
  const existing = await tx.vipSubscription.findUnique({ where: { minecraftAccountId } });
  const account = await tx.minecraftAccount.findUniqueOrThrow({ where: { id: minecraftAccountId } });

  let prev: Date | null = null;
  let next: Date;
  let sub;
  if (existing) {
    const active = existing.status === "ACTIVE" && existing.expiresAt > now;
    prev = existing.expiresAt;
    const base = active ? existing.expiresAt : now;
    next = new Date(base.getTime() + days * DAY);
    sub = await tx.vipSubscription.update({
      where: { id: existing.id },
      data: { status: "ACTIVE", expiresAt: next, ...(active ? {} : { startedAt: now }) },
    });
  } else {
    next = new Date(now.getTime() + days * DAY);
    sub = await tx.vipSubscription.create({ data: { minecraftAccountId, status: "ACTIVE", startedAt: now, expiresAt: next } });
  }
  await tx.vipGrantHistory.create({
    data: {
      subscriptionId: sub.id,
      action: opts.action,
      days,
      previousExpiresAt: prev,
      newExpiresAt: next,
      purchaseId: opts.purchaseId,
      actorUserId: opts.actorUserId ?? null,
      reason: opts.reason,
    },
  });
  await queueDelivery(tx, "VIP_SYNC", account.uuid, { uuid: account.uuid, expiresAt: next.toISOString() });
  return sub;
}

/** Уменьшить срок (возврат) или полностью снять VIP. days = null — снять полностью. */
export async function reduceVip(tx: Tx, minecraftAccountId: string, days: number | null, opts: ExtendOpts) {
  await tx.$executeRaw`SELECT 1 FROM vip_subscriptions WHERE "minecraftAccountId" = ${minecraftAccountId}::uuid FOR UPDATE`;
  const sub = await tx.vipSubscription.findUnique({ where: { minecraftAccountId }, include: { minecraftAccount: true } });
  if (!sub) return null;
  const now = new Date();
  const prev = sub.expiresAt;
  let next = days === null ? now : new Date(sub.expiresAt.getTime() - days * DAY);
  if (next < now) next = now;
  const ended = next <= now;
  const updated = await tx.vipSubscription.update({
    where: { id: sub.id },
    data: { expiresAt: next, status: ended ? (days === null ? "REVOKED" : "EXPIRED") : sub.status },
  });
  await tx.vipGrantHistory.create({
    data: {
      subscriptionId: sub.id,
      action: opts.action,
      days: days === null ? 0 : -days,
      previousExpiresAt: prev,
      newExpiresAt: next,
      purchaseId: opts.purchaseId,
      actorUserId: opts.actorUserId ?? null,
      reason: opts.reason,
    },
  });
  await queueDelivery(tx, "VIP_SYNC", sub.minecraftAccount.uuid, {
    uuid: sub.minecraftAccount.uuid,
    expiresAt: ended ? null : next.toISOString(),
  });
  return updated;
}

/** Помечает истёкшие подписки. Вызывается планировщиком и при синхронизации с плагином. */
export async function expireDueSubscriptions(now = new Date()) {
  const due = await prisma.vipSubscription.findMany({
    where: { status: "ACTIVE", expiresAt: { lte: now } },
    include: { minecraftAccount: true },
    take: 500,
  });
  for (const s of due) {
    await prisma.$transaction(async (tx) => {
      const r = await tx.vipSubscription.updateMany({ where: { id: s.id, status: "ACTIVE", expiresAt: { lte: now } }, data: { status: "EXPIRED" } });
      if (r.count === 0) return;
      await tx.vipGrantHistory.create({
        data: { subscriptionId: s.id, action: "EXPIRE", days: 0, previousExpiresAt: s.expiresAt, newExpiresAt: s.expiresAt },
      });
      await queueDelivery(tx, "VIP_SYNC", s.minecraftAccount.uuid, { uuid: s.minecraftAccount.uuid, expiresAt: null });
      await audit({ actorType: "SYSTEM", action: "vip.expire", entityType: "vip_subscription", entityId: s.id }, tx);
    });
  }
  return due.length;
}

export async function activeVips(now = new Date()) {
  return prisma.vipSubscription.findMany({
    where: { status: "ACTIVE", expiresAt: { gt: now } },
    select: { expiresAt: true, minecraftAccount: { select: { uuid: true, name: true } } },
  });
}
