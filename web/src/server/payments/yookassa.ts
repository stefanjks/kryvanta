import { env } from "@/lib/env";
import { kopecksToValue, type PaymentAdapter } from "./types";

/**
 * ЮKassa — официальное API v3: https://yookassa.ru/developers/api
 * Авторизация: HTTP Basic (shopId:secretKey). Идемпотентность: заголовок Idempotence-Key.
 * HTTP-уведомления ЮKassa не подписываются, поэтому сайт:
 *   1) принимает уведомления только с IP-адресов ЮKassa (YOOKASSA_ALLOWED_IPS),
 *   2) всегда перепроверяет статус и сумму объекта запросом GET /v3/payments/{id} (рекомендация ЮKassa).
 */
const API = "https://api.yookassa.ru/v3";

function authHeader() {
  if (!env.yookassaShopId || !env.yookassaSecretKey) throw new Error("YooKassa is not configured (YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY)");
  return "Basic " + Buffer.from(`${env.yookassaShopId}:${env.yookassaSecretKey}`).toString("base64");
}

export type YkPayment = {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  amount: { value: string; currency: string };
  metadata?: Record<string, string>;
  confirmation?: { type: string; confirmation_url?: string };
};
export type YkRefund = { id: string; payment_id: string; status: "pending" | "succeeded" | "canceled"; amount: { value: string; currency: string } };

async function yk<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init.idempotencyKey ? { "Idempotence-Key": init.idempotencyKey } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`YooKassa ${path} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

export const yookassaAdapter: PaymentAdapter = {
  id: "yookassa",
  async createPayment(input) {
    const p = await yk<YkPayment>("/payments", {
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      body: JSON.stringify({
        amount: { value: kopecksToValue(input.amountKopecks), currency: "RUB" },
        capture: true,
        confirmation: { type: "redirect", return_url: input.returnUrl },
        description: input.description.slice(0, 128),
        metadata: { paymentId: input.paymentId, purchaseId: input.purchaseId },
      }),
    });
    return { providerPaymentId: p.id, confirmationUrl: p.confirmation?.confirmation_url ?? null };
  },
};

export const fetchYkPayment = (id: string) => yk<YkPayment>(`/payments/${encodeURIComponent(id)}`);
export const fetchYkRefund = (id: string) => yk<YkRefund>(`/refunds/${encodeURIComponent(id)}`);

/** Проверка IPv4/IPv6 по списку CIDR. */
export function ipAllowed(ip: string, cidrs: string[]): boolean {
  return cidrs.some((c) => inCidr(ip, c));
}

function inCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr ?? (range.includes(":") ? 128 : 32));
  const a = toBig(ip), b = toBig(range);
  if (a === null || b === null || a.v6 !== b.v6) return false;
  const total = a.v6 ? 128 : 32;
  const mask = bits === 0 ? 0n : ((1n << BigInt(bits)) - 1n) << BigInt(total - bits);
  return (a.n & mask) === (b.n & mask);
}

function toBig(ip: string): { n: bigint; v6: boolean } | null {
  ip = ip.trim();
  if (ip.startsWith("::ffff:") && ip.includes(".")) ip = ip.slice(7);
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts.some((x) => x > 255)) return null;
    return { n: parts.reduce((acc, x) => (acc << 8n) + BigInt(x), 0n), v6: false };
  }
  if (!ip.includes(":")) return null;
  const [head, tail] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined ? (tail ? tail.split(":") : []) : [];
  const groups = tail !== undefined ? [...h, ...Array(8 - h.length - t.length).fill("0"), ...t] : h;
  if (groups.length !== 8) return null;
  return { n: groups.reduce((acc, g) => (acc << 16n) + BigInt(parseInt(g || "0", 16)), 0n), v6: true };
}
