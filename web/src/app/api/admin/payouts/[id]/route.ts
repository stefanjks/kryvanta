import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { transitionPayout } from "@/server/payouts";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), amountKopecks: z.number().int().positive().nullish(), comment: z.string().max(500).nullish() }),
  z.object({ action: z.literal("reject"), comment: z.string().max(500).nullish() }),
  z.object({ action: z.literal("paid"), externalTxnId: z.string().trim().min(1).max(120), comment: z.string().max(500).nullish() }),
]);

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const b = await parseJson(req, schema);
  const comment = b.comment ?? undefined;
  if (b.action === "approve") return transitionPayout(id, admin.id, { action: "approve", amountKopecks: b.amountKopecks ?? undefined, comment });
  if (b.action === "reject") return transitionPayout(id, admin.id, { action: "reject", comment });
  return transitionPayout(id, admin.id, { action: "paid", externalTxnId: b.externalTxnId, comment });
});
