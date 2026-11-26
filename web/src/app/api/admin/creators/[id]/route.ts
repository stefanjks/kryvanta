import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notFound } from "@/lib/errors";

const schema = z.object({
  displayName: z.string().trim().min(2).max(40).optional(),
  avatarUrl: z.url().max(300).refine((u) => u.startsWith("https://"), "https only").nullish(),
  status: z.enum(["APPROVED", "BLOCKED"]).optional(),
  commissionBps: z.number().int().min(0).max(9000).nullable().optional(),
  activeBonusKopecks: z.number().int().min(0).nullable().optional(),
  socials: z.record(z.string(), z.url()).optional(),
});

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const b = await parseJson(req, schema);
  const before = await prisma.creator.findUnique({ where: { id } });
  if (!before) throw notFound();
  const after = await prisma.creator.update({ where: { id }, data: b });
  await audit({ actorUserId: admin.id, actorType: "ADMIN", action: "creator.update", entityType: "creator", entityId: id,
    data: { before: { status: before.status, commissionBps: before.commissionBps, activeBonusKopecks: before.activeBonusKopecks }, changes: b } });
  return { ok: true, creator: after };
});
