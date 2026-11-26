import type { ZodType } from "zod";
import { errorResponse } from "@/lib/http";
import { ApiError } from "@/lib/errors";
import { signedJson, verifyPluginRequest } from "./plugin";

/** Обёртка для endpoint-ов плагина: проверка HMAC-подписи, защита от повтора, подписанный ответ. */
export function pluginRoute<T>(schema: ZodType<T>, fn: (body: T) => Promise<unknown>) {
  return async (req: Request) => {
    let nonce = "";
    try {
      const raw = await req.text();
      if (raw.length > 2_000_000) throw new ApiError(413, "too_large");
      ({ nonce } = await verifyPluginRequest(req, raw));
      const body = schema.parse(JSON.parse(raw || "{}"));
      return signedJson(await fn(body), nonce);
    } catch (e) {
      if (nonce && e instanceof ApiError) return signedJson({ error: e.code, message: e.message }, nonce, e.status);
      return errorResponse(e);
    }
  };
}
