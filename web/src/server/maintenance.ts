import { prisma } from "@/lib/db";
import { expireDueSubscriptions } from "./vip";
import { releaseHolds } from "./payouts";

/** Периодическое обслуживание: окончание VIP, разморозка комиссий, очистка устаревших данных. */
export async function runMaintenance() {
  const expired = await expireDueSubscriptions();
  const released = await releaseHolds();
  const now = new Date();
  await prisma.apiNonce.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 3600_000) } } });
  await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await prisma.linkCode.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 86400_000) } } });
  return { expired, released, at: now.toISOString() };
}
