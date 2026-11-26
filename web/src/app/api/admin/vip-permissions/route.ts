import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { queueDelivery } from "@/server/vip";

export const PATCH = route(async (req) => {
  const admin = await requireAdmin();
  const b = await parseJson(req, z.object({ key: z.string().max(32), enabled: z.boolean() }));
  await prisma.$transaction(async (tx) => {
    await tx.vipPermission.update({ where: { key: b.key }, data: { enabled: b.enabled } });
    await queueDelivery(tx, "CONFIG_RELOAD", null, {});
    await audit({ actorUserId: admin.id, actorType: "ADMIN", action: "vip.feature.toggle", entityType: "vip_permission", entityId: b.key, data: { enabled: b.enabled } }, tx);
  });
  return { ok: true };
});
