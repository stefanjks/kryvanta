/**
 * Rate limiting (фиксированное окно, в памяти процесса).
 * Для одного инстанса Next.js этого достаточно. При горизонтальном масштабировании
 * замените хранилище на Redis — интерфейс check() останется тем же.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    lastSweep = now;
  }
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  return { ok: b.count <= limit, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
}

export function resetRateLimits() { buckets.clear(); }
