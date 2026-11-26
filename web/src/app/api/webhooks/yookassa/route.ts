import { route, clientIp } from "@/lib/http";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/errors";
import { ipAllowed } from "@/server/payments/yookassa";
import { processYookassaWebhook } from "@/server/webhooks";

export const POST = route(async (req) => {
  if (env.paymentProvider !== "yookassa") throw new ApiError(404, "not_found");
  const ip = clientIp(req);
  if (!ipAllowed(ip, env.yookassaAllowedIps)) throw new ApiError(403, "ip_not_allowed");
  const body = await req.json().catch(() => null);
  return processYookassaWebhook(body);
}, { csrf: false });
