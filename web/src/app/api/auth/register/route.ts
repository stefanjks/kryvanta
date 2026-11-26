import { z } from "zod";
import { cookies } from "next/headers";
import { route, parseJson, ipHash } from "@/lib/http";
import { createSession } from "@/lib/auth";
import { registerUser } from "@/server/users";
import { getLocale } from "@/lib/i18n";

const schema = z.object({
  email: z.email().max(120),
  username: z.string().trim().min(3).max(24).regex(/^[A-Za-z0-9_.-]+$/, "Только латиница, цифры, _ . -"),
  password: z.string().min(10).max(200),
  refCode: z.string().max(24).nullish(),
});

export const POST = route(async (req) => {
  const body = await parseJson(req, schema);
  const jar = await cookies();
  const refCode = body.refCode || jar.get("kry_ref")?.value || null;
  const ip = ipHash(req);
  const user = await registerUser({ ...body, refCode, ipHash: ip, locale: await getLocale() });
  await createSession(user.id, { ipHash: ip ?? undefined, userAgent: req.headers.get("user-agent") ?? undefined });
  return { ok: true, userId: user.id };
}, { rate: { key: "register", limit: 5, windowMs: 15 * 60_000 } });
