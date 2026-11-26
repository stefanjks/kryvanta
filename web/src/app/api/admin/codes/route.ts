import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { conflict, notFound, badRequest } from "@/lib/errors";
import { CODE_RE, normalizeCode } from "@/server/creators";

const schema = z.object({
  creatorId: z.uuid(),
  code: z.string().max(24),
  discountBps: z.number().int().min(0).max(9000).nullish(),
  maxUses: z.number().int().min(1).nullish(),
  expiresAt: z.iso.datetime().nullish(),
  onePerUser: z.boolean().optional(),
});

export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const b = await parseJson(req, schema);
  const code = normalizeCode(b.code);
  if (!CODE_RE.test(code)) throw badRequest("invalid_code", "Код: 3–24 символа A-Z, 0-9, _ или -");
  if (!(await prisma.creator.findUnique({ where: { id: b.creatorId } }))) throw notFound("creator_not_found");
  if (await prisma.creatorCode.findUnique({ where: { code } })) throw conflict("code_taken", "Такой промокод уже существует");
  const row = await prisma.creatorCode.create({
    data: { code, creatorId: b.creatorId, discountBps: b.discountBps ?? 1000, maxUses: b.maxUses ?? null, expiresAt: b.expiresAt ? new Date(b.expiresAt) : null, onePerUser: b.onePerUser ?? true },
  });
  await audit({ actorUserId: admin.id, actorType: "ADMIN", action: "code.create", entityType: "creator_code", entityId: row.id, data: { code } });
  return { ok: true, id: row.id, code };
});
