import { z } from "zod";

export const productSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,48}$/),
  type: z.enum(["VIP", "VIP_GIFT", "REWARD_KIT", "COMMANDS"]),
  category: z.string().regex(/^[a-z0-9-]{2,24}$/),
  nameRu: z.string().min(2).max(80),
  nameEn: z.string().min(2).max(80),
  descriptionRu: z.string().max(1000).nullish(),
  descriptionEn: z.string().max(1000).nullish(),
  image: z.string().max(300).refine((s) => s.startsWith("/") || s.startsWith("https://"), "Путь /img/... или https://").nullish(),
  priceKopecks: z.number().int().min(100).max(10_000_000),
  durationDays: z.number().int().min(1).max(3650).nullish(),
  payload: z.record(z.string(), z.unknown()).nullish(),
  featuresRu: z.array(z.string().max(120)).max(20).nullish(),
  featuresEn: z.array(z.string().max(120)).max(20).nullish(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().nullish(),
});
