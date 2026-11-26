import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { forbidden } from "@/lib/errors";
import { requestPayout } from "@/server/payouts";

const schema = z.object({
  amountKopecks: z.number().int().positive(),
  method: z.enum(["card", "sbp", "yoomoney", "other"]),
  details: z.string().trim().min(4).max(300),
});

export const POST = route(async (req) => {
  const u = await requireRole("CREATOR", "ADMIN");
  const creator = await prisma.creator.findUnique({ where: { userId: u.id } });
  if (!creator) throw forbidden();
  const b = await parseJson(req, schema);
  const r = await requestPayout(creator.id, u.id, b);
  return { ok: true, id: r.id };
}, { rate: { key: "payout", limit: 5, windowMs: 3600_000 } });
