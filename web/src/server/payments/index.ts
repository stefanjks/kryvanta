import { env } from "@/lib/env";
import { manualAdapter } from "./manual";
import { testAdapter } from "./test";
import { yookassaAdapter } from "./yookassa";
import type { PaymentAdapter } from "./types";

export function activeAdapter(): PaymentAdapter {
  switch (env.paymentProvider) {
    case "yookassa":
      return yookassaAdapter;
    case "test":
      if (!env.allowTestPayments) {
        console.warn("[payments] PAYMENT_PROVIDER=test is disabled in production, falling back to manual");
        return manualAdapter;
      }
      return testAdapter;
    default:
      return manualAdapter;
  }
}
