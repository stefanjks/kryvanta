import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
import { verifyTestWebhook } from "./payments/test";
import { fetchYkPayment, fetchYkRefund } from "./payments/yookassa";
import { valueToKopecks } from "./payments/types";
import { cancelPendingOrder, confirmPayment, refundPurchase, registerPaymentEvent } from "./orders";

type TestEvent = { eventId: string; type: "payment.succeeded" | "payment.canceled" | "refund.succeeded"; providerPaymentId: string; amountKopecks: number };

export async function processTestWebhook(raw: string, ts: string | null, sig: string | null) {
  if (!verifyTestWebhook(raw, ts, sig)) throw new ApiError(401, "bad_signature", "Invalid webhook signature");
  const ev = JSON.parse(raw) as TestEvent;
  const seen = await prisma.paymentEvent.findUnique({ where: { provider_eventKey: { provider: "test", eventKey: ev.eventId } } });
  if (seen) return { duplicate: true };
  const payment = await prisma.payment.findUnique({ where: { provider_providerPaymentId: { provider: "test", providerPaymentId: ev.providerPaymentId } } });
  if (!payment) throw new ApiError(404, "payment_not_found");
  if (ev.type === "payment.succeeded") await confirmPayment(payment.id, { source: "webhook", providerAmountKopecks: ev.amountKopecks });
  else if (ev.type === "payment.canceled") await cancelPendingOrder(payment.purchaseId, null, { source: "webhook" });
  else if (ev.type === "refund.succeeded") await refundPurchase(payment.purchaseId, { source: "webhook", reason: "provider refund" });
  await registerPaymentEvent("test", ev.eventId, ev);
  return { duplicate: false };
}

type YkNotification = { type: string; event: string; object: { id: string; payment_id?: string } };

/**
 * ЮKassa: уведомление — только сигнал. Статус и сумму всегда берём из API ЮKassa,
 * поэтому подделанное уведомление ничего не изменит.
 */
export async function processYookassaWebhook(body: YkNotification) {
  if (body?.type !== "notification" || !body.object?.id) throw new ApiError(400, "bad_notification");
  const eventKey = `${body.event}:${body.object.id}`;
  const seen = await prisma.paymentEvent.findUnique({ where: { provider_eventKey: { provider: "yookassa", eventKey } } });
  if (seen) return { duplicate: true };

  if (body.event === "payment.succeeded" || body.event === "payment.canceled") {
    const p = await fetchYkPayment(body.object.id);
    const payment = await prisma.payment.findUnique({ where: { provider_providerPaymentId: { provider: "yookassa", providerPaymentId: p.id } } });
    if (!payment) throw new ApiError(404, "payment_not_found");
    if (p.metadata?.paymentId && p.metadata.paymentId !== payment.id) throw new ApiError(409, "metadata_mismatch");
    await prisma.payment.update({ where: { id: payment.id }, data: { rawLast: p as object } });
    if (p.status === "succeeded" && p.paid) {
      if (p.amount.currency !== "RUB") throw new ApiError(409, "currency_mismatch");
      await confirmPayment(payment.id, { source: "webhook", providerAmountKopecks: valueToKopecks(p.amount.value) });
    } else if (p.status === "canceled") {
      await cancelPendingOrder(payment.purchaseId, null, { source: "webhook" });
    } else {
      return { ignored: true }; // статус ещё не финальный — дождёмся следующего уведомления
    }
  } else if (body.event === "refund.succeeded") {
    const r = await fetchYkRefund(body.object.id);
    if (r.status !== "succeeded") return { ignored: true };
    const payment = await prisma.payment.findUnique({ where: { provider_providerPaymentId: { provider: "yookassa", providerPaymentId: r.payment_id } } });
    if (!payment) throw new ApiError(404, "payment_not_found");
    if (valueToKopecks(r.amount.value) >= payment.amountKopecks) {
      await refundPurchase(payment.purchaseId, { source: "webhook", reason: `yookassa refund ${r.id}` });
    } else {
      await audit({ actorType: "PAYMENT", action: "refund.partial_manual_review", entityType: "purchase", entityId: payment.purchaseId, data: { refundId: r.id, amount: r.amount.value } });
    }
  } else {
    return { ignored: true };
  }
  await registerPaymentEvent("yookassa", eventKey, body as object);
  return { duplicate: false };
}
