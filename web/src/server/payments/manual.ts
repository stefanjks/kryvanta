import type { PaymentAdapter } from "./types";

/** Ручной режим: заказ ожидает подтверждения администратором в /admin → «Покупки». */
export const manualAdapter: PaymentAdapter = {
  id: "manual",
  async createPayment() {
    return { providerPaymentId: null, confirmationUrl: null };
  },
};
