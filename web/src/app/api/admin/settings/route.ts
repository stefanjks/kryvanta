import { route, parseJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getSettings, saveSettings, settingsSchema } from "@/lib/settings";
import { queueDelivery } from "@/server/vip";

export const GET = route(async () => {
  await requireAdmin();
  return getSettings();
});

export const PUT = route(async (req) => {
  const admin = await requireAdmin();
  const b = await parseJson(req, settingsSchema.partial());
  const cur = await getSettings();
  const next = { ...cur, ...b, vip: { ...cur.vip, ...(b.vip ?? {}) } };
  await prisma.$transaction(async (tx) => {
    await saveSettings(next, admin.id, tx);
    await queueDelivery(tx, "CONFIG_RELOAD", null, {});
    await audit({ actorUserId: admin.id, actorType: "ADMIN", action: "settings.update", entityType: "settings", entityId: "main", data: { before: cur, after: next } }, tx);
  });
  return { ok: true };
});
