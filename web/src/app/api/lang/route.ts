import { z } from "zod";
import { cookies } from "next/headers";
import { route, parseJson } from "@/lib/http";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const POST = route(async (req) => {
  const { lang } = await parseJson(req, z.object({ lang: z.enum(["ru", "en"]) }));
  (await cookies()).set("lang", lang, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  const u = await currentUser();
  if (u) await prisma.user.update({ where: { id: u.id }, data: { locale: lang } });
  return { ok: true };
});
