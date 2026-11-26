import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notFound } from "@/lib/errors";
import { queueDelivery } from "@/server/vip";

/** Ручная выдача награды: игрок заберёт её в /viprewards (даже если сейчас не в сети). */
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const b = await parseJson(req, z.object({ player: z.string().trim().min(1).max(120), rewardKey: z.string().max(32), count: z.number().int().min(1).max(10).nullish(), reason: z.string().trim().min(3).max(300) }));
  const acc = await prisma.minecraftAccount.findFirst({ where: { OR: [{ name: { equals: b.player, mode: "insensitive" } }, { user: { username: { equals: b.player, mode: "insensitive" } } }] } });
  if (!acc) throw notFound("player_not_found");
  if (!(await prisma.vipReward.findUnique({ where: { key: b.rewardKey } }))) throw notFound("reward_not_found");
  await prisma.$transaction(async (tx) => {
    await queueDelivery(tx, "REWARD_CREDIT", acc.uuid, { uuid: acc.uuid, rewardKey: b.rewardKey, count: b.count ?? 1, source: "MANUAL" });
    await audit({ actorUserId: admin.id, actorType: "ADMIN", action: "reward.grant", entityType: "minecraft_account", entityId: acc.id, data: { player: acc.name, rewardKey: b.rewardKey, count: b.count ?? 1, reason: b.reason } }, tx);
  });
  return { ok: true };
});
