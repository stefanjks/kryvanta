import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notFound, badRequest } from "@/lib/errors";
import { extendVip, reduceVip } from "@/server/vip";

const schema = z.object({
  action: z.enum(["grant", "revoke", "reduce"]),
  player: z.string().trim().min(1).max(120),
  days: z.number().int().min(1).max(3650).nullish(),
  reason: z.string().trim().min(3).max(300),
});

/** Ручная выдача/продление (grant), сокращение (reduce) и снятие (revoke) VIP. */
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const b = await parseJson(req, schema);
  const acc = await prisma.minecraftAccount.findFirst({
    where: { OR: [{ name: { equals: b.player, mode: "insensitive" } }, { user: { username: { equals: b.player, mode: "insensitive" } } }, { user: { email: b.player.toLowerCase() } }] },
  });
  if (!acc) throw notFound("player_not_found");
  await prisma.$transaction(async (tx) => {
    if (b.action === "grant") {
      if (!b.days) throw badRequest("days_required", "Укажите количество дней");
      await extendVip(tx, acc.id, b.days, { action: "MANUAL_GRANT", actorUserId: admin.id, reason: b.reason });
    } else if (b.action === "reduce") {
      if (!b.days) throw badRequest("days_required", "Укажите количество дней");
      await reduceVip(tx, acc.id, b.days, { action: "MANUAL_REDUCE", actorUserId: admin.id, reason: b.reason });
    } else {
      await reduceVip(tx, acc.id, null, { action: "REVOKE", actorUserId: admin.id, reason: b.reason });
    }
    await audit({ actorUserId: admin.id, actorType: "ADMIN", action: `vip.${b.action}`, entityType: "minecraft_account", entityId: acc.id, data: { player: acc.name, days: b.days ?? null, reason: b.reason } }, tx);
  });
  return { ok: true };
});
