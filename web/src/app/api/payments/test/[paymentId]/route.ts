import { z } from "zod";
import { randomUUID } from "node:crypto";
import { route, parseJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { ApiError, notFound } from "@/lib/errors";
import { signTestWebhook } from "@/server/payments/test";
import { processTestWebhook } from "@/server/webhooks";

/**
 * Страница тестового провайдера вызывает этот endpoint. Он формирует событие провайдера,
 * подписывает его секретом TEST_PAYMENT_SECRET и передаёт в тот же обработчик вебхука.
 */
export const POST = route<{ paymentId: string }>(async (req, { params }) => {
  if (!env.allowTestPayments) throw new ApiError(404, "not_found");
  const u = await requireUser();
  const { paymentId } = await params;
  const { outcome } = await parseJson(req, z.object({ outcome: z.enum(["success", "cancel"]) }));
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { purchase: true } });
  if (!payment || payment.provider !== "test" || payment.purchase.userId !== u.id || !payment.providerPaymentId) throw notFound();
  const body = JSON.stringify({
    eventId: randomUUID(),
    type: outcome === "success" ? "payment.succeeded" : "payment.canceled",
    providerPaymentId: payment.providerPaymentId,
    amountKopecks: payment.amountKopecks,
  });
  const ts = Math.floor(Date.now() / 1000);
  await processTestWebhook(body, String(ts), signTestWebhook(body, ts));
  return { ok: true, purchaseId: payment.purchaseId };
});
