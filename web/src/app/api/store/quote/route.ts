import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { currentUser } from "@/lib/auth";
import { quote, PROMO_REASONS } from "@/server/orders";

export const POST = route(async (req) => {
  const body = await parseJson(req, z.object({ slug: z.string().max(64), code: z.string().max(24).nullish() }));
  const u = await currentUser();
  const q = await quote(body.slug, body.code, u?.id ?? null);
  return {
    basePriceKopecks: q.basePriceKopecks,
    discountKopecks: q.discountKopecks,
    amountKopecks: q.amountKopecks,
    promo: q.promo,
    promoError: q.promoError,
    promoMessage: q.promoError ? PROMO_REASONS[q.promoError] : null,
  };
}, { rate: { key: "quote", limit: 30, windowMs: 60_000 } });
