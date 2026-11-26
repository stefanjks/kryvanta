import { cookies } from "next/headers";

export type Locale = "ru" | "en";

const ru = {
  nav: { home: "Главная", store: "Магазин", vip: "VIP", creators: "Creator Program", rules: "Правила", account: "Кабинет", admin: "Админ", login: "Войти", register: "Регистрация", logout: "Выйти", dashboard: "Кабинет блогера" },
  common: {
    copy: "Скопировать", copied: "Скопировано!", save: "Сохранить", cancel: "Отмена", loading: "Загрузка…", error: "Ошибка", days: "дн.", buy: "Купить",
    status: "Статус", date: "Дата", amount: "Сумма", actions: "Действия", empty: "Пока пусто", yes: "Да", no: "Нет", back: "Назад", total: "Итого", details: "Подробнее", table: "Таблица данных",
  },
  home: {
    tagline: "Честное ванильное выживание без Pay-to-Win",
    subtitle: "Строй, исследуй и торгуй в экономике KRY вместе с сообществом. Никаких боевых привилегий — только удобство.",
    ip: "IP сервера", version: "Версия", online: "Онлайн", offline: "Сервер недоступен", players: "игроков", unknown: "нет данных",
    connect: "Как подключиться", connectSteps: ["Запустите Minecraft Java Edition версии", "Сетевая игра → Добавить сервер", "Вставьте IP (уже скопирован) и нажмите «Готово»"],
    discord: "Discord", storeTitle: "Магазин", storeText: "Привилегии, подарки и косметика. Оплата поддерживает проект.",
    vipTitle: "KRYVANTA VIP", vipText: "Размер персонажа, ускорение лодки, переносные верстаки и награды за игровое время.",
    creatorTitle: "Creator Program", creatorText: "Для блогеров TikTok, YouTube и Twitch: 25% с продаж по вашему промокоду и бонусы за активных игроков.",
    features: [
      ["Без Pay-to-Win", "Никаких бонусов к урону, брони, полёта или бессмертия за деньги."],
      ["Экономика KRY", "Живой рынок между игроками и честные цены."],
      ["Ванильный геймплей", "Привычные механики Minecraft без лишних модов."],
      ["Активная администрация", "Античит, логи и быстрая поддержка в Discord."],
    ],
    rulesTitle: "Правила сервера", rulesText: "Прочитайте перед игрой — это займёт пару минут.",
    play: "Играть",
  },
  vip: {
    title: "KRYVANTA VIP", badge: "Premium Convenience", perMonth: "за 30 дней",
    intro: "VIP — это удобство, а не сила. Привилегия не даёт преимуществ в PvP, полёта, бессмертия, телепортации и админ-команд.",
    sizeTitle: "Изменение размера", sizeText: "Команда /size открывает меню: 0.5x, 0.75x, 1.0x, 1.25x, 1.5x, 2.0x. Хитбокс и камера меняются честно, в PvP-бою размер временно возвращается к 1.0x, увеличение невозможно в тесном месте.",
    boatTitle: "Ускорение лодки", boatText: "Команда /boat: обычная скорость, Ускорение I, II, III. Работает только для лодки, которой управляет VIP, и только на воде.",
    stationsTitle: "Рабочие интерфейсы", stationsText: "Настоящие игровые интерфейсы — предметы не теряются, всё работает как у обычных блоков.",
    stations: [
      ["/anvil", "Наковальня", "Ремонт, объединение и переименование с обычной стоимостью опыта."],
      ["/enchant", "Зачарование", "Полная сила стола — 30 уровней (как 15 полок). Обычный расход опыта и лазурита."],
      ["/ec", "Эндер-сундук", "Ваше личное хранилище."],
      ["/craft", "Верстак", "Крафт без установки блока."],
      ["/grindstone", "Точило", "Снятие зачарований с возвратом опыта."],
      ["/smithing", "Кузнечный стол", "Незеритовые улучшения и отделка брони."],
      ["/loom", "Ткацкий станок", "Узоры на флагах."],
      ["/stonecutter", "Камнерез", "Точная резка камня."],
      ["/cartography", "Стол картографа", "Копирование и расширение карт."],
      ["/brew", "Варочная стойка", "Личная стойка: варка продолжается, даже если закрыть меню."],
    ],
    rewardsTitle: "Награды за игровое время", rewardsText: "Каждые 3 часа активной игры (AFK не считается) VIP получает набор ресурсов. Прогресс сохраняется между сессиями.",
    tiers: [["Обычный", "Железо, уголь, медь, еда, камень"], ["Редкий", "Золото, лазурит, редстоун, бутылочки опыта"], ["Эпический", "Немного алмазов и редкие материалы"]],
    commandsTitle: "Команды", buy: "Купить VIP", extend: "Продлить VIP",
  },
  store: {
    title: "Магазин", subtitle: "Все покупки поддерживают развитие сервера и не дают боевых преимуществ.",
    categories: { vip: "KRYVANTA VIP", privileges: "Привилегии", cosmetics: "Косметика", gifts: "Подарки" } as Record<string, string>,
    duration: "Срок", forever: "Разово", checkout: "Оформление заказа", promo: "Промокод", apply: "Применить", promoOk: "Промокод применён", partner: "Партнёр",
    price: "Цена", discount: "Скидка", total: "К оплате", pay: "Перейти к оплате", giftTo: "Ник получателя (Minecraft или сайт)",
    needLogin: "Войдите, чтобы оформить заказ", needLink: "Привяжите Minecraft-аккаунт в личном кабинете, чтобы купить", testMode: "Тестовый режим оплаты", manualMode: "После оформления заказ подтвердит администратор",
  },
  order: {
    title: "Заказ", pending: "Ожидает оплаты", paid: "Оплачен", cancelled: "Отменён", refunded: "Возврат", failed: "Ошибка оплаты",
    payNow: "Оплатить", cancel: "Отменить заказ", recipient: "Получатель", product: "Товар", manualWait: "Заказ ожидает подтверждения администратором. Статус обновится автоматически.", paidText: "Спасибо! Привилегия будет выдана на сервере в течение минуты.",
  },
  auth: {
    login: "Вход", register: "Регистрация", email: "Email", username: "Имя на сайте", loginField: "Email или имя", password: "Пароль", passwordHint: "Минимум 10 символов",
    submitLogin: "Войти", submitRegister: "Создать аккаунт", noAccount: "Нет аккаунта?", haveAccount: "Уже есть аккаунт?", refApplied: "Вы пришли по приглашению партнёра",
  },
  account: {
    title: "Личный кабинет", minecraft: "Minecraft-аккаунт", notLinked: "Не привязан", link: "Получить код привязки", linkHelp: "Зайдите на сервер и введите команду:", linkExpires: "Код действует 10 минут и подходит только один раз.", linked: "Привязан",
    playtime: "Активное время", vip: "VIP-статус", vipActive: "Активен до", vipNone: "VIP не активен", extend: "Продлить VIP", purchases: "История покупок", promos: "Использованные промокоды", products: "Доступные товары", notifications: "Уведомления",
    creatorCta: "Вы блогер? Подайте заявку в Creator Program",
  },
  creator: {
    title: "KRYVANTA CREATOR PROGRAM", subtitle: "Партнёрская программа для TikTok, YouTube и Twitch",
    perks: [["25% комиссии", "С каждой оплаченной покупки по вашему промокоду (от суммы после скидки)."], ["−10% подписчикам", "Ваша аудитория получает скидку по промокоду."], ["Бонусы за игроков", "Отдельная награда за каждого активного приглашённого игрока и за достижения 10/25/50/100."], ["Уровни партнёров", "Bronze, Silver, Gold и Diamond — по результатам за месяц."]],
    example: "Пример: VIP 199 ₽ → покупатель платит 179,10 ₽ → вы получаете 44,77 ₽.",
    apply: "Подать заявку", displayName: "Название канала / ник", platform: "Платформа", channelUrl: "Ссылка на канал", audience: "Подписчиков", message: "О себе (необязательно)", sent: "Заявка отправлена! Мы ответим в уведомлениях.", loginFirst: "Войдите, чтобы подать заявку", already: "Вы уже участник программы", openDashboard: "Открыть кабинет блогера",
    pending: "Ваша заявка на рассмотрении",
  },
  dash: {
    title: "Кабинет блогера", tier: "Уровень", code: "Промокод", link: "Реферальная ссылка", clicks: "Переходы", invited: "Приглашено", active: "Активные игроки", purchases: "Покупки", sales: "Сумма продаж",
    earned: "Начислено", available: "Доступно", hold: "В заморозке", pendingPayouts: "Выплаты в обработке", paid: "Выплачено",
    sales7: "Продажи за 7 дней", sales30: "Продажи за 30 дней", invitedChart: "Приглашённые игроки (30 дней)", incomeMonthly: "Доход по месяцам",
    ops: "Последние операции", payouts: "История выплат", requestPayout: "Запросить выплату", payoutAmount: "Сумма, ₽", payoutMethod: "Способ", payoutDetails: "Реквизиты", minPayout: "Минимальная сумма",
    types: { SALE: "Продажа", ACTIVE_PLAYER_BONUS: "Бонус: активный игрок", MILESTONE_BONUS: "Бонус: достижение", ADJUSTMENT: "Корректировка" } as Record<string, string>,
    statuses: { HOLD: "Заморозка", AVAILABLE: "Доступно", CANCELLED: "Отменено", PENDING: "Ожидает проверки", APPROVED: "Одобрена", PAID: "Выплачена", REJECTED: "Отклонена" } as Record<string, string>,
    blocked: "Партнёрский аккаунт заблокирован. Свяжитесь с администрацией.",
  },
  rules: {
    title: "Правила сервера",
    items: [
      "Уважайте других игроков. Оскорбления, дискриминация и травля запрещены.",
      "Запрещены читы, X-Ray, макросы, автокликеры и любые моды, дающие нечестное преимущество.",
      "Запрещено использовать баги и дюпы. Найденные ошибки сообщайте администрации — за это положена награда.",
      "Гриферство и воровство на чужих территориях запрещены.",
      "Запрещена реклама сторонних проектов.",
      "Мошенничество в торговле KRY и с реальными деньгами запрещено.",
      "AFK-фермы, обходящие систему активности, запрещены.",
      "Один игрок — один аккаунт в реферальной программе. Мультиаккаунты для накрутки блокируются.",
      "Решения администрации можно обжаловать в Discord.",
    ],
  },
  footer: { rights: "Не является официальным продуктом Minecraft. Не одобрено и не связано с Mojang или Microsoft.", payments: "Оплата и возвраты — по оферте магазина." },
};

export type Dict = typeof ru;

const en: Dict = {
  nav: { home: "Home", store: "Store", vip: "VIP", creators: "Creator Program", rules: "Rules", account: "Account", admin: "Admin", login: "Log in", register: "Sign up", logout: "Log out", dashboard: "Creator dashboard" },
  common: {
    copy: "Copy", copied: "Copied!", save: "Save", cancel: "Cancel", loading: "Loading…", error: "Error", days: "days", buy: "Buy",
    status: "Status", date: "Date", amount: "Amount", actions: "Actions", empty: "Nothing here yet", yes: "Yes", no: "No", back: "Back", total: "Total", details: "Details", table: "Data table",
  },
  home: {
    tagline: "Fair vanilla survival without Pay-to-Win",
    subtitle: "Build, explore and trade in the KRY economy together with the community. No combat perks — only convenience.",
    ip: "Server IP", version: "Version", online: "Online", offline: "Server unavailable", players: "players", unknown: "no data",
    connect: "How to join", connectSteps: ["Launch Minecraft Java Edition version", "Multiplayer → Add Server", "Paste the IP (already copied) and press Done"],
    discord: "Discord", storeTitle: "Store", storeText: "Perks, gifts and cosmetics. Every purchase supports the project.",
    vipTitle: "KRYVANTA VIP", vipText: "Character size, boat speed, portable workstations and playtime rewards.",
    creatorTitle: "Creator Program", creatorText: "For TikTok, YouTube and Twitch creators: 25% of sales with your code plus bonuses for active players.",
    features: [
      ["No Pay-to-Win", "No damage, armor, flight or godmode for money."],
      ["KRY economy", "A living player market and fair prices."],
      ["Vanilla gameplay", "Familiar Minecraft mechanics without extra mods."],
      ["Active staff", "Anti-cheat, logs and fast support in Discord."],
    ],
    rulesTitle: "Server rules", rulesText: "Please read before playing — it takes a couple of minutes.",
    play: "Play",
  },
  vip: {
    title: "KRYVANTA VIP", badge: "Premium Convenience", perMonth: "for 30 days",
    intro: "VIP is convenience, not power. It gives no PvP advantages, flight, godmode, teleportation or admin commands.",
    sizeTitle: "Character size", sizeText: "/size opens a menu: 0.5x, 0.75x, 1.0x, 1.25x, 1.5x, 2.0x. Hitbox and camera change fairly, in PvP combat size temporarily resets to 1.0x, and growing is blocked in tight spaces.",
    boatTitle: "Boat speed", boatText: "/boat: normal speed, Boost I, II, III. Works only for the boat driven by the VIP and only on water.",
    stationsTitle: "Workstations", stationsText: "Real game interfaces — items are never lost, everything works like regular blocks.",
    stations: [
      ["/anvil", "Anvil", "Repair, combine and rename with normal XP cost."],
      ["/enchant", "Enchanting", "Full table power — level 30 (like 15 bookshelves). Normal XP and lapis cost."],
      ["/ec", "Ender chest", "Your personal storage."],
      ["/craft", "Crafting table", "Craft without placing a block."],
      ["/grindstone", "Grindstone", "Remove enchantments and get XP back."],
      ["/smithing", "Smithing table", "Netherite upgrades and armor trims."],
      ["/loom", "Loom", "Banner patterns."],
      ["/stonecutter", "Stonecutter", "Precise stone cutting."],
      ["/cartography", "Cartography table", "Copy and extend maps."],
      ["/brew", "Brewing stand", "Personal stand: brewing continues even when the menu is closed."],
    ],
    rewardsTitle: "Playtime rewards", rewardsText: "Every 3 hours of active play (AFK doesn't count) VIP gets a resource kit. Progress is saved between sessions.",
    tiers: [["Common", "Iron, coal, copper, food, stone"], ["Rare", "Gold, lapis, redstone, XP bottles"], ["Epic", "A few diamonds and rare materials"]],
    commandsTitle: "Commands", buy: "Buy VIP", extend: "Extend VIP",
  },
  store: {
    title: "Store", subtitle: "All purchases support the server and give no combat advantage.",
    categories: { vip: "KRYVANTA VIP", privileges: "Perks", cosmetics: "Cosmetics", gifts: "Gifts" },
    duration: "Duration", forever: "One-time", checkout: "Checkout", promo: "Promo code", apply: "Apply", promoOk: "Promo code applied", partner: "Partner",
    price: "Price", discount: "Discount", total: "Total", pay: "Proceed to payment", giftTo: "Recipient nickname (Minecraft or site)",
    needLogin: "Log in to place an order", needLink: "Link your Minecraft account in your account page to buy", testMode: "Test payment mode", manualMode: "An administrator will confirm the order",
  },
  order: {
    title: "Order", pending: "Awaiting payment", paid: "Paid", cancelled: "Cancelled", refunded: "Refunded", failed: "Payment failed",
    payNow: "Pay", cancel: "Cancel order", recipient: "Recipient", product: "Product", manualWait: "The order is waiting for administrator confirmation. Status updates automatically.", paidText: "Thank you! The perk will be applied on the server within a minute.",
  },
  auth: {
    login: "Log in", register: "Sign up", email: "Email", username: "Site username", loginField: "Email or username", password: "Password", passwordHint: "At least 10 characters",
    submitLogin: "Log in", submitRegister: "Create account", noAccount: "No account?", haveAccount: "Already registered?", refApplied: "You were invited by a partner",
  },
  account: {
    title: "My account", minecraft: "Minecraft account", notLinked: "Not linked", link: "Get link code", linkHelp: "Join the server and type:", linkExpires: "The code is valid for 10 minutes and works only once.", linked: "Linked",
    playtime: "Active playtime", vip: "VIP status", vipActive: "Active until", vipNone: "VIP is not active", extend: "Extend VIP", purchases: "Purchase history", promos: "Used promo codes", products: "Available products", notifications: "Notifications",
    creatorCta: "Are you a creator? Apply to the Creator Program",
  },
  creator: {
    title: "KRYVANTA CREATOR PROGRAM", subtitle: "Partner program for TikTok, YouTube and Twitch",
    perks: [["25% commission", "From every paid purchase with your code (from the discounted amount)."], ["−10% for viewers", "Your audience gets a discount with your code."], ["Player bonuses", "Extra reward for every active invited player and milestones 10/25/50/100."], ["Partner tiers", "Bronze, Silver, Gold and Diamond — based on monthly results."]],
    example: "Example: VIP 199 ₽ → buyer pays 179.10 ₽ → you earn 44.77 ₽.",
    apply: "Apply", displayName: "Channel name / nickname", platform: "Platform", channelUrl: "Channel URL", audience: "Followers", message: "About you (optional)", sent: "Application sent! We'll reply in notifications.", loginFirst: "Log in to apply", already: "You're already a partner", openDashboard: "Open creator dashboard",
    pending: "Your application is under review",
  },
  dash: {
    title: "Creator dashboard", tier: "Tier", code: "Promo code", link: "Referral link", clicks: "Clicks", invited: "Invited", active: "Active players", purchases: "Purchases", sales: "Total sales",
    earned: "Earned", available: "Available", hold: "On hold", pendingPayouts: "Payouts in progress", paid: "Paid out",
    sales7: "Sales, last 7 days", sales30: "Sales, last 30 days", invitedChart: "Invited players (30 days)", incomeMonthly: "Income by month",
    ops: "Recent operations", payouts: "Payout history", requestPayout: "Request payout", payoutAmount: "Amount, ₽", payoutMethod: "Method", payoutDetails: "Payment details", minPayout: "Minimum amount",
    types: { SALE: "Sale", ACTIVE_PLAYER_BONUS: "Bonus: active player", MILESTONE_BONUS: "Bonus: milestone", ADJUSTMENT: "Adjustment" },
    statuses: { HOLD: "On hold", AVAILABLE: "Available", CANCELLED: "Cancelled", PENDING: "Pending review", APPROVED: "Approved", PAID: "Paid", REJECTED: "Rejected" },
    blocked: "Your partner account is blocked. Please contact the administration.",
  },
  rules: {
    title: "Server rules",
    items: [
      "Respect other players. Insults, discrimination and harassment are forbidden.",
      "Cheats, X-Ray, macros, autoclickers and any unfair mods are forbidden.",
      "Exploiting bugs and dupes is forbidden. Report bugs to staff — you'll be rewarded.",
      "Griefing and stealing on other players' land are forbidden.",
      "Advertising other projects is forbidden.",
      "Scamming in KRY or real-money trades is forbidden.",
      "AFK farms that bypass the activity system are forbidden.",
      "One player — one account in the referral program. Multi-accounts are banned.",
      "Staff decisions can be appealed in Discord.",
    ],
  },
  footer: { rights: "Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.", payments: "Payments and refunds follow the store terms." },
};

const dicts: Record<Locale, Dict> = { ru, en };

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  return jar.get("lang")?.value === "en" ? "en" : "ru";
}

export async function getDict(): Promise<{ locale: Locale; d: Dict }> {
  const locale = await getLocale();
  return { locale, d: dicts[locale] };
}

export const dictFor = (l: Locale) => dicts[l];
