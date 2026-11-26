import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { createOrder } from "@/server/orders";
import { attachReferral, evaluateReferral, trackClick } from "@/server/referrals";
import { recordPlaytime } from "@/server/plugin";
import { adjustBalance, creatorBalance, releaseHolds, requestPayout, transitionPayout } from "@/server/payouts";
import { approveApplication, submitApplication, tierFor } from "@/server/creators";
import { DEFAULT_SETTINGS, saveSettings, getSettings } from "@/lib/settings";
import { makeCreator, makeUser, payOrder } from "./helpers";

async function referredPlayer(code: string, ip = "ip-" + randomUUID()) {
  const { user, account } = await makeUser({ ipHash: ip });
  await prisma.$transaction((tx) => attachReferral(tx, user.id, code, ip));
  return { user, account };
}

describe("реферальная программа", () => {
  it("клики считаются один раз в сутки с одного IP", async () => {
    const { code, creator } = await makeCreator();
    await trackClick(code, "ip-a");
    await trackClick(code, "ip-a");
    await trackClick(code, "ip-b");
    expect(await prisma.referralEvent.count({ where: { creatorId: creator.id, type: "CLICK" } })).toBe(2);
  });

  it("активный игрок: бонус после 3 часов активной игры, пакеты времени идемпотентны", async () => {
    const { code, creator } = await makeCreator();
    const { user, account } = await referredPlayer(code);
    const ref = await prisma.referral.findUniqueOrThrow({ where: { referredUserId: user.id } });
    expect(ref.status).toBe("PENDING");

    const batch = randomUUID();
    await recordPlaytime(batch, [{ uuid: account!.uuid, name: account!.name, activeSeconds: 3600 }]);
    await recordPlaytime(batch, [{ uuid: account!.uuid, name: account!.name, activeSeconds: 3600 }]); // повтор
    expect((await prisma.minecraftAccount.findUniqueOrThrow({ where: { id: account!.id } })).activePlaytimeSeconds).toBe(3600);
    expect((await prisma.referral.findUniqueOrThrow({ where: { id: ref.id } })).status).toBe("PENDING");

    // за один пакет нельзя «накрутить» больше часа
    await recordPlaytime(randomUUID(), [{ uuid: account!.uuid, name: account!.name, activeSeconds: 99999 }]);
    expect((await prisma.minecraftAccount.findUniqueOrThrow({ where: { id: account!.id } })).activePlaytimeSeconds).toBe(7200);
    await recordPlaytime(randomUUID(), [{ uuid: account!.uuid, name: account!.name, activeSeconds: 3600 }]);

    expect((await prisma.referral.findUniqueOrThrow({ where: { id: ref.id } })).status).toBe("QUALIFIED");
    const bonus = await prisma.commission.findMany({ where: { creatorId: creator.id, type: "ACTIVE_PLAYER_BONUS" } });
    expect(bonus).toHaveLength(1);
    expect(bonus[0].amountKopecks).toBe(DEFAULT_SETTINGS.activePlayerBonusKopecks);
    await evaluateReferral(user.id);
    expect(await prisma.commission.count({ where: { creatorId: creator.id, type: "ACTIVE_PLAYER_BONUS" } })).toBe(1);
  });

  it("фейковые регистрации: тот же IP, что у блогера, и повторно привязанный Minecraft-аккаунт", async () => {
    const { code, user: creatorUser } = await makeCreator();
    const { user } = await makeUser({ ipHash: creatorUser.registrationIpHash! });
    const ref = await prisma.$transaction((tx) => attachReferral(tx, user.id, code, creatorUser.registrationIpHash));
    expect(ref?.status).toBe("REJECTED");
    expect(ref?.rejectReason).toBe("same_ip_as_creator");

    // массовые регистрации с одного IP
    const ip = "ip-farm-" + randomUUID();
    const r1 = await referredPlayer(code, ip);
    const r2 = await referredPlayer(code, ip);
    const r3 = await referredPlayer(code, ip);
    const statuses = await Promise.all([r1, r2, r3].map((r) => prisma.referral.findUniqueOrThrow({ where: { referredUserId: r.user.id } })));
    expect(statuses.map((s) => s.status)).toEqual(["PENDING", "PENDING", "REJECTED"]);
  });

  it("бонусы за достижения 10 активных игроков начисляются один раз", async () => {
    const s = await getSettings();
    await saveSettings({ ...s, milestones: [{ count: 3, bonusKopecks: 50000 }] }, null);
    const { code, creator } = await makeCreator();
    for (let i = 0; i < 4; i++) {
      const { account } = await referredPlayer(code);
      await recordPlaytime(randomUUID(), [{ uuid: account!.uuid, name: account!.name, activeSeconds: 3600 }]);
      await recordPlaytime(randomUUID(), [{ uuid: account!.uuid, name: account!.name, activeSeconds: 3600 }]);
      await recordPlaytime(randomUUID(), [{ uuid: account!.uuid, name: account!.name, activeSeconds: 3600 }]);
    }
    const m = await prisma.commission.findMany({ where: { creatorId: creator.id, type: "MILESTONE_BONUS" } });
    expect(m).toHaveLength(1);
    expect(m[0].amountKopecks).toBe(50000);
    await saveSettings(DEFAULT_SETTINGS, null);
  });

  it("уровни блогеров по сумме продаж за месяц", () => {
    expect(tierFor(0, DEFAULT_SETTINGS)).toBe("BRONZE");
    expect(tierFor(300000, DEFAULT_SETTINGS)).toBe("SILVER");
    expect(tierFor(1500000, DEFAULT_SETTINGS)).toBe("GOLD");
    expect(tierFor(9_999_999, DEFAULT_SETTINGS)).toBe("DIAMOND");
  });

  it("заявка блогера → одобрение → промокод и роль CREATOR", async () => {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    const { user } = await makeUser();
    const app = await submitApplication(user.id, { displayName: "Super Stream", platform: "twitch", channelUrl: "https://twitch.tv/super", audience: 1200, message: "" });
    await expect(submitApplication(user.id, { displayName: "x", platform: "twitch", channelUrl: "https://twitch.tv/x", audience: 1, message: "" })).rejects.toMatchObject({ code: "application_pending" });
    const res = await approveApplication(app.id, admin.id, { code: "superstream" });
    expect(res.code).toBe("SUPERSTREAM");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe("CREATOR");
    await expect(approveApplication(app.id, admin.id, {})).rejects.toMatchObject({ code: "not_pending" });
  });
});

describe("выплаты", () => {
  it("запрос, одобрение, выплата; защита от повторной выплаты и изменения истории", async () => {
    const { code, creator, admin } = await makeCreator();
    // 10 продаж по 179,10 ₽ → 10 × 44,77 = 447,70 ₽
    for (let i = 0; i < 12; i++) {
      const { user } = await makeUser();
      const o = await createOrder(user.id, { productSlug: "kryvanta-vip", code });
      await payOrder(o.purchaseId);
    }
    let bal = await creatorBalance(creator.id);
    expect(bal.hold).toBe(12 * 4477);
    expect(bal.available).toBe(0);
    await expect(requestPayout(creator.id, creator.userId, { amountKopecks: 50000, method: "card", details: "2200..." })).rejects.toMatchObject({ code: "insufficient" });

    // срок заморозки прошёл
    await prisma.$executeRaw`UPDATE commissions SET "availableAt" = now() - interval '1 minute' WHERE "creatorId" = ${creator.id}::uuid`;
    await releaseHolds();
    bal = await creatorBalance(creator.id);
    expect(bal.available).toBe(12 * 4477);

    await expect(requestPayout(creator.id, creator.userId, { amountKopecks: 1000, method: "card", details: "x" })).rejects.toMatchObject({ code: "below_min" });
    const [a, b] = await Promise.allSettled([
      requestPayout(creator.id, creator.userId, { amountKopecks: 50000, method: "card", details: "2200 0000 0000 0000" }),
      requestPayout(creator.id, creator.userId, { amountKopecks: 50000, method: "card", details: "2200 0000 0000 0000" }),
    ]);
    expect([a.status, b.status].sort()).toEqual(["fulfilled", "rejected"]);
    const req = (a.status === "fulfilled" ? a.value : (b as PromiseFulfilledResult<Awaited<ReturnType<typeof requestPayout>>>).value);
    expect((await creatorBalance(creator.id)).available).toBe(12 * 4477 - 50000);

    await expect(transitionPayout(req.id, admin.id, { action: "paid", externalTxnId: "T1" })).rejects.toMatchObject({ code: "invalid_transition" });
    await transitionPayout(req.id, admin.id, { action: "approve", comment: "ok" });
    const paid = await transitionPayout(req.id, admin.id, { action: "paid", externalTxnId: "BANK-" + req.id });
    expect(paid.status).toBe("PAID");
    await expect(transitionPayout(req.id, admin.id, { action: "paid", externalTxnId: "BANK-2" })).rejects.toMatchObject({ code: "invalid_transition" });
    await expect(transitionPayout(req.id, admin.id, { action: "reject" })).rejects.toMatchObject({ code: "invalid_transition" });

    bal = await creatorBalance(creator.id);
    expect(bal.paid).toBe(50000);
    expect(bal.available).toBe(12 * 4477 - 50000);

    // Админ не может «тихо» поменять выплаченную заявку или историю — запрещено триггерами БД
    await expect(prisma.payoutRequest.update({ where: { id: req.id }, data: { amountKopecks: 1 } })).rejects.toThrow(/final/);
    const h = await prisma.payoutHistory.findFirstOrThrow({ where: { payoutRequestId: req.id } });
    await expect(prisma.payoutHistory.delete({ where: { id: h.id } })).rejects.toThrow(/append-only/);
    expect(await prisma.payoutHistory.count({ where: { payoutRequestId: req.id } })).toBe(3);

    // Корректировки — только новой записью с журналом
    await adjustBalance(creator.id, admin.id, -1000, "Исправление");
    expect((await creatorBalance(creator.id)).available).toBe(12 * 4477 - 50000 - 1000);
    expect(await prisma.auditLog.count({ where: { action: "commission.adjust", entityId: creator.id } })).toBe(1);
  });
});
