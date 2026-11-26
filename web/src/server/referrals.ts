import { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { checkPromo } from "./creators";

const DAY = 86400_000;
const today = () => new Date().toISOString().slice(0, 10);

/** Переход по реферальной ссылке. Один засчитанный клик на IP в сутки. */
export async function trackClick(rawCode: string, ipHash: string) {
  const c = await checkPromo(rawCode, null);
  if (!c.ok) return null;
  await prisma.referralEvent.createMany({
    data: [{ creatorId: c.creatorId, type: "CLICK", code: c.code, ipHash, dedupeKey: `click:${c.codeId}:${ipHash}:${today()}` }],
    skipDuplicates: true,
  });
  return c;
}

/**
 * Привязка нового пользователя к блогеру при регистрации.
 * Анти-фрод: свой код, тот же IP, что у блогера, массовые регистрации с одного IP.
 */
export async function attachReferral(tx: Tx, userId: string, rawCode: string, ipHash: string | null) {
  const c = await checkPromo(rawCode, userId, tx);
  if (!c.ok) return null;
  const creator = await tx.creator.findUniqueOrThrow({ where: { id: c.creatorId }, include: { user: true } });
  let status: "PENDING" | "REJECTED" = "PENDING";
  let rejectReason: string | null = null;
  if (creator.userId === userId) {
    status = "REJECTED"; rejectReason = "self_referral";
  } else if (ipHash && creator.user.registrationIpHash === ipHash) {
    status = "REJECTED"; rejectReason = "same_ip_as_creator";
  } else if (ipHash) {
    const sameIp = await tx.referral.count({
      where: { creatorId: c.creatorId, createdAt: { gte: new Date(Date.now() - DAY) }, referredUser: { registrationIpHash: ipHash } },
    });
    if (sameIp >= 2) { status = "REJECTED"; rejectReason = "ip_abuse"; }
  }
  const ref = await tx.referral.create({ data: { creatorId: c.creatorId, referredUserId: userId, codeUsed: c.code, status, rejectReason } });
  await tx.referralEvent.create({ data: { creatorId: c.creatorId, type: status === "PENDING" ? "REGISTER" : "REJECTED", code: c.code, ipHash, userId } });
  return ref;
}

/** При привязке Minecraft-аккаунта: UUID, ранее привязанный к другому пользователю, не засчитывается. */
export async function onMinecraftLinked(tx: Tx, userId: string, uuid: string) {
  const hist = await tx.minecraftUuidHistory.findUnique({ where: { uuid } });
  if (!hist) {
    await tx.minecraftUuidHistory.create({ data: { uuid, firstUserId: userId } });
    return;
  }
  if (hist.firstUserId !== userId) {
    const ref = await tx.referral.findUnique({ where: { referredUserId: userId } });
    if (ref && ref.status === "PENDING") {
      await tx.referral.update({ where: { id: ref.id }, data: { status: "REJECTED", rejectReason: "reused_minecraft_account" } });
      await tx.referralEvent.create({ data: { creatorId: ref.creatorId, type: "REJECTED", userId } });
    }
  }
}

/** Проверка квалификации приглашённого игрока после обновления игрового времени. */
export async function evaluateReferral(userId: string) {
  const s = await getSettings();
  return prisma.$transaction(async (tx) => {
    const ref = await tx.referral.findUnique({ where: { referredUserId: userId }, include: { creator: true } });
    if (!ref || ref.status !== "PENDING" || ref.creator.status !== "APPROVED") return null;
    const acc = await tx.minecraftAccount.findUnique({ where: { userId } });
    if (!acc || acc.activePlaytimeSeconds < s.activePlayerMinSeconds) return null;
    const upd = await tx.referral.updateMany({ where: { id: ref.id, status: "PENDING" }, data: { status: "QUALIFIED", qualifiedAt: new Date() } });
    if (upd.count === 0) return null;
    await tx.referralEvent.create({ data: { creatorId: ref.creatorId, type: "QUALIFIED", userId } });

    const bonus = ref.creator.activeBonusKopecks ?? s.activePlayerBonusKopecks;
    if (bonus > 0) {
      await tx.commission.create({
        data: {
          creatorId: ref.creatorId, type: "ACTIVE_PLAYER_BONUS", status: "HOLD", amountKopecks: bonus,
          referralId: ref.id, operationKey: `active:${ref.id}`, availableAt: new Date(Date.now() + s.holdDays * DAY),
        },
      });
    }
    const qualified = await tx.referral.count({ where: { creatorId: ref.creatorId, status: "QUALIFIED" } });
    for (const m of s.milestones) {
      if (qualified < m.count || m.bonusKopecks <= 0) continue;
      const key = `milestone:${ref.creatorId}:${m.count}`;
      const exists = await tx.commission.findUnique({ where: { operationKey: key } });
      if (exists) continue;
      await tx.commission.create({
        data: {
          creatorId: ref.creatorId, type: "MILESTONE_BONUS", status: "HOLD", amountKopecks: m.bonusKopecks,
          operationKey: key, availableAt: new Date(Date.now() + s.holdDays * DAY), note: `${m.count} активных игроков`,
        },
      });
    }
    await audit({ actorType: "SYSTEM", action: "referral.qualified", entityType: "referral", entityId: ref.id, data: { creatorId: ref.creatorId, qualified } }, tx);
    return ref.id;
  });
}

export function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}
