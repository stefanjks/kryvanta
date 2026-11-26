import { z } from "zod";
import { prisma, type Tx } from "./db";

export const settingsSchema = z.object({
  /** Стандартная комиссия блогера (bps): 2500 = 25% */
  commissionBps: z.number().int().min(0).max(9000),
  /** Скидка по промокоду по умолчанию (bps): 1000 = 10% */
  discountBps: z.number().int().min(0).max(9000),
  /** Сколько дней комиссия «замораживается» до доступности к выводу (защита от возвратов) */
  holdDays: z.number().int().min(0).max(90),
  /** Бонус за активного приглашённого игрока, копейки */
  activePlayerBonusKopecks: z.number().int().min(0),
  /** Сколько секунд активной игры нужно, чтобы игрок считался активным */
  activePlayerMinSeconds: z.number().int().min(60),
  /** Бонусные достижения по числу активных игроков */
  milestones: z.array(z.object({ count: z.number().int().min(1), bonusKopecks: z.number().int().min(0) })).max(20),
  /** Пороги уровней блогеров по сумме продаж за календарный месяц, копейки */
  tierThresholds: z.object({ SILVER: z.number().int().min(0), GOLD: z.number().int().min(0), DIAMOND: z.number().int().min(0) }),
  /** Надбавка к комиссии за уровень (bps), добавляется к стандартной ставке. Индивидуальная ставка блогера её заменяет. */
  tierBonusBps: z.object({ BRONZE: z.number().int(), SILVER: z.number().int(), GOLD: z.number().int(), DIAMOND: z.number().int() }),
  /** Минимальная сумма выплаты, копейки */
  minPayoutKopecks: z.number().int().min(0),
  vip: z.object({
    allowedScales: z.array(z.number().min(0.1).max(4)).min(1),
    /** Максимальная горизонтальная скорость лодки (блоков/тик) для уровней I, II, III */
    boatMaxSpeeds: z.array(z.number().min(0.1).max(1.5)).length(3),
    /** Сбрасывать размер до 1.0 на время PvP-боя */
    combatNormalizeScale: z.boolean(),
    rewardsEnabled: z.boolean(),
    rewardIntervalSeconds: z.number().int().min(600),
    maxStoredRewards: z.number().int().min(1).max(10),
    afkTimeoutSeconds: z.number().int().min(30).max(1800),
    prefix: z.string().max(64),
  }),
});
export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  commissionBps: 2500,
  discountBps: 1000,
  holdDays: 7,
  activePlayerBonusKopecks: 2000,
  activePlayerMinSeconds: 3 * 3600,
  milestones: [
    { count: 10, bonusKopecks: 20000 },
    { count: 25, bonusKopecks: 60000 },
    { count: 50, bonusKopecks: 150000 },
    { count: 100, bonusKopecks: 400000 },
  ],
  tierThresholds: { SILVER: 300000, GOLD: 1500000, DIAMOND: 5000000 },
  tierBonusBps: { BRONZE: 0, SILVER: 0, GOLD: 0, DIAMOND: 0 },
  minPayoutKopecks: 50000,
  vip: {
    allowedScales: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0],
    boatMaxSpeeds: [0.5, 0.6, 0.7],
    combatNormalizeScale: true,
    rewardsEnabled: true,
    rewardIntervalSeconds: 3 * 3600,
    maxStoredRewards: 3,
    afkTimeoutSeconds: 180,
    prefix: "&#d4af37&l✦ VIP",
  },
};

const KEY = "main";

export async function getSettings(tx: Tx = prisma): Promise<Settings> {
  const row = await tx.setting.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULT_SETTINGS;
  const merged = { ...DEFAULT_SETTINGS, ...(row.value as object), vip: { ...DEFAULT_SETTINGS.vip, ...((row.value as { vip?: object }).vip ?? {}) } };
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function saveSettings(next: Settings, actorUserId: string | null, tx: Tx = prisma) {
  const value = settingsSchema.parse(next);
  await tx.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value, updatedBy: actorUserId },
    update: { value, updatedBy: actorUserId },
  });
  return value;
}
