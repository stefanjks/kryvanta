import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const schema = z.object({
  discountBps: z.number().int().min(0).max(9000).optional(),
  maxUses: z.number().int().min(1).nullable().optional(),
  expiresAt: z.iso.datetime().nullable().optional(),
  active: z.boolean().optional(),
  onePerUser: z.boolean().optional(),
});

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const b = await parseJson(req, schema);
  const row = await prisma.creatorCode.update({
    where: { id },
    data: { ...b, expiresAt: b.expiresAt === undefined ? undefined : b.expiresAt ? new Date(b.expiresAt) : null },
  });
  await audit({ actorUserId: admin.id, actorType: "ADMIN", action: "code.update", entityType: "creator_code", entityId: id, data: b });
  return { ok: true, code: row };
});
