import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { createLinkCode } from "@/server/users";

export const POST = route(async () => {
  const u = await requireUser();
  return createLinkCode(u.id);
}, { rate: { key: "linkcode", limit: 6, windowMs: 10 * 60_000 } });
