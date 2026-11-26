package net.kryvanta.vip.gui;

import net.kryvanta.vip.VipModule;
import net.kryvanta.vip.data.PlayerData;
import net.kryvanta.vip.data.SyncState;
import net.kryvanta.vip.feature.SizeFeature;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Все меню VIP: главное, размер, лодка, награды, настройки. */
public final class VipMenus {
    private VipMenus() {}

    static String dur(long seconds) {
        long h = seconds / 3600, m = (seconds % 3600) / 60, s = seconds % 60;
        return String.format("%02d:%02d:%02d", h, m, s);
    }

    static String bar(double frac) {
        int n = (int) Math.round(Math.max(0, Math.min(1, frac)) * 20);
        return "<gold>" + "|".repeat(n) + "<dark_gray>" + "|".repeat(20 - n);
    }

    // ---------------------------------------------------------------- /vip
    public static final class Main extends Menu {
        private final VipModule vip;
        public Main(VipModule vip, Player p) { super(p, 6, "<gradient:#e9cf7a:#d4af37><bold>✦ KRYVANTA VIP ✦</bold></gradient>"); this.vip = vip; }

        @Override protected void render() {
            Instant until = vip.vipUntil(player);
            String left = until == null ? "—" : until.equals(Instant.MAX) ? "бессрочно" : Duration.between(Instant.now(), until).toDays() + " дн.";
            set(4, item(Material.NETHER_STAR, "<gold><bold>KRYVANTA VIP", "<gray>Осталось: <white>" + left, "<gray>Продлить: <yellow>сайт → Магазин"), null);
            btn(19, "size", Material.SLIME_BALL, "<gold>Размер персонажа", "<gray>/size", (p) -> new Size(vip, p).open());
            btn(20, "boat", Material.OAK_BOAT, "<gold>Ускорение лодки", "<gray>/boat", (p) -> new Boat(vip, p).open());
            btn(21, "rewards", Material.CHEST, "<gold>Награды за игровое время", "<gray>/viprewards", (p) -> new Rewards(vip, p).open());
            btn(22, "settings", Material.COMPARATOR, "<gold>Настройки VIP", "<gray>/vipsettings", (p) -> new Settings(vip, p).open());
            station(28, "ec", Material.ENDER_CHEST, "Эндер-сундук");
            station(29, "anvil", Material.ANVIL, "Наковальня");
            station(30, "craft", Material.CRAFTING_TABLE, "Верстак");
            station(31, "enchant", Material.ENCHANTING_TABLE, "Стол зачарования");
            station(32, "grindstone", Material.GRINDSTONE, "Точило");
            station(33, "smithing", Material.SMITHING_TABLE, "Кузнечный стол");
            station(34, "loom", Material.LOOM, "Ткацкий станок");
            station(38, "stonecutter", Material.STONECUTTER, "Камнерез");
            station(39, "cartography", Material.CARTOGRAPHY_TABLE, "Стол картографа");
            station(40, "brew", Material.BREWING_STAND, "Варочная стойка");
        }

        private void btn(int slot, String feature, Material m, String name, String lore, java.util.function.Consumer<Player> action) {
            boolean on = vip.sync().featureEnabled(feature);
            set(slot, item(on ? m : Material.BARRIER, name, on ? lore : "<red>Отключено администрацией"), on ? (p, c) -> action.accept(p) : null);
        }

        private void station(int slot, String key, Material m, String name) {
            boolean on = vip.sync().featureEnabled(key);
            set(slot, item(on ? m : Material.BARRIER, "<gold>" + name, on ? "<gray>/" + key : "<red>Отключено администрацией"),
                    on ? (p, c) -> { p.closeInventory(); vip.openStation(p, key); } : null);
        }
    }

    // ---------------------------------------------------------------- /size
    public static final class Size extends Menu {
        private final VipModule vip;
        public Size(VipModule vip, Player p) { super(p, 3, "<gold>Размер персонажа"); this.vip = vip; }

        @Override protected void render() {
            List<Double> scales = vip.sync().allowedScales;
            double cur = vip.size().current(player);
            int start = 13 - scales.size() / 2;
            for (int i = 0; i < scales.size() && i < 7; i++) {
                double sc = scales.get(i);
                boolean active = Math.abs(sc - cur) < 1e-6;
                ItemStack it = item(sc < 1 ? Material.SLIME_BALL : sc > 1 ? Material.SLIME_BLOCK : Material.ARMOR_STAND,
                        (active ? "<green>✔ " : "<gold>") + SizeFeature.format(sc) + "x", label(sc), active ? "<green>Выбрано" : "<yellow>Нажмите, чтобы выбрать");
                it.setAmount(Math.max(1, (int) Math.round(sc * 4)));
                set(start + i, glow(it, active), (p, c) -> { vip.size().choose(p, sc); redraw(); });
            }
            set(22, item(Material.ARROW, "<gray>Назад"), (p, c) -> new Main(vip, p).open());
        }

        private static String label(double s) {
            if (s <= 0.5) return "<gray>Маленький персонаж";
            if (s < 1) return "<gray>Уменьшенный";
            if (s == 1) return "<gray>Стандартный";
            if (s <= 1.25) return "<gray>Увеличенный";
            if (s <= 1.5) return "<gray>Большой";
            return "<gray>Очень большой";
        }
    }

    // ---------------------------------------------------------------- /boat
    public static final class Boat extends Menu {
        private final VipModule vip;
        public Boat(VipModule vip, Player p) { super(p, 3, "<gold>Ускорение лодки"); this.vip = vip; }

        @Override protected void render() {
            PlayerData d = vip.store().get(player.getUniqueId());
            int cur = d == null ? 0 : d.boatLevel;
            String[] names = {"Обычная скорость", "Ускорение I", "Ускорение II", "Ускорение III"};
            for (int lvl = 0; lvl <= 3; lvl++) {
                final int l = lvl;
                String speed = lvl == 0 ? "ванильная" : String.format("до %.0f блоков/с", vip.sync().boatMaxSpeeds.get(lvl - 1) * 20);
                boolean active = cur == lvl;
                set(10 + lvl * 2, glow(item(lvl == 0 ? Material.OAK_BOAT : Material.CHERRY_BOAT, (active ? "<green>✔ " : "<gold>") + names[lvl],
                        "<gray>Скорость: <white>" + speed, "<gray>Только ваша лодка и только на воде", active ? "<green>Выбрано" : "<yellow>Нажмите, чтобы выбрать"), active),
                        (p, c) -> { vip.boats().choose(p, l); redraw(); });
            }
            set(22, item(Material.ARROW, "<gray>Назад"), (p, c) -> new Main(vip, p).open());
        }
    }

    // ---------------------------------------------------------------- /viprewards
    public static final class Rewards extends Menu {
        private final VipModule vip;
        public Rewards(VipModule vip, Player p) { super(p, 6, "<gold>Награды за игровое время"); this.vip = vip; }

        @Override protected void render() {
            PlayerData d = vip.store().get(player.getUniqueId());
            if (d == null) return;
            SyncState s = vip.sync();
            long interval = s.rewardIntervalSeconds;
            long left = Math.max(0, interval - d.rewardProgressSeconds);
            boolean active = vip.activity().isActive(player);
            List<String> lore = new ArrayList<>();
            lore.add("<gray>Прогресс: " + bar((double) d.rewardProgressSeconds / interval));
            lore.add("<gray>" + dur(d.rewardProgressSeconds) + " / " + dur(interval));
            lore.add("<gray>До следующей награды: <white>" + dur(left));
            lore.add(active ? "<green>● Время идёт" : "<red>● Пауза (AFK)");
            if (!s.rewardsEnabled) lore.add("<red>Награды временно отключены администрацией");
            lore.add("<dark_gray>Учитывается только активная игра");
            set(4, item(Material.CLOCK, "<gold><bold>Следующая награда", lore), null);

            int slot = 10;
            for (PlayerData.Credit c : List.copyOf(d.credits)) {
                if (slot > 43) break;
                if (slot % 9 == 8) slot += 2;
                SyncState.RewardKit kit = s.rewards.get(c.rewardKey());
                List<String> l = new ArrayList<>();
                l.add("<gray>Источник: <white>" + switch (c.source()) { case "MANUAL" -> "администрация"; case "PURCHASE" -> "покупка"; default -> "игровое время"; });
                if (kit != null) for (SyncState.RewardItem ri : kit.items()) l.add("<gray>• <white>" + ri.amount() + "× " + pretty(ri.material()));
                l.add("");
                l.add(kit == null ? "<red>Набор недоступен" : "<yellow>Нажмите, чтобы забрать");
                Material icon = switch (kit == null ? "" : kit.tier()) { case "EPIC" -> Material.DIAMOND; case "RARE" -> Material.GOLD_INGOT; case "COSMETIC" -> Material.FIREWORK_ROCKET; default -> Material.IRON_INGOT; };
                set(slot++, glow(item(icon, "<gold>" + (kit == null ? c.rewardKey() : kit.nameRu()), l), true), (p, cl) -> { vip.rewards().claim(p, c.id()); redraw(); });
            }
            if (d.credits.isEmpty()) {
                List<String> pool = new ArrayList<>();
                pool.add("<gray>Возможные наборы:");
                int total = s.rewards.values().stream().mapToInt(k -> Math.max(0, k.weight())).sum();
                for (SyncState.RewardKit k : s.rewards.values()) if (k.weight() > 0 && total > 0) pool.add("<gray>• <white>" + k.nameRu() + " <dark_gray>(" + Math.round(100.0 * k.weight() / total) + "%)");
                set(22, item(Material.BARREL, "<gray>Пока нет доступных наград", pool), null);
            }
            set(49, item(Material.ARROW, "<gray>Назад"), (p, c) -> new Main(vip, p).open());
        }

        private static String pretty(String m) {
            String s = m.toLowerCase().replace('_', ' ');
            return Character.toUpperCase(s.charAt(0)) + s.substring(1);
        }
    }

    // ---------------------------------------------------------------- /vipsettings
    public static final class Settings extends Menu {
        private final VipModule vip;
        public Settings(VipModule vip, Player p) { super(p, 3, "<gold>Настройки VIP"); this.vip = vip; }

        @Override protected void render() {
            PlayerData d = vip.store().get(player.getUniqueId());
            if (d == null) return;
            toggle(11, Material.NAME_TAG, "VIP-префикс в чате и TAB", d.showPrefix, () -> { d.showPrefix = !d.showPrefix; vip.prefixChanged(player); });
            toggle(13, Material.BELL, "Напоминания о наградах", d.rewardReminders, () -> d.rewardReminders = !d.rewardReminders);
            toggle(15, Material.SLIME_BALL, "Сохранять размер между сессиями", d.keepScale, () -> d.keepScale = !d.keepScale);
            set(22, item(Material.ARROW, "<gray>Назад"), (p, c) -> new Main(vip, p).open());
        }

        private void toggle(int slot, Material m, String name, boolean on, Runnable flip) {
            set(slot, glow(item(m, "<gold>" + name, on ? "<green>Включено" : "<red>Выключено", "<yellow>Нажмите, чтобы переключить"), on), (p, c) -> {
                flip.run();
                vip.store().save(vip.store().get(p.getUniqueId()));
                redraw();
            });
        }
    }
}
