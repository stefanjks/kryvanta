import { z } from "zod";
import { route, parseJson, ipHash } from "@/lib/http";
import { createSession } from "@/lib/auth";
import { authenticate } from "@/server/users";
import { audit } from "@/lib/audit";

const schema = z.object({ login: z.string().min(1).max(120), password: z.string().min(1).max(200) });

export const POST = route(async (req) => {
  const body = await parseJson(req, schema);
  const user = await authenticate(body.login, body.password);
  const ip = ipHash(req);
  await createSession(user.id, { ipHash: ip ?? undefined, userAgent: req.headers.get("user-agent") ?? undefined });
  if (user.role === "ADMIN") await audit({ actorUserId: user.id, actorType: "ADMIN", action: "admin.login", ipHash: ip ?? undefined });
  return { ok: true, role: user.role };
}, { rate: { key: "login", limit: 10, windowMs: 5 * 60_000 } });
