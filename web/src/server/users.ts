import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { keyedHash, linkCode } from "@/lib/crypto";
import { ApiError, badRequest, conflict } from "@/lib/errors";
import { attachReferral, onMinecraftLinked, evaluateReferral } from "./referrals";

export async function registerUser(input: { email: string; username: string; password: string; refCode?: string | null; ipHash: string; locale: string }) {
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim();
  const exists = await prisma.user.findFirst({
    where: { OR: [{ email }, { username: { equals: username, mode: "insensitive" } }] },
  });
  if (exists) throw conflict("user_exists", "Пользователь с таким email или именем уже существует");
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, username, passwordHash, registrationIpHash: input.ipHash, locale: input.locale === "en" ? "en" : "ru" },
    });
    if (input.refCode) await attachReferral(tx, user.id, input.refCode, input.ipHash);
    await audit({ actorUserId: user.id, actorType: "USER", action: "user.register", entityType: "user", entityId: user.id, ipHash: input.ipHash }, tx);
    return user;
  });
}

export async function authenticate(login: string, password: string) {
  const l = login.trim();
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: l.toLowerCase() }, { username: { equals: l, mode: "insensitive" } }] },
  });
  // Сравнение выполняется всегда, чтобы время ответа не выдавало существование аккаунта
  const ok = await verifyPassword(password, user?.passwordHash ?? "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.2Wn8u8bGQyN6yP1QJ8vN2v3h4b5e");
  if (!user || !ok) throw new ApiError(401, "invalid_credentials", "Неверный логин или пароль");
  if (user.isBlocked) throw new ApiError(403, "blocked", "Аккаунт заблокирован");
  return user;
}

const LINK_TTL_MS = 10 * 60_000;

/** Выдаёт одноразовый код. В игре: /link <код>. */
export async function createLinkCode(userId: string) {
  const acc = await prisma.minecraftAccount.findUnique({ where: { userId } });
  if (acc) throw conflict("already_linked", "Minecraft-аккаунт уже привязан");
  await prisma.linkCode.deleteMany({ where: { userId, usedAt: null } });
  const code = linkCode();
  await prisma.linkCode.create({ data: { userId, codeHash: keyedHash("link:" + code), expiresAt: new Date(Date.now() + LINK_TTL_MS) } });
  return { code, expiresInSeconds: LINK_TTL_MS / 1000 };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;

/** Вызывается плагином: игрок ввёл /link <код> на сервере — значит владеет аккаунтом. */
export async function confirmLink(input: { code: string; uuid: string; name: string }) {
  if (!UUID_RE.test(input.uuid) || !NAME_RE.test(input.name)) throw badRequest("invalid_player");
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(code)) throw badRequest("invalid_code", "Неверный код");
  const result = await prisma.$transaction(async (tx) => {
    const lc = await tx.linkCode.findUnique({ where: { codeHash: keyedHash("link:" + code) } });
    if (!lc || lc.usedAt || lc.expiresAt < new Date()) throw badRequest("invalid_code", "Код недействителен или истёк");
    const used = await tx.linkCode.updateMany({ where: { id: lc.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count === 0) throw badRequest("invalid_code", "Код уже использован");
    const taken = await tx.minecraftAccount.findUnique({ where: { uuid: input.uuid } });
    if (taken) throw conflict("uuid_taken", "Этот Minecraft-аккаунт уже привязан к другому профилю");
    const mine = await tx.minecraftAccount.findUnique({ where: { userId: lc.userId } });
    if (mine) throw conflict("already_linked", "К профилю уже привязан аккаунт");
    const acc = await tx.minecraftAccount.create({ data: { userId: lc.userId, uuid: input.uuid.toLowerCase(), name: input.name } });
    await onMinecraftLinked(tx, lc.userId, acc.uuid);
    const user = await tx.user.findUniqueOrThrow({ where: { id: lc.userId } });
    await tx.notification.create({ data: { userId: lc.userId, title: "Аккаунт привязан", body: `Minecraft-аккаунт ${input.name} привязан к профилю.` } });
    await audit({ actorUserId: lc.userId, actorType: "PLUGIN", action: "minecraft.link", entityType: "minecraft_account", entityId: acc.id, data: { uuid: acc.uuid, name: acc.name } }, tx);
    return { username: user.username, userId: user.id };
  });
  await evaluateReferral(result.userId).catch(() => null);
  return result;
}
