import type { PayoutStatus } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { randomUUID } from "node:crypto";

export type Balance = {
  earnedTotal: number; // всё начисленное (кроме отменённого)
  hold: number; // ещё в заморозке
  pendingPayouts: number; // заявки на рассмотрении/одобрены
  paid: number; // выплачено
  available: number; // доступно к выводу
};

/** Перевод начислений из заморозки в доступные, когда срок прошёл. */
export async function releaseHolds(tx: Tx = prisma) {
  const r = await tx.commission.updateMany({ where: { status: "HOLD", availableAt: { lte: new Date() } }, data: { status: "AVAILABLE" } });
  return r.count;
}

export async function creatorBalance(creatorId: string, tx: Tx = prisma): Promise<Balance> {
  const now = new Date();
  const [avail, hold, reserved, paid] = await Promise.all([
    tx.commission.aggregate({ where: { creatorId, OR: [{ status: "AVAILABLE" }, { status: "HOLD", availableAt: { lte: now } }] }, _sum: { amountKopecks: true } }),
    tx.commission.aggregate({ where: { creatorId, status: "HOLD", availableAt: { gt: now } }, _sum: { amountKopecks: true } }),
    tx.payoutRequest.aggregate({ where: { creatorId, status: { in: ["PENDING", "APPROVED"] } }, _sum: { amountKopecks: true } }),
    tx.payoutRequest.aggregate({ where: { creatorId, status: "PAID" }, _sum: { paidAmountKopecks: true } }),
  ]);
  const a = avail._sum.amountKopecks ?? 0;
  const h = hold._sum.amountKopecks ?? 0;
  const r = reserved._sum.amountKopecks ?? 0;
  const p = paid._sum.paidAmountKopecks ?? 0;
  return { earnedTotal: a + h, hold: h, pendingPayouts: r, paid: p, available: a - r - p };
}

async function lockCreator(tx: Tx, creatorId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"payout:" + creatorId}))`;
}

export async function requestPayout(creatorId: string, actorUserId: string, input: { amountKopecks: number; method: string; details: string }) {
  const s = await getSettings();
  return prisma.$transaction(async (tx) => {
    await lockCreator(tx, creatorId);
    const creator = await tx.creator.findUnique({ where: { id: creatorId } });
    if (!creator || creator.status !== "APPROVED") throw conflict("creator_inactive", "Партнёрский аккаунт не активен");
    const open = await tx.payoutRequest.count({ where: { creatorId, status: { in: ["PENDING", "APPROVED"] } } });
    if (open > 0) throw conflict("payout_open", "У вас уже есть необработанная заявка на выплату");
    if (!Number.isInteger(input.amountKopecks) || input.amountKopecks <= 0) throw badRequest("invalid_amount", "Некорректная сумма");
    if (input.amountKopecks < s.minPayoutKopecks) throw badRequest("below_min", "Сумма меньше минимальной");
    const bal = await creatorBalance(creatorId, tx);
    if (input.amountKopecks > bal.available) throw badRequest("insufficient", "Недостаточно средств на балансе");
    const req = await tx.payoutRequest.create({ data: { creatorId, amountKopecks: input.amountKopecks, method: input.method, details: input.details } });
    await tx.payoutHistory.create({ data: { payoutRequestId: req.id, fromStatus: null, toStatus: "PENDING", amountKopecks: req.amountKopecks, actorUserId } });
    await audit({ actorUserId, actorType: "USER", action: "payout.request", entityType: "payout_request", entityId: req.id, data: { amountKopecks: req.amountKopecks } }, tx);
    return req;
  });
}

type Transition =
  | { action: "approve"; amountKopecks?: number; comment?: string }
  | { action: "reject"; comment?: string }
  | { action: "paid"; externalTxnId: string; comment?: string };

const FROM: Record<Transition["action"], PayoutStatus[]> = { approve: ["PENDING"], reject: ["PENDING", "APPROVED"], paid: ["APPROVED"] };
const TO: Record<Transition["action"], PayoutStatus> = { approve: "APPROVED", reject: "REJECTED", paid: "PAID" };

/** Переходы статусов выплаты. Выплаченные и отклонённые заявки неизменяемы (дополнительно защищено триггером БД). */
export async function transitionPayout(id: string, adminId: string, t: Transition) {
  return prisma.$transaction(async (tx) => {
    const req = await tx.payoutRequest.findUnique({ where: { id } });
    if (!req) throw notFound();
    await lockCreator(tx, req.creatorId);
    const cur = await tx.payoutRequest.findUniqueOrThrow({ where: { id } });
    if (!FROM[t.action].includes(cur.status)) throw conflict("invalid_transition", `Нельзя выполнить действие из статуса ${cur.status}`);

    const data: Record<string, unknown> = { status: TO[t.action], adminComment: t.comment ?? cur.adminComment };
    let amount = cur.amountKopecks;
    if (t.action === "approve" && t.amountKopecks !== undefined) {
      if (!Number.isInteger(t.amountKopecks) || t.amountKopecks <= 0 || t.amountKopecks > cur.amountKopecks) {
        throw badRequest("invalid_amount", "Сумма должна быть больше 0 и не больше запрошенной");
      }
      amount = t.amountKopecks;
      data.amountKopecks = amount;
    }
    if (t.action === "paid") {
      const txn = t.externalTxnId.trim();
      if (!txn) throw badRequest("txn_required", "Укажите идентификатор выплаты");
      const dup = await tx.payoutRequest.findUnique({ where: { externalTxnId: txn } });
      if (dup) throw conflict("txn_duplicate", "Этот идентификатор выплаты уже использован");
      data.externalTxnId = txn;
      data.paidAt = new Date();
      data.paidAmountKopecks = amount;
    }
    const r = await tx.payoutRequest.updateMany({ where: { id, status: cur.status }, data });
    if (r.count === 0) throw conflict("concurrent_update", "Заявка изменена параллельно, обновите страницу");
    await tx.payoutHistory.create({
      data: { payoutRequestId: id, fromStatus: cur.status, toStatus: TO[t.action], amountKopecks: amount, externalTxnId: t.action === "paid" ? t.externalTxnId.trim() : null, comment: t.comment, actorUserId: adminId },
    });
    const creator = await tx.creator.findUniqueOrThrow({ where: { id: cur.creatorId } });
    const titles = { approve: "Выплата одобрена", reject: "Выплата отклонена", paid: "Выплата отправлена" } as const;
    await tx.notification.create({ data: { userId: creator.userId, title: titles[t.action], body: t.comment || `Заявка на ${(amount / 100).toFixed(2)} ₽` } });
    await audit({ actorUserId: adminId, actorType: "ADMIN", action: `payout.${t.action}`, entityType: "payout_request", entityId: id, data: { from: cur.status, amountKopecks: amount, comment: t.comment ?? null } }, tx);
    return tx.payoutRequest.findUniqueOrThrow({ where: { id } });
  });
}

/** Финансовая корректировка баланса блогера. Всегда новая запись + журнал, история не переписывается. */
export async function adjustBalance(creatorId: string, adminId: string, amountKopecks: number, note: string) {
  if (!Number.isInteger(amountKopecks) || amountKopecks === 0) throw badRequest("invalid_amount", "Сумма не может быть нулевой");
  if (!note.trim()) throw badRequest("note_required", "Укажите причину корректировки");
  return prisma.$transaction(async (tx) => {
    const c = await tx.commission.create({
      data: { creatorId, type: "ADJUSTMENT", status: "AVAILABLE", amountKopecks, operationKey: `adj:${randomUUID()}`, availableAt: new Date(), note, createdBy: adminId },
    });
    await audit({ actorUserId: adminId, actorType: "ADMIN", action: "commission.adjust", entityType: "creator", entityId: creatorId, data: { amountKopecks, note } }, tx);
    return c;
  });
}
