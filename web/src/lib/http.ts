import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { ApiError } from "./errors";
import { env } from "./env";
import { rateLimit } from "./ratelimit";
import { keyedHash } from "./crypto";

export function clientIp(req: Request): string {
  if (env.trustProxy) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    const real = req.headers.get("x-real-ip");
    if (real) return real.trim();
  }
  return "0.0.0.0";
}

export const ipHash = (req: Request) => keyedHash("ip:" + clientIp(req));

/**
 * CSRF: cookie-сессия имеет SameSite=Lax, а все изменяющие запросы дополнительно
 * обязаны прийти с того же Origin и с Content-Type: application/json
 * (HTML-формы с чужих сайтов не могут отправить такой запрос без CORS-preflight).
 */
export function assertSameOrigin(req: Request) {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  const origin = req.headers.get("origin");
  const allowed = new Set<string>([new URL(env.appUrl).origin]);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host && !env.isProd) {
    allowed.add(`http://${host}`);
    allowed.add(`https://${host}`);
  }
  if (!origin || !allowed.has(origin)) throw new ApiError(403, "csrf", "Недопустимый источник запроса");
  const ct = req.headers.get("content-type") || "";
  if (!ct.toLowerCase().startsWith("application/json")) throw new ApiError(415, "content_type", "Ожидается JSON");
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Некорректный JSON");
  }
  return schema.parse(raw);
}

type Opts = { csrf?: boolean; rate?: { key: string; limit: number; windowMs: number } };
type Ctx<P> = { params: Promise<P> };

export function route<P = Record<string, string>>(
  fn: (req: NextRequest, ctx: Ctx<P>) => Promise<Response | unknown>,
  opts: Opts = {},
) {
  return async (req: NextRequest, ctx: Ctx<P>): Promise<Response> => {
    try {
      if (opts.rate) {
        const r = rateLimit(`${opts.rate.key}:${clientIp(req)}`, opts.rate.limit, opts.rate.windowMs);
        if (!r.ok) {
          return NextResponse.json(
            { error: "rate_limited", message: "Слишком много запросов, попробуйте позже" },
            { status: 429, headers: { "Retry-After": String(r.retryAfter) } },
          );
        }
      }
      if (opts.csrf !== false) assertSameOrigin(req);
      const out = await fn(req, ctx);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown): Response {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: e.code, message: e.message, details: e.details }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "validation", message: "Проверьте введённые данные", details: e.issues.map((i) => ({ path: i.path, message: i.message })) },
      { status: 400 },
    );
  }
  console.error("[api] unhandled error", e);
  return NextResponse.json({ error: "internal", message: "Внутренняя ошибка сервера" }, { status: 500 });
}
