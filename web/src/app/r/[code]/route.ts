import { NextResponse, type NextRequest } from "next/server";
import { ipHash } from "@/lib/http";
import { trackClick } from "@/server/referrals";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/ratelimit";

/** Реферальная ссылка: /r/КОД → запоминаем код на 30 дней (cookie) и считаем переход. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const res = NextResponse.redirect(new URL("/?ref=1", env.appUrl));
  const ip = ipHash(req);
  if (!rateLimit("ref:" + (ip ?? "unknown"), 30, 60_000).ok) return res;
  const c = await trackClick(code, ip).catch(() => null);
  if (c) {
    res.cookies.set("kry_ref", c.code, { path: "/", maxAge: 30 * 86400, sameSite: "lax", httpOnly: false, secure: env.isProd });
  }
  return res;
}
