/** Денежная математика в целых копейках. 1% = 100 bps. Округление всегда вниз (в пользу проекта не завышая скидку/комиссию). */

export function applyDiscount(baseKopecks: number, discountBps: number) {
  if (!Number.isInteger(baseKopecks) || baseKopecks < 0) throw new Error("invalid base");
  const bps = Math.max(0, Math.min(10000, Math.trunc(discountBps)));
  const discount = Math.floor((baseKopecks * bps) / 10000);
  return { discountKopecks: discount, amountKopecks: baseKopecks - discount };
}

/** Комиссия считается от фактически оплаченной суммы (после скидки). */
export function commissionFor(paidKopecks: number, rateBps: number) {
  if (!Number.isInteger(paidKopecks) || paidKopecks < 0) throw new Error("invalid amount");
  const bps = Math.max(0, Math.min(10000, Math.trunc(rateBps)));
  return Math.floor((paidKopecks * bps) / 10000);
}

export function formatRub(kopecks: number, locale: string = "ru") {
  const v = kopecks / 100;
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(v);
}

/** "199" / "199.50" / "199,50" -> копейки */
export function parseRub(input: string | number): number {
  const s = String(input).replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error("invalid amount");
  const [r, k = ""] = s.split(".");
  return Number(r) * 100 + Number((k + "00").slice(0, 2));
}
