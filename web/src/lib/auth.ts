import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import type { Role, User } from "@prisma/client";
import { prisma } from "./db";
import { keyedHash, randomToken } from "./crypto";
import { env } from "./env";
import { forbidden, unauthorized } from "./errors";

export const SESSION_COOKIE = "kry_session";
const SESSION_DAYS = 30;

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export type SessionUser = Pick<User, "id" | "email" | "username" | "role" | "locale" | "isBlocked">;

export async function createSession(userId: string, meta: { ipHash?: string; userAgent?: string } = {}) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await prisma.session.create({
    data: { tokenHash: keyedHash("session:" + token), userId, expiresAt, ipHash: meta.ipHash, userAgent: meta.userAgent?.slice(0, 200) },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: keyedHash("session:" + token) } });
  jar.delete(SESSION_COOKIE);
}

export async function userFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const s = await prisma.session.findUnique({
    where: { tokenHash: keyedHash("session:" + token) },
    include: { user: { select: { id: true, email: true, username: true, role: true, locale: true, isBlocked: true } } },
  });
  if (!s || s.expiresAt < new Date() || s.user.isBlocked) return null;
  return s.user;
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw unauthorized();
  return u;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) throw forbidden();
  return u;
}

export const requireAdmin = () => requireRole("ADMIN");
