import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { createCreator } from "@/server/creators";

let n = 0;
export async function makeUser(opts: { role?: "PLAYER" | "CREATOR" | "ADMIN"; ipHash?: string; linked?: boolean } = {}) {
  n++;
  const tag = `${Date.now().toString(36)}${n}`;
  const user = await prisma.user.create({
    data: {
      email: `u${tag}@test.local`,
      username: `user_${tag}`,
      passwordHash: "x",
      role: opts.role ?? "PLAYER",
      registrationIpHash: opts.ipHash ?? `ip-${tag}`,
    },
  });
  let account = null;
  if (opts.linked !== false) {
    account = await prisma.minecraftAccount.create({ data: { userId: user.id, uuid: randomUUID(), name: `P${tag}`.slice(0, 16) } });
  }
  return { user, account };
}

export async function makeCreator(code?: string) {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const { user, account } = await makeUser();
  const res = await prisma.$transaction((tx) =>
    createCreator(tx, { userId: user.id, displayName: "Blogger " + user.username, socials: { youtube: "https://youtube.com/@x" }, code: code ?? `C${Date.now().toString(36).toUpperCase()}${n}`, actorUserId: admin.id }),
  );
  return { user, account, creator: res.creator, code: res.code, admin };
}

export async function payOrder(purchaseId: string) {
  const payment = await prisma.payment.findFirstOrThrow({ where: { purchaseId } });
  const { confirmPayment } = await import("@/server/orders");
  return confirmPayment(payment.id, { source: "test" });
}
