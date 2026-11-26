import { prisma } from "@/lib/db";
import { creatorBalance, releaseHolds } from "./payouts";
import { recomputeTier } from "./creators";

const DAY = 86400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

function lastDays(n: number) {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(new Date(now.getTime() - i * DAY)));
  return out;
}

export async function creatorDashboard(creatorId: string) {
  await releaseHolds();
  const tier = await recomputeTier(creatorId);
  const since30 = new Date(Date.now() - 30 * DAY);
  const since12m = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 11, 1));
  const [creator, balance, clicks, invited, active, salesAgg, sales30, refs30, commissions, payouts, income] = await Promise.all([
    prisma.creator.findUniqueOrThrow({ where: { id: creatorId }, include: { codes: true, user: { select: { username: true } } } }),
    creatorBalance(creatorId),
    prisma.referralEvent.count({ where: { creatorId, type: "CLICK" } }),
    prisma.referral.count({ where: { creatorId, status: { not: "REJECTED" } } }),
    prisma.referral.count({ where: { creatorId, status: "QUALIFIED" } }),
    prisma.purchase.aggregate({ where: { creatorId, status: "PAID" }, _sum: { amountKopecks: true }, _count: true }),
    prisma.purchase.findMany({ where: { creatorId, status: "PAID", paidAt: { gte: since30 } }, select: { paidAt: true, amountKopecks: true } }),
    prisma.referral.findMany({ where: { creatorId, createdAt: { gte: since30 }, status: { not: "REJECTED" } }, select: { createdAt: true } }),
    prisma.commission.findMany({ where: { creatorId }, orderBy: { createdAt: "desc" }, take: 25, include: { purchase: { select: { orderNumber: true } } } }),
    prisma.payoutRequest.findMany({ where: { creatorId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.commission.findMany({ where: { creatorId, status: { not: "CANCELLED" }, createdAt: { gte: since12m } }, select: { createdAt: true, amountKopecks: true } }),
  ]);

  const days30 = lastDays(30);
  const salesByDay = new Map(days30.map((d) => [d, 0]));
  for (const s of sales30) if (s.paidAt) salesByDay.set(dayKey(s.paidAt), (salesByDay.get(dayKey(s.paidAt)) ?? 0) + s.amountKopecks);
  const refsByDay = new Map(days30.map((d) => [d, 0]));
  for (const r of refs30) refsByDay.set(dayKey(r.createdAt), (refsByDay.get(dayKey(r.createdAt)) ?? 0) + 1);

  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const incomeByMonth = new Map(months.map((m) => [m, 0]));
  for (const c of income) {
    const k = c.createdAt.toISOString().slice(0, 7);
    if (incomeByMonth.has(k)) incomeByMonth.set(k, incomeByMonth.get(k)! + c.amountKopecks);
  }
  const label = (d: string) => d.slice(8, 10) + "." + d.slice(5, 7);

  return {
    creator: { ...creator, tier },
    balance,
    totals: { clicks, invited, active, purchases: salesAgg._count, salesKopecks: salesAgg._sum.amountKopecks ?? 0 },
    charts: {
      sales7: days30.slice(-7).map((d) => ({ label: label(d), value: salesByDay.get(d)! })),
      sales30: days30.map((d) => ({ label: label(d), value: salesByDay.get(d)! })),
      invited30: days30.map((d) => ({ label: label(d), value: refsByDay.get(d)! })),
      incomeMonthly: months.map((m) => ({ label: m.slice(5, 7) + "." + m.slice(2, 4), value: incomeByMonth.get(m)! })),
    },
    commissions,
    payouts,
  };
}
