"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/api";

type Quote = { basePriceKopecks: number; discountKopecks: number; amountKopecks: number; promo: { code: string; creatorName: string } | null; promoError: string | null; promoMessage: string | null };

const rub = (k: number, l: string) => new Intl.NumberFormat(l === "en" ? "en-US" : "ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: k % 100 ? 2 : 0 }).format(k / 100);

export function CheckoutForm({ slug, basePrice, initialCode, gift, locale, t }: {
  slug: string; basePrice: number; initialCode: string; gift: boolean; locale: string;
  t: { promo: string; apply: string; promoOk: string; partner: string; price: string; discount: string; total: string; pay: string; giftTo: string; days: string };
}) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [giftTo, setGiftTo] = useState("");
  const [q, setQ] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function check(c: string) {
    const r = await api<Quote>("/api/store/quote", "POST", { slug, code: c || null });
    if (r.ok) setQ(r.data);
  }
  useEffect(() => { void check(initialCode); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const amount = q?.amountKopecks ?? basePrice;
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const r = await api<{ purchaseId: string; confirmationUrl: string | null }>("/api/orders", "POST", { slug, code: q?.promo ? q.promo.code : null, giftTo: gift ? giftTo : null });
        setBusy(false);
        if (!r.ok) return setErr(r.message);
        const url = r.data.confirmationUrl;
        if (url && /^https?:\/\//.test(url)) window.location.href = url;
        else router.push(url ?? `/orders/${r.data.purchaseId}`);
      }}
    >
      {gift && (
        <label className="block">
          <span className="label">{t.giftTo}</span>
          <input className="input" value={giftTo} onChange={(e) => setGiftTo(e.target.value)} required maxLength={32} />
        </label>
      )}
      <div>
        <span className="label">{t.promo}</span>
        <div className="flex gap-2">
          <input className="input font-mono uppercase" value={code} maxLength={24} onChange={(e) => setCode(e.target.value)} placeholder="CODE" />
          <button type="button" className="btn-ghost" onClick={() => check(code)}>{t.apply}</button>
        </div>
        {q?.promo && <p className="mt-2 text-sm text-emerald-400">✓ {t.promoOk}: <b>{q.promo.code}</b> · {t.partner}: {q.promo.creatorName}</p>}
        {q?.promoError && code && <p className="mt-2 text-sm text-red-400">{q.promoMessage}</p>}
      </div>
      <dl className="space-y-2 rounded-xl border border-edge bg-coal p-4 text-sm">
        <div className="flex justify-between"><dt className="text-mute">{t.price}</dt><dd>{rub(q?.basePriceKopecks ?? basePrice, locale)}</dd></div>
        {q && q.discountKopecks > 0 && <div className="flex justify-between text-emerald-400"><dt>{t.discount}</dt><dd>−{rub(q.discountKopecks, locale)}</dd></div>}
        <div className="flex justify-between border-t border-edge pt-2 text-lg font-bold"><dt>{t.total}</dt><dd className="text-gold-soft">{rub(amount, locale)}</dd></div>
      </dl>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button type="submit" disabled={busy} className="btn-gold w-full text-base">{busy ? "…" : t.pay}</button>
    </form>
  );
}
