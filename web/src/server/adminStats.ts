import { prisma } from "@/lib/db";

const DAY = 86400_000;

export async function adminOverview() {
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [revenue, today_, month_, activeVips, creators, referrals, commissions, pendingPayouts, pendingApps, pendingOrders, last30] = await Promise.all([
    prisma.purchase.aggregate({ where: { status: "PAID" }, _sum: { amountKopecks: true }, _count: true }),
    prisma.purchase.aggregate({ where: { status: "PAID", paidAt: { gte: today } }, _sum: { amountKopecks: true }, _count: true }),
    prisma.purchase.aggregate({ where: { status: "PAID", paidAt: { gte: month } }, _sum: { amountKopecks: true }, _count: true }),
    prisma.vipSubscription.count({ where: { status: "ACTIVE", expiresAt: { gt: now } } }),
    prisma.creator.count({ where: { status: "APPROVED" } }),
    prisma.referral.count({ where: { status: { not: "REJECTED" } } }),
    prisma.commission.aggregate({ where: { status: { not: "CANCELLED" } }, _sum: { amountKopecks: true } }),
    prisma.payoutRequest.aggregate({ where: { status: { in: ["PENDING", "APPROVED"] } }, _sum: { amountKopecks: true }, _count: true }),
    prisma.creatorApplication.count({ where: { status: "PENDING" } }),
    prisma.purchase.count({ where: { status: "PENDING" } }),
    prisma.purchase.findMany({ where: { status: "PAID", paidAt: { gte: new Date(now.getTime() - 30 * DAY) } }, select: { paidAt: true, amountKopecks: true } }),
  ]);
  const days: { label: string; value: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY).toISOString().slice(0, 10);
    days.push({ label: d.slice(8, 10) + "." + d.slice(5, 7), value: last30.filter((p) => p.paidAt!.toISOString().slice(0, 10) === d).reduce((a, p) => a + p.amountKopecks, 0) });
  }
  return {
    revenue: revenue._sum.amountKopecks ?? 0, sales: revenue._count,
    todayRevenue: today_._sum.amountKopecks ?? 0, todaySales: today_._count,
    monthRevenue: month_._sum.amountKopecks ?? 0, monthSales: month_._count,
    activeVips, creators, referrals,
    commissions: commissions._sum.amountKopecks ?? 0,
    pendingPayouts: pendingPayouts._sum.amountKopecks ?? 0, pendingPayoutsCount: pendingPayouts._count,
    pendingApps, pendingOrders, revenue30: days,
  };
}
