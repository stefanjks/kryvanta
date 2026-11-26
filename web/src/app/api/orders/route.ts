import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { createOrder } from "@/server/orders";

const schema = z.object({ slug: z.string().max(64), code: z.string().max(24).nullish(), giftTo: z.string().max(32).nullish() });

export const POST = route(async (req) => {
  const u = await requireUser();
  const b = await parseJson(req, schema);
  return createOrder(u.id, { productSlug: b.slug, code: b.code, giftTo: b.giftTo });
}, { rate: { key: "order", limit: 10, windowMs: 10 * 60_000 } });
