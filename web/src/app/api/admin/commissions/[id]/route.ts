import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { conflict } from "@/lib/errors";

/** Отмена начисления (например, выявлен фрод). Сумма не меняется — только статус, с причиной и журналом. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const { reason } = await parseJson(req, z.object({ reason: z.string().trim().min(3).max(300) }));
  const r = await prisma.$transaction(async (tx) => {
    const u = await tx.commission.updateMany({ where: { id, status: { in: ["HOLD", "AVAILABLE"] } }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason } });
    if (u.count === 0) throw conflict("not_cancellable", "Начисление уже отменено");
    await audit({ actorUserId: admin.id, actorType: "ADMIN", action: "commission.cancel", entityType: "commission", entityId: id, data: { reason } }, tx);
    return u.count;
  });
  return { ok: true, cancelled: r };
});
