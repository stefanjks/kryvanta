/** Обслуживание по cron (свой сервер): npm run expire-vip */
import { prisma } from "../src/lib/db";
import { runMaintenance } from "../src/server/maintenance";

runMaintenance()
  .then((r) => console.log(`${r.at} maintenance: expired VIP=${r.expired}, released commissions=${r.released}`))
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
