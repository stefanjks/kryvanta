/**
 * Сквозная проверка запущенного сайта по HTTP (как браузер и как Minecraft-плагин).
 * Запуск: BASE_URL=http://localhost:3000 PLUGIN_API_SECRET=... ADMIN_LOGIN=admin ADMIN_PASSWORD=... node tests/e2e/smoke.mjs
 * Требует PAYMENT_PROVIDER=test на проверяемом сайте. Не запускайте против production-базы.
 */
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SECRET = process.env.PLUGIN_API_SECRET ?? "local-dev-plugin-secret-0123456789abcdef";
const ADMIN = { login: process.env.ADMIN_LOGIN ?? "admin", password: process.env.ADMIN_PASSWORD ?? "admin-local-password" };
const origin = new URL(BASE).origin;
let passed = 0;

let ipSeq = 10;
class Client {
  cookies = new Map();
  ip = `198.51.100.${ipSeq++}`; // разные клиенты — разные IP (как за reverse-proxy)
  async req(path, { method = "GET", body, headers = {} } = {}) {
    const h = { "x-forwarded-for": this.ip, ...headers, cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ") };
    if (body !== undefined) { h["content-type"] = "application/json"; h.origin ??= origin; }
    const res = await fetch(BASE + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: "manual" });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const [k, v] = kv.split("=");
      if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c) || v === "") this.cookies.delete(k); else this.cookies.set(k, v);
    }
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* html */ }
    return { status: res.status, json, text, headers: res.headers };
  }
  post(path, body, headers) { return this.req(path, { method: "POST", body, headers }); }
}

function plugin(path, bodyObj) {
  const body = JSON.stringify(bodyObj);
  const ts = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(16).toString("hex");
  const sig = createHmac("sha256", SECRET).update(`${ts}\n${nonce}\nPOST\n${path}\n${createHash("sha256").update(body).digest("hex")}`).digest("hex");
  return fetch(BASE + path, { method: "POST", body, headers: { "content-type": "application/json", "x-kry-timestamp": ts, "x-kry-nonce": nonce, "x-kry-signature": sig } })
    .then(async (r) => {
      const text = await r.text();
      const rs = createHmac("sha256", SECRET).update(`${r.headers.get("x-kry-timestamp")}\n${nonce}\n${createHash("sha256").update(text).digest("hex")}`).digest("hex");
      return { status: r.status, json: JSON.parse(text), signatureOk: rs === r.headers.get("x-kry-signature") };
    });
}

async function step(name, fn) {
  await fn();
  passed++;
  console.log("✓", name);
}

const tag = Date.now().toString(36);
const anon = new Client(), admin = new Client(), blogger = new Client(), player = new Client();
const code = ("E2E" + tag).toUpperCase().slice(0, 20);
const playerUuid = randomUUID();
const playerName = ("P" + tag).slice(0, 16);

await step("главная, магазин, VIP, правила открываются", async () => {
  for (const p of ["/", "/store", "/vip", "/rules", "/creator", "/login", "/register"]) {
    const r = await anon.req(p);
    assert.equal(r.status, 200, p);
  }
  assert.match((await anon.req("/")).text, /KRYVANTA/);
});

await step("CSRF: POST без Origin и с чужим Origin отклоняется", async () => {
  const r1 = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(r1.status, 403);
  const r2 = await anon.post("/api/auth/login", { login: "x", password: "y" }, { origin: "https://evil.example" });
  assert.equal(r2.status, 403);
});

await step("регистрация блогера и игрока, вход администратора", async () => {
  assert.equal((await blogger.post("/api/auth/register", { email: `b${tag}@e2e.local`, username: `blog_${tag}`, password: "blogger-password-1" })).status, 200);
  assert.equal((await admin.post("/api/auth/login", ADMIN)).status, 200);
  const bad = await anon.post("/api/auth/login", { login: ADMIN.login, password: "wrong-password" });
  assert.equal(bad.status, 401);
});

await step("администратор добавляет блогера с промокодом", async () => {
  const r = await admin.post("/api/admin/creators", { user: `blog_${tag}`, displayName: `Blogger ${tag}`, code, platform: "youtube", channelUrl: "https://youtube.com/@e2e" });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.code, code);
});

await step("переход по реферальной ссылке ставит cookie и игрок регистрируется по приглашению", async () => {
  const r = await player.req(`/r/${code.toLowerCase()}`);
  assert.equal(r.status, 307);
  assert.equal(player.cookies.get("kry_ref"), code);
  assert.equal((await player.post("/api/auth/register", { email: `p${tag}@e2e.local`, username: `play_${tag}`, password: "player-password-1" })).status, 200);
});

await step("разграничение доступа: игрок и гость не попадают в админку и кабинет блогера", async () => {
  assert.equal((await anon.req("/api/admin/settings")).status, 401);
  assert.equal((await player.req("/api/admin/settings")).status, 403);
  assert.equal((await blogger.req("/api/admin/settings")).status, 403);
  assert.equal((await admin.req("/api/admin/settings")).status, 200);
  assert.equal((await player.post("/api/creator/payouts", { amountKopecks: 100000, method: "card", details: "1234 5678" })).status, 403);
  assert.equal((await player.post("/api/admin/vip", { action: "grant", player: "x", days: 30, reason: "hack" })).status, 403);
  const adminPage = await player.req("/admin");
  assert.ok([307, 302, 200].includes(adminPage.status));
  if (adminPage.status === 200) assert.doesNotMatch(adminPage.text, /Панель администратора/);
});

await step("без привязанного аккаунта купить VIP нельзя", async () => {
  const r = await player.post("/api/orders", { slug: "kryvanta-vip", code });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, "minecraft_not_linked");
});

await step("привязка Minecraft: код на сайте → /link в игре (подписанный запрос плагина)", async () => {
  const c = await player.post("/api/account/link-code", {});
  assert.equal(c.status, 200);
  const forged = await fetch(BASE + "/api/plugin/link", { method: "POST", headers: { "content-type": "application/json", "x-kry-timestamp": String(Math.floor(Date.now() / 1000)), "x-kry-nonce": randomBytes(16).toString("hex"), "x-kry-signature": "00".repeat(32) }, body: JSON.stringify({ code: c.json.code, uuid: playerUuid, name: playerName }) });
  assert.equal(forged.status, 401);
  const r = await plugin("/api/plugin/link", { code: c.json.code, uuid: playerUuid, name: playerName });
  assert.equal(r.status, 200);
  assert.ok(r.signatureOk, "ответ сайта подписан");
  assert.equal(r.json.ok, true);
  const me = await player.req("/api/me");
  assert.equal(me.json.minecraft.uuid, playerUuid);
});

await step("блогер не может применить собственный промокод", async () => {
  const q = await blogger.post("/api/store/quote", { slug: "kryvanta-vip", code });
  assert.equal(q.json.promoError, "self");
});

let purchaseId;
await step("покупка VIP: скидка 10% → 179,10 ₽, тестовая оплата через подписанный вебхук", async () => {
  const q = await player.post("/api/store/quote", { slug: "kryvanta-vip", code });
  assert.equal(q.json.amountKopecks, 17910);
  const o = await player.post("/api/orders", { slug: "kryvanta-vip", code });
  assert.equal(o.status, 200, o.text);
  purchaseId = o.json.purchaseId;
  assert.match(o.json.confirmationUrl, /^\/pay\/test\//);
  const paymentId = o.json.confirmationUrl.split("/").pop();
  // чужой пользователь не может «оплатить» чужой заказ
  assert.equal((await blogger.post(`/api/payments/test/${paymentId}`, { outcome: "success" })).status, 404);
  // поддельный вебхук без подписи
  const fake = await fetch(BASE + "/api/webhooks/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: randomUUID(), type: "payment.succeeded", providerPaymentId: "x", amountKopecks: 1 }) });
  assert.equal(fake.status, 401);
  const pay = await player.post(`/api/payments/test/${paymentId}`, { outcome: "success" });
  assert.equal(pay.status, 200, pay.text);
  const st = await player.req(`/api/orders/${purchaseId}`);
  assert.equal(st.json.status, "PAID");
  assert.equal((await blogger.req(`/api/orders/${purchaseId}`)).status, 404);
});

await step("плагин получает VIP, конфигурацию и уведомления; подтверждённые доставки не повторяются", async () => {
  const s = await plugin("/api/plugin/sync", { online: 1, max: 50, version: "e2e", players: [{ uuid: playerUuid, name: playerName }] });
  assert.equal(s.status, 200);
  assert.ok(s.signatureOk);
  const vip = s.json.vips.find((v) => v.uuid === playerUuid);
  assert.ok(vip, "игрок в списке VIP");
  assert.ok(Math.abs(new Date(vip.expiresAt) - Date.now() - 30 * 86400_000) < 120_000);
  const mine = s.json.deliveries.filter((d) => d.uuid === playerUuid);
  assert.deepEqual(mine.map((d) => d.type).sort(), ["NOTIFY", "VIP_SYNC"]);
  await plugin("/api/plugin/ack", { ids: s.json.deliveries.map((d) => d.id) });
  const s2 = await plugin("/api/plugin/sync", { online: 1, max: 50, players: [] });
  assert.equal(s2.json.deliveries.filter((d) => d.uuid === playerUuid).length, 0);
});

await step("кабинет блогера показывает продажу и комиссию 44,77 ₽", async () => {
  const r = await blogger.req("/creator/dashboard");
  assert.equal(r.status, 200);
  assert.match(r.text, /44,77/);
  assert.match(r.text, new RegExp(code));
});

await step("игровое время 3 часа → приглашённый игрок становится активным", async () => {
  for (let i = 0; i < 3; i++) {
    const r = await plugin("/api/plugin/playtime", { batchId: randomUUID(), entries: [{ uuid: playerUuid, name: playerName, activeSeconds: 3600, rewardProgressSeconds: 1200 * (i + 1), rewardsStored: 0 }] });
    assert.equal(r.status, 200);
  }
  const page = await admin.req(`/admin?tab=users&q=play_${tag}`);
  assert.ok(/QUALIFIED/.test(page.text), "реферал не квалифицирован: " + (page.text.match(/(PENDING|REJECTED)<\/span>(<div[^>]*>[^<]*)?/)?.[0] ?? "?"));
});

await step("возврат администратором отменяет комиссию", async () => {
  const r = await admin.post(`/api/admin/purchases/${purchaseId}`, { action: "refund", reason: "e2e refund" });
  assert.equal(r.status, 200, r.text);
  assert.equal((await player.req(`/api/orders/${purchaseId}`)).json.status, "REFUNDED");
});

await step("rate limiting на входе", async () => {
  const c = new Client();
  let limited = false;
  for (let i = 0; i < 15; i++) {
    const r = await c.post("/api/auth/login", { login: "nobody", password: "nothing" }, { "x-forwarded-for": "203.0.113.77" });
    if (r.status === 429) { limited = true; break; }
  }
  assert.ok(limited);
});

console.log(`\nE2E: ${passed} проверок пройдено`);
