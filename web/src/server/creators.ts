import type { Creator, CreatorTier } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { getSettings, type Settings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { randomBytes } from "node:crypto";

export const CODE_RE = /^[A-Z0-9_-]{3,24}$/;
export const normalizeCode = (c: string) => c.trim().toUpperCase();

export function effectiveCommissionBps(creator: Pick<Creator, "commissionBps" | "tier">, s: Settings) {
  if (creator.commissionBps !== null && creator.commissionBps !== undefined) return creator.commissionBps;
  return Math.min(9000, s.commissionBps + (s.tierBonusBps[creator.tier] ?? 0));
}

export type PromoCheck =
  | { ok: true; codeId: string; code: string; creatorId: string; creatorName: string; discountBps: number }
  | { ok: false; reason: "not_found" | "inactive" | "expired" | "limit" | "self" | "already_used" | "creator_inactive" };

/** Проверка промокода. userId — покупатель (для защиты от саморефералов и повторного использования). */
export async function checkPromo(rawCode: string, userId: string | null, tx: Tx = prisma): Promise<PromoCheck> {
  const code = normalizeCode(rawCode);
  if (!CODE_RE.test(code)) return { ok: false, reason: "not_found" };
  const row = await tx.creatorCode.findUnique({ where: { code }, include: { creator: true } });
  if (!row) return { ok: false, reason: "not_found" };
  if (!row.active) return { ok: false, reason: "inactive" };
  if (row.creator.status !== "APPROVED") return { ok: false, reason: "creator_inactive" };
  if (row.expiresAt && row.expiresAt < new Date()) return { ok: false, reason: "expired" };
  if (row.maxUses !== null && row.usesCount >= row.maxUses) return { ok: false, reason: "limit" };
  if (userId) {
    if (row.creator.userId === userId) return { ok: false, reason: "self" };
    if (row.onePerUser) {
      const used = await tx.purchase.count({ where: { userId, creatorCodeId: row.id, status: "PAID" } });
      if (used > 0) return { ok: false, reason: "already_used" };
    }
  }
  return { ok: true, codeId: row.id, code: row.code, creatorId: row.creatorId, creatorName: row.creator.displayName, discountBps: row.discountBps };
}

function codeFromName(name: string) {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14) || "KRY";
  return base.length >= 3 ? base : base + "KRY";
}

export async function uniqueCode(tx: Tx, preferred: string) {
  let c = normalizeCode(preferred);
  if (!CODE_RE.test(c)) c = codeFromName(preferred);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? c : `${c.slice(0, 18)}${randomBytes(2).readUInt16BE() % 1000}`;
    const exists = await tx.creatorCode.findUnique({ where: { code: candidate } });
    if (!exists) return candidate;
  }
  throw conflict("code_taken", "Не удалось подобрать уникальный промокод");
}

export async function submitApplication(userId: string, data: { displayName: string; platform: string; channelUrl: string; audience: number; message: string }) {
  const existingCreator = await prisma.creator.findUnique({ where: { userId } });
  if (existingCreator) throw conflict("already_creator", "Вы уже участник программы");
  const pending = await prisma.creatorApplication.findFirst({ where: { userId, status: "PENDING" } });
  if (pending) throw conflict("application_pending", "Заявка уже на рассмотрении");
  const app = await prisma.creatorApplication.create({ data: { userId, ...data } });
  await audit({ actorUserId: userId, actorType: "USER", action: "creator.apply", entityType: "creator_application", entityId: app.id });
  return app;
}

export async function createCreator(
  tx: Tx,
  input: { userId: string; displayName: string; socials: Record<string, string>; code?: string; commissionBps?: number | null; actorUserId: string },
) {
  const user = await tx.user.findUnique({ where: { id: input.userId } });
  if (!user) throw notFound("user_not_found");
  const exists = await tx.creator.findUnique({ where: { userId: input.userId } });
  if (exists) throw conflict("already_creator", "Пользователь уже является блогером");
  const s = await getSettings(tx);
  const creator = await tx.creator.create({
    data: { userId: input.userId, displayName: input.displayName, socials: input.socials, status: "APPROVED", commissionBps: input.commissionBps ?? null },
  });
  const code = await uniqueCode(tx, input.code || input.displayName);
  await tx.creatorCode.create({ data: { code, creatorId: creator.id, discountBps: s.discountBps } });
  if (user.role === "PLAYER") await tx.user.update({ where: { id: user.id }, data: { role: "CREATOR" } });
  await audit({ actorUserId: input.actorUserId, actorType: "ADMIN", action: "creator.create", entityType: "creator", entityId: creator.id, data: { code } }, tx);
  return { creator, code };
}

export async function approveApplication(appId: string, adminId: string, opts: { code?: string; note?: string }) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.creatorApplication.findUnique({ where: { id: appId } });
    if (!app) throw notFound();
    const r = await tx.creatorApplication.updateMany({
      where: { id: appId, status: "PENDING" },
      data: { status: "APPROVED", reviewedBy: adminId, reviewedAt: new Date(), reviewNote: opts.note },
    });
    if (r.count === 0) throw conflict("not_pending", "Заявка уже обработана");
    const res = await createCreator(tx, {
      userId: app.userId,
      displayName: app.displayName,
      socials: { [app.platform]: app.channelUrl },
      code: opts.code,
      actorUserId: adminId,
    });
    await tx.notification.create({
      data: { userId: app.userId, title: "Заявка одобрена", body: `Добро пожаловать в KRYVANTA CREATOR PROGRAM! Ваш промокод: ${res.code}` },
    });
    await audit({ actorUserId: adminId, actorType: "ADMIN", action: "creator.application.approve", entityType: "creator_application", entityId: appId }, tx);
    return res;
  });
}

export async function rejectApplication(appId: string, adminId: string, note?: string) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.creatorApplication.findUnique({ where: { id: appId } });
    if (!app) throw notFound();
    const r = await tx.creatorApplication.updateMany({
      where: { id: appId, status: "PENDING" },
      data: { status: "REJECTED", reviewedBy: adminId, reviewedAt: new Date(), reviewNote: note },
    });
    if (r.count === 0) throw conflict("not_pending", "Заявка уже обработана");
    await tx.notification.create({ data: { userId: app.userId, title: "Заявка отклонена", body: note || "К сожалению, заявка в Creator Program отклонена." } });
    await audit({ actorUserId: adminId, actorType: "ADMIN", action: "creator.application.reject", entityType: "creator_application", entityId: appId, data: { note: note ?? null } }, tx);
  });
}

const monthStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

export function tierFor(monthSalesKopecks: number, s: Settings): CreatorTier {
  const t = s.tierThresholds;
  if (monthSalesKopecks >= t.DIAMOND) return "DIAMOND";
  if (monthSalesKopecks >= t.GOLD) return "GOLD";
  if (monthSalesKopecks >= t.SILVER) return "SILVER";
  return "BRONZE";
}

/**
 * Уровень рассчитывается по сумме подтверждённых продаж за календарный месяц:
 * берётся лучший результат из прошлого и текущего месяца (чтобы уровень не обнулялся 1-го числа).
 */
export async function recomputeTier(creatorId: string, tx: Tx = prisma) {
  const s = await getSettings(tx);
  const cur = monthStart();
  const prev = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() - 1, 1));
  const [a, b] = await Promise.all([
    tx.purchase.aggregate({ where: { creatorId, status: "PAID", paidAt: { gte: cur } }, _sum: { amountKopecks: true } }),
    tx.purchase.aggregate({ where: { creatorId, status: "PAID", paidAt: { gte: prev, lt: cur } }, _sum: { amountKopecks: true } }),
  ]);
  const tier = tierFor(Math.max(a._sum.amountKopecks ?? 0, b._sum.amountKopecks ?? 0), s);
  await tx.creator.update({ where: { id: creatorId }, data: { tier } });
  return tier;
}
