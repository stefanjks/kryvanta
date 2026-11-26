/**
 * Начальные данные KRYVANTA. Безопасно запускать повторно: существующие записи не перезаписываются
 * (изменения, сделанные администрацией, сохраняются).
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const permissions = [
  ["menu", "kryvanta.vip.menu", "Главное VIP-меню (/vip)", "Main VIP menu (/vip)"],
  ["size", "kryvanta.vip.size", "Изменение размера (/size)", "Character size (/size)"],
  ["boat", "kryvanta.vip.boat", "Ускорение лодки (/boat)", "Boat speed (/boat)"],
  ["ec", "kryvanta.vip.ec", "Эндер-сундук (/ec)", "Ender chest (/ec)"],
  ["anvil", "kryvanta.vip.anvil", "Наковальня (/anvil)", "Anvil (/anvil)"],
  ["craft", "kryvanta.vip.craft", "Верстак (/craft)", "Crafting table (/craft)"],
  ["enchant", "kryvanta.vip.enchant", "Стол зачарования (/enchant)", "Enchanting table (/enchant)"],
  ["grindstone", "kryvanta.vip.grindstone", "Точило (/grindstone)", "Grindstone (/grindstone)"],
  ["smithing", "kryvanta.vip.smithing", "Кузнечный стол (/smithing)", "Smithing table (/smithing)"],
  ["loom", "kryvanta.vip.loom", "Ткацкий станок (/loom)", "Loom (/loom)"],
  ["stonecutter", "kryvanta.vip.stonecutter", "Камнерез (/stonecutter)", "Stonecutter (/stonecutter)"],
  ["cartography", "kryvanta.vip.cartography", "Стол картографа (/cartography)", "Cartography table (/cartography)"],
  ["brew", "kryvanta.vip.brew", "Варочная стойка (/brew)", "Brewing stand (/brew)"],
  ["rewards", "kryvanta.vip.rewards", "Награды за игровое время (/viprewards)", "Playtime rewards (/viprewards)"],
  ["settings", "kryvanta.vip.settings", "Настройки VIP (/vipsettings)", "VIP settings (/vipsettings)"],
] as const;

const rewards: { key: string; nameRu: string; nameEn: string; tier: string; weight: number; items: { material: string; amount: number }[] }[] = [
  {
    key: "common", nameRu: "Обычный набор", nameEn: "Common kit", tier: "COMMON", weight: 70,
    items: [
      { material: "IRON_INGOT", amount: 8 }, { material: "COAL", amount: 16 }, { material: "COPPER_INGOT", amount: 12 },
      { material: "BREAD", amount: 8 }, { material: "COBBLESTONE", amount: 32 },
    ],
  },
  {
    key: "rare", nameRu: "Редкий набор", nameEn: "Rare kit", tier: "RARE", weight: 25,
    items: [
      { material: "GOLD_INGOT", amount: 6 }, { material: "LAPIS_LAZULI", amount: 12 }, { material: "REDSTONE", amount: 16 },
      { material: "EXPERIENCE_BOTTLE", amount: 8 },
    ],
  },
  {
    key: "epic", nameRu: "Эпический набор", nameEn: "Epic kit", tier: "EPIC", weight: 5,
    items: [
      { material: "DIAMOND", amount: 2 }, { material: "AMETHYST_SHARD", amount: 8 }, { material: "GOLDEN_APPLE", amount: 1 },
      { material: "FIREWORK_ROCKET", amount: 8 },
    ],
  },
  {
    key: "festive", nameRu: "Праздничный набор (косметика)", nameEn: "Festive kit (cosmetic)", tier: "COSMETIC", weight: 0,
    items: [
      { material: "FIREWORK_ROCKET", amount: 32 }, { material: "WHITE_BANNER", amount: 2 }, { material: "CANDLE", amount: 8 },
      { material: "LANTERN", amount: 4 }, { material: "FLOWER_POT", amount: 4 },
    ],
  },
];

async function main() {
  // --- Администратор ---
  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  if (admins === 0) {
    const email = process.env.SEED_ADMIN_EMAIL;
    const username = process.env.SEED_ADMIN_USERNAME;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !username || !password || password.length < 10) {
      console.warn("! Администратор не создан: укажите SEED_ADMIN_EMAIL, SEED_ADMIN_USERNAME и SEED_ADMIN_PASSWORD (не короче 10 символов)");
    } else {
      await prisma.user.create({ data: { email: email.toLowerCase(), username, passwordHash: await bcrypt.hash(password, 12), role: "ADMIN" } });
      console.log(`✓ Создан администратор ${username}`);
    }
  }

  // --- Товары ---
  const vipFeaturesRu = [
    "Изменение размера персонажа (/size)", "Ускорение лодки (/boat)", "Наковальня, верстак, стол зачарования",
    "Эндер-сундук, точило, кузнечный стол", "Ткацкий станок, камнерез, стол картографа", "Варочная стойка (/brew)",
    "Награды каждые 3 часа активной игры", "VIP-префикс в чате и TAB",
  ];
  const vipFeaturesEn = [
    "Character size (/size)", "Boat speed boost (/boat)", "Anvil, crafting & enchanting table",
    "Ender chest, grindstone, smithing table", "Loom, stonecutter, cartography table", "Brewing stand (/brew)",
    "Rewards every 3 hours of active play", "VIP prefix in chat and TAB",
  ];
  const products: Prisma.ProductCreateInput[] = [
    {
      slug: "kryvanta-vip", type: "VIP", category: "vip", nameRu: "KRYVANTA VIP", nameEn: "KRYVANTA VIP",
      descriptionRu: "Привилегия удобства без Pay-to-Win: никаких боевых преимуществ, только комфорт.",
      descriptionEn: "Convenience perk without Pay-to-Win: no combat advantages, only comfort.",
      image: "/img/vip.svg", priceKopecks: 19900, durationDays: 30, featuresRu: vipFeaturesRu, featuresEn: vipFeaturesEn, sortOrder: 1,
    },
    {
      slug: "kryvanta-vip-gift", type: "VIP_GIFT", category: "gifts", nameRu: "KRYVANTA VIP в подарок", nameEn: "KRYVANTA VIP gift",
      descriptionRu: "Подарите VIP другу. Получатель должен быть зарегистрирован на сайте и привязать Minecraft-аккаунт.",
      descriptionEn: "Gift VIP to a friend. The recipient must be registered and have a linked Minecraft account.",
      image: "/img/gift.svg", priceKopecks: 19900, durationDays: 30, featuresRu: vipFeaturesRu, featuresEn: vipFeaturesEn, sortOrder: 2,
    },
    {
      slug: "festive-kit", type: "REWARD_KIT", category: "cosmetics", nameRu: "Праздничный набор", nameEn: "Festive kit",
      descriptionRu: "Фейерверки, свечи, фонари и флаги для украшения базы. Только косметика.",
      descriptionEn: "Fireworks, candles, lanterns and banners to decorate your base. Cosmetic only.",
      image: "/img/festive.svg", priceKopecks: 4900, durationDays: null, payload: { rewardKey: "festive" },
      featuresRu: ["32 фейерверка", "Свечи и фонари", "Флаги и цветочные горшки", "Забрать в /viprewards"],
      featuresEn: ["32 fireworks", "Candles and lanterns", "Banners and flower pots", "Claim in /viprewards"], sortOrder: 3,
    },
  ];
  for (const p of products) {
    const exists = await prisma.product.findUnique({ where: { slug: p.slug } });
    if (!exists) { await prisma.product.create({ data: p }); console.log(`✓ Товар ${p.slug}`); }
  }

  // --- Возможности VIP ---
  let i = 0;
  for (const [key, permission, labelRu, labelEn] of permissions) {
    await prisma.vipPermission.upsert({ where: { key }, create: { key, permission, labelRu, labelEn, sortOrder: i++ }, update: {} });
  }

  // --- Наборы наград ---
  for (const r of rewards) {
    await prisma.vipReward.upsert({ where: { key: r.key }, create: { ...r, items: r.items }, update: {} });
  }

  await prisma.serverStatus.upsert({ where: { id: 1 }, create: { id: 1, heartbeatAt: new Date(0) }, update: {} });
  console.log("✓ Seed завершён");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
