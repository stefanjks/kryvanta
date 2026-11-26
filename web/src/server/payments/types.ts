export type CreatePaymentInput = {
  paymentId: string;
  purchaseId: string;
  amountKopecks: number;
  description: string;
  idempotencyKey: string;
  returnUrl: string;
};

export type CreatePaymentResult = {
  providerPaymentId: string | null;
  /** Куда отправить покупателя для оплаты. null — оплата ожидает ручного подтверждения администратором. */
  confirmationUrl: string | null;
};

export interface PaymentAdapter {
  readonly id: "manual" | "test" | "yookassa";
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
}

export const kopecksToValue = (k: number) => `${Math.floor(k / 100)}.${String(k % 100).padStart(2, "0")}`;
export function valueToKopecks(v: string): number {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(v);
  if (!m) throw new Error("bad amount " + v);
  return Number(m[1]) * 100 + Number(((m[2] ?? "") + "00").slice(0, 2));
}
