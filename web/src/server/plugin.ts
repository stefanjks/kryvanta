import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { hmacHex, safeEqualHex, sha256 } from "@/lib/crypto";
import { ApiError } from "@/lib/errors";
import { getSettings } from "@/lib/settings";
import { activeVips, expireDueSubscriptions } from "./vip";
import { evaluateReferral } from "./referrals";

/**
 * Подпись запросов плагина:
 *   X-Kry-Timestamp: unix seconds, X-Kry-Nonce: случайная строка,
 *   X-Kry-Signature: hex(HMAC_SHA256(secret, ts + "\n" + nonce + "\n" + METHOD + "\n" + path + "\n" + sha256hex(body)))
 * Ответ подписывается так же: X-Kry-Signature = hex(HMAC_SHA256(secret, ts + "\n" + nonce + "\n" + sha256hex(body))).
 * Секрет никогда не передаётся по сети и не попадает в клиентский код сайта.
 */
export function signRequest(secret: string, ts: string, nonce: string, method: string, path: string, body: string) {
  return hmacHex(secret, `${ts}\n${nonce}\n${method.toUpperCase()}\n${path}\n${sha256(body)}`);
}

export async function verifyPluginRequest(req: Request, body: string) {
  const ts = req.headers.get("x-kry-timestamp") || "";
  const nonce = req.headers.get("x-kry-nonce") || "";
  const sig = req.headers.get("x-kry-signature") || "";
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > 300) throw new ApiError(401, "bad_timestamp");
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(nonce)) throw new ApiError(401, "bad_nonce");
  const path = new URL(req.url).pathname;
  const expected = signRequest(env.pluginSecret, ts, nonce, req.method, path, body);
  if (!safeEqualHex(expected, sig)) throw new ApiError(401, "bad_signature");
  try {
    await prisma.apiNonce.create({ data: { nonce } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ApiError(401, "replay");
    throw e;
  }
  if (Math.random() < 0.02) await prisma.apiNonce.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 3600_000) } } });
  return { nonce, ts };
}

export function signedJson(data: unknown, nonce: string, status = 200) {
  const body = JSON.stringify(data);
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = hmacHex(env.pluginSecret, `${ts}\n${nonce}\n${sha256(body)}`);
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json", "X-Kry-Timestamp": ts, "X-Kry-Signature": sig, "Cache-Control": "no-store" },
  });
}

/** Конфигурация VIP для плагина: настройки, разрешённые функции, наборы наград. */
export async function pluginConfig() {
  const [s, perms, rewards] = await Promise.all([
    getSettings(),
    prisma.vipPermission.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.vipReward.findMany({ where: { enabled: true } }),
  ]);
  return {
    vip: s.vip,
    features: Object.fromEntries(perms.map((p) => [p.key, p.enabled])),
    rewards: rewards.map((r) => ({ key: r.key, nameRu: r.nameRu, nameEn: r.nameEn, tier: r.tier, weight: r.weight, items: r.items })),
  };
}

export async function handleSync(input: { online: number; max: number; version?: string; players: { uuid: string; name: string }[] }) {
  await expireDueSubscriptions();
  await prisma.serverStatus.upsert({
    where: { id: 1 },
    create: { id: 1, online: input.online, maxPlayers: input.max, version: input.version, heartbeatAt: new Date() },
    update: { online: input.online, maxPlayers: input.max, version: input.version, heartbeatAt: new Date() },
  });
  // Обновляем ники привязанных аккаунтов (смена ника в Minecraft)
  for (const p of input.players.slice(0, 500)) {
    await prisma.minecraftAccount.updateMany({ where: { uuid: p.uuid.toLowerCase(), NOT: { name: p.name } }, data: { name: p.name } });
  }
  const [vips, deliveries, config] = await Promise.all([
    activeVips(),
    prisma.pluginDelivery.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 200 }),
    pluginConfig(),
  ]);
  return {
    serverTime: new Date().toISOString(),
    config,
    vips: vips.map((v) => ({ uuid: v.minecraftAccount.uuid, name: v.minecraftAccount.name, expiresAt: v.expiresAt.toISOString() })),
    deliveries: deliveries.map((d) => ({ id: d.id, type: d.type, uuid: d.playerUuid, payload: d.payload })),
  };
}

export async function ackDeliveries(ids: string[]) {
  const r = await prisma.pluginDelivery.updateMany({ where: { id: { in: ids }, status: "PENDING" }, data: { status: "DELIVERED", deliveredAt: new Date() } });
  return r.count;
}

/** Игровое время: пакеты идемпотентны по batchId. Время на одного игрока за пакет ограничено. */
export async function recordPlaytime(batchId: string, entries: { uuid: string; name: string; activeSeconds: number }[]) {
  try {
    await prisma.playtimeBatch.create({ data: { batchId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { duplicate: true, updated: 0 };
    throw e;
  }
  const users: string[] = [];
  for (const e of entries.slice(0, 1000)) {
    const secs = Math.max(0, Math.min(Math.floor(e.activeSeconds), 3600)); // не больше часа на пакет
    if (!secs) continue;
    const acc = await prisma.minecraftAccount.findUnique({ where: { uuid: e.uuid.toLowerCase() } });
    if (!acc) continue;
    await prisma.minecraftAccount.update({ where: { id: acc.id }, data: { activePlaytimeSeconds: { increment: secs }, lastSeenAt: new Date() } });
    users.push(acc.userId);
  }
  for (const u of users) await evaluateReferral(u).catch((err) => console.error("[referral] evaluate", err));
  return { duplicate: false, updated: users.length };
}

export async function recordRewardClaims(claims: { claimId: string; uuid: string; name: string; rewardKey: string; source: string; items: unknown; claimedAt: string }[]) {
  const r = await prisma.rewardHistory.createMany({
    data: claims.slice(0, 500).map((c) => ({
      claimId: c.claimId,
      playerUuid: c.uuid.toLowerCase(),
      playerName: c.name,
      rewardKey: c.rewardKey,
      source: c.source,
      items: c.items as Prisma.InputJsonValue,
      claimedAt: new Date(c.claimedAt),
    })),
    skipDuplicates: true,
  });
  return r.count;
}
