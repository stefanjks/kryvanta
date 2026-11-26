/**
 * Периодическое обслуживание (cron каждые 5 минут):
 *   - истечение VIP-подписок (и команда серверу снять группу),
 *   - перевод комиссий из заморозки в доступные,
 *   - очистка устаревших nonce, сессий и кодов привязки.
 * Запуск: npm run expire-vip
 */
import { prisma } from "../src/lib/db";
import { expireDueSubscriptions } from "../src/server/vip";
import { releaseHolds } from "../src/server/payouts";

async function main() {
  const expired = await expireDueSubscriptions();
  const released = await releaseHolds();
  const now = new Date();
  await prisma.apiNonce.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 3600_000) } } });
  await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await prisma.linkCode.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 86400_000) } } });
  console.log(`${now.toISOString()} maintenance: expired VIP=${expired}, released commissions=${released}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
