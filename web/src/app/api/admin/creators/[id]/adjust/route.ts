import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { adjustBalance } from "@/server/payouts";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const b = await parseJson(req, z.object({ amountKopecks: z.number().int(), note: z.string().trim().min(3).max(300) }));
  await adjustBalance(id, admin.id, b.amountKopecks, b.note);
  return { ok: true };
});
