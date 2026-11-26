import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { conflict, notFound } from "@/lib/errors";
import { cancelPendingOrder, confirmPayment, refundPurchase } from "@/server/orders";

const schema = z.object({ action: z.enum(["confirm", "refund", "cancel"]), reason: z.string().max(300).nullish() });

/**
 * confirm — ручное подтверждение оплаты (режим manual или проверенный вручную платёж).
 * refund  — отметить возврат (деньги возвращаются через провайдера/вручную), комиссия отменяется.
 */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const b = await parseJson(req, schema);
  const p = await prisma.purchase.findUnique({ where: { id }, include: { payments: { orderBy: { createdAt: "desc" } } } });
  if (!p) throw notFound();
  if (b.action === "confirm") {
    const pay = p.payments.find((x) => x.status === "PENDING");
    if (!pay) throw conflict("no_pending_payment", "Нет ожидающего платежа");
    return confirmPayment(pay.id, { source: "admin", actorUserId: admin.id });
  }
  if (b.action === "refund") return refundPurchase(id, { source: "admin", actorUserId: admin.id, reason: b.reason ?? "admin refund" });
  return cancelPendingOrder(id, admin.id, { source: "admin" });
});
