import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { badRequest } from "@/lib/errors";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const b = await parseJson(req, z.object({ role: z.enum(["PLAYER", "CREATOR", "ADMIN"]).optional(), isBlocked: z.boolean().optional(), unlinkMinecraft: z.boolean().optional() }));
  if (id === admin.id && (b.role && b.role !== "ADMIN" || b.isBlocked)) throw badRequest("self", "Нельзя понизить или заблокировать самого себя");
  await prisma.$transaction(async (tx) => {
    const { unlinkMinecraft, ...data } = b;
    await tx.user.update({ where: { id }, data });
    if (b.isBlocked) await tx.session.deleteMany({ where: { userId: id } });
    if (unlinkMinecraft) {
      const acc = await tx.minecraftAccount.findUnique({ where: { userId: id }, include: { subscriptions: true } });
      if (acc && acc.subscriptions.some((s) => s.status === "ACTIVE")) throw badRequest("has_vip", "Сначала снимите активный VIP");
      if (acc) await tx.minecraftAccount.delete({ where: { id: acc.id } });
    }
    await audit({ actorUserId: admin.id, actorType: "ADMIN", action: "user.update", entityType: "user", entityId: id, data: b }, tx);
  });
  return { ok: true };
});
