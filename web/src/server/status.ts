import { prisma } from "@/lib/db";

/** Онлайн по heartbeat-у плагина (плагин присылает его при каждой синхронизации). */
export async function serverStatus() {
  const s = await prisma.serverStatus.findUnique({ where: { id: 1 } });
  const fresh = !!s && Date.now() - s.heartbeatAt.getTime() < 120_000;
  return { known: !!s && s.heartbeatAt.getTime() > 0, up: fresh, online: s?.online ?? 0, max: s?.maxPlayers ?? 0, lastSeen: s?.heartbeatAt ?? null };
}
