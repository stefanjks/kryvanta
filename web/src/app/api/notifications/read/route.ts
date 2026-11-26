import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const POST = route(async () => {
  const u = await requireUser();
  await prisma.notification.updateMany({ where: { userId: u.id, readAt: null }, data: { readAt: new Date() } });
  return { ok: true };
});
