import { route } from "@/lib/http";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/errors";
import { processTestWebhook } from "@/server/webhooks";

export const POST = route(async (req) => {
  if (!env.allowTestPayments) throw new ApiError(404, "not_found");
  const raw = await req.text();
  return processTestWebhook(raw, req.headers.get("x-test-timestamp"), req.headers.get("x-test-signature"));
}, { csrf: false, rate: { key: "wh-test", limit: 60, windowMs: 60_000 } });
