import { describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { ackDeliveries, handleSync, signRequest, verifyPluginRequest } from "@/server/plugin";
import { createLinkCode, confirmLink } from "@/server/users";
import { extendVip } from "@/server/vip";
import { makeUser } from "./helpers";

function signed(path: string, body: string, opts: { secret?: string; ts?: number; nonce?: string } = {}) {
  const ts = String(opts.ts ?? Math.floor(Date.now() / 1000));
  const nonce = opts.nonce ?? randomBytes(16).toString("hex");
  const sig = signRequest(opts.secret ?? "test-plugin-secret", ts, nonce, "POST", path, body);
  return new Request("http://localhost:3000" + path, {
    method: "POST",
    body,
    headers: { "x-kry-timestamp": ts, "x-kry-nonce": nonce, "x-kry-signature": sig, "content-type": "application/json" },
  });
}

describe("API плагина", () => {
  it("принимает корректную подпись и отклоняет чужой ключ, старый timestamp и повтор", async () => {
    const body = JSON.stringify({ a: 1 });
    const ok = signed("/api/plugin/sync", body);
    await expect(verifyPluginRequest(ok, body)).resolves.toBeTruthy();
    await expect(verifyPluginRequest(ok.clone() as Request, body)).rejects.toMatchObject({ code: "replay" });
    await expect(verifyPluginRequest(signed("/api/plugin/sync", body, { secret: "wrong" }), body)).rejects.toMatchObject({ code: "bad_signature" });
    await expect(verifyPluginRequest(signed("/api/plugin/sync", body, { ts: Date.now() / 1000 - 3600 }), body)).rejects.toMatchObject({ code: "bad_timestamp" });
    // подмена тела
    await expect(verifyPluginRequest(signed("/api/plugin/sync", body), '{"a":2}')).rejects.toMatchObject({ code: "bad_signature" });
  });

  it("синхронизация отдаёт активных VIP, конфигурацию и очередь доставок; подтверждённые доставки не повторяются", async () => {
    const { account } = await makeUser();
    await prisma.$transaction((tx) => extendVip(tx, account!.id, 30, { action: "MANUAL_GRANT" }));
    const s1 = await handleSync({ online: 3, max: 100, players: [] });
    expect(s1.vips.some((v) => v.uuid === account!.uuid)).toBe(true);
    expect(s1.config.features.size).toBe(true);
    expect(s1.config.vip.rewardIntervalSeconds).toBe(10800);
    expect(s1.config.rewards.map((r) => r.key)).toContain("common");
    const mine = s1.deliveries.filter((d) => d.uuid === account!.uuid);
    expect(mine.length).toBeGreaterThan(0);
    await ackDeliveries(mine.map((d) => d.id));
    const s2 = await handleSync({ online: 3, max: 100, players: [] });
    expect(s2.deliveries.filter((d) => d.uuid === account!.uuid)).toHaveLength(0);
    expect((await prisma.serverStatus.findUniqueOrThrow({ where: { id: 1 } })).online).toBe(3);
  });
});

describe("привязка Minecraft-аккаунта через /link", () => {
  it("одноразовый код подтверждает владение аккаунтом", async () => {
    const { user } = await makeUser({ linked: false });
    const { code } = await createLinkCode(user.id);
    const uuid = randomUUID();
    await expect(confirmLink({ code: "WRONG123", uuid, name: "Steve_1" })).rejects.toMatchObject({ code: "invalid_code" });
    const r = await confirmLink({ code: code.toLowerCase(), uuid, name: "Steve_1" });
    expect(r.userId).toBe(user.id);
    expect((await prisma.minecraftAccount.findUniqueOrThrow({ where: { userId: user.id } })).uuid).toBe(uuid);
    // повторное использование кода
    await expect(confirmLink({ code, uuid: randomUUID(), name: "Alex_2" })).rejects.toMatchObject({ code: "invalid_code" });
  });

  it("истёкший код и чужой UUID", async () => {
    const { user } = await makeUser({ linked: false });
    const { code } = await createLinkCode(user.id);
    await prisma.linkCode.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(confirmLink({ code, uuid: randomUUID(), name: "Late_1" })).rejects.toMatchObject({ code: "invalid_code" });

    const { account: other } = await makeUser();
    const { code: c2 } = await createLinkCode(user.id);
    await expect(confirmLink({ code: c2, uuid: other!.uuid, name: "Thief" })).rejects.toMatchObject({ code: "uuid_taken" });
  });
});
