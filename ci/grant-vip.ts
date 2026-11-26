/** CI: создать пользователя с привязанным аккаунтом и выдать VIP через сервис сайта. */
import { prisma } from "../web/src/lib/db";
import { extendVip } from "../web/src/server/vip";

const [uuid, name] = process.argv.slice(2);
async function main() {
  const user = await prisma.user.upsert({
    where: { email: "ci-tester@kryvanta.local" },
    create: { email: "ci-tester@kryvanta.local", username: "ci_tester", passwordHash: "x" },
    update: {},
  });
  const acc = await prisma.minecraftAccount.upsert({ where: { uuid }, create: { userId: user.id, uuid, name }, update: {} });
  await prisma.$transaction((tx) => extendVip(tx, acc.id, 30, { action: "MANUAL_GRANT", reason: "ci" }));
  console.log("VIP granted to", name, uuid);
}
main().finally(() => prisma.$disconnect());
