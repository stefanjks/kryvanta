import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/errors";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const u = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound();
  const p = await prisma.purchase.findUnique({ where: { id }, select: { id: true, userId: true, status: true, orderNumber: true, amountKopecks: true, paidAt: true } });
  if (!p || (p.userId !== u.id && u.role !== "ADMIN")) throw notFound();
  return { id: p.id, status: p.status, orderNumber: p.orderNumber, amountKopecks: p.amountKopecks, paidAt: p.paidAt };
});
