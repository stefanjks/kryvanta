import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { badRequest } from "@/lib/errors";

const schema = z.object({
  nameRu: z.string().min(2).max(60),
  nameEn: z.string().min(2).max(60),
  tier: z.enum(["COMMON", "RARE", "EPIC", "COSMETIC"]),
  weight: z.number().int().min(0).max(10000),
  enabled: z.boolean(),
  items: z.array(z.object({ material: z.string().regex(/^[A-Z0-9_]{2,64}$/), amount: z.number().int().min(1).max(64 * 9) })).min(1).max(27),
});

/** Создать или изменить набор наград. Материалы — имена Bukkit Material (DIAMOND, IRON_INGOT …). */
export const PUT = route<{ key: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { key } = await params;
  if (!/^[a-z0-9_-]{2,32}$/.test(key)) throw badRequest("invalid_key", "Ключ: a-z, 0-9, _ или -");
  const b = await parseJson(req, schema);
  const r = await prisma.vipReward.upsert({ where: { key }, create: { key, ...b }, update: b });
  await audit({ actorUserId: admin.id, actorType: "ADMIN", action: "reward.upsert", entityType: "vip_reward", entityId: key, data: b });
  return { ok: true, reward: r };
});
