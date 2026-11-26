import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { approveApplication, rejectApplication } from "@/server/creators";

const schema = z.object({ action: z.enum(["approve", "reject"]), code: z.string().max(24).nullish(), note: z.string().max(500).nullish() });

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const b = await parseJson(req, schema);
  if (b.action === "approve") return approveApplication(id, admin.id, { code: b.code ?? undefined, note: b.note ?? undefined });
  await rejectApplication(id, admin.id, b.note ?? undefined);
  return { ok: true };
});
