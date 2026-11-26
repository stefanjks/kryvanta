import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

export const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
export const hmacHex = (secret: string, s: string | Buffer) => createHmac("sha256", secret).update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Хэш с солью приложения — для IP-адресов, токенов сессий и одноразовых кодов. */
export const keyedHash = (s: string) => hmacHex(env.appSecret, s);

export function safeEqualHex(a: string, b: string) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/** Код привязки для /link: 8 символов без похожих букв. */
export function linkCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}
