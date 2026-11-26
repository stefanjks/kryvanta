import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const GET = route(async () => {
  const u = await requireUser();
  const account = await prisma.minecraftAccount.findUnique({ where: { userId: u.id }, include: { subscriptions: true } });
  return { user: u, minecraft: account };
});
