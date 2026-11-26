import { randomToken, hmacHex, safeEqualHex } from "@/lib/crypto";
import { env } from "@/lib/env";
import type { PaymentAdapter } from "./types";

/**
 * Тестовый провайдер. Имитирует внешнюю платёжную страницу и отправляет подписанный HMAC вебхук,
 * который проходит тот же путь обработки (проверка подписи, защита от повтора, идемпотентное подтверждение),
 * что и настоящий. В production запрещён, если явно не включён ALLOW_TEST_PAYMENTS=true.
 */
export const testAdapter: PaymentAdapter = {
  id: "test",
  async createPayment(input) {
    if (!env.allowTestPayments) throw new Error("Test payments are disabled in production");
    return { providerPaymentId: "test_" + randomToken(12), confirmationUrl: `/pay/test/${input.paymentId}` };
  },
};

export function signTestWebhook(body: string, timestamp: number) {
  return hmacHex(env.testPaymentSecret, `${timestamp}.${body}`);
}

export function verifyTestWebhook(body: string, timestampHeader: string | null, signature: string | null) {
  const ts = Number(timestampHeader);
  if (!signature || !Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;
  return safeEqualHex(signTestWebhook(body, ts), signature);
}
