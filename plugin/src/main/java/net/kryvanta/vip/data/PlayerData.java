package net.kryvanta.vip.data;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.util.*;

/** Сохраняемые данные игрока (plugins/Kryvanta/players/<uuid>.yml). Изменяется только в основном потоке. */
public final class PlayerData {
    /** Начисленная, но ещё не полученная награда. */
    public record Credit(String id, String rewardKey, String source) {}

    public final UUID uuid;
    public double scale = 1.0;
    public int boatLevel = 0;
    public boolean showPrefix = true;
    public boolean rewardReminders = true;
    public boolean keepScale = true;

    public long rewardProgressSeconds = 0;
    /** Активное время, ещё не отправленное на сайт. */
    public long unsentActiveSeconds = 0;
    public long totalActiveSeconds = 0;
    public final List<Credit> credits = new ArrayList<>();
    public final List<String> pendingMessages = new ArrayList<>();

    /** Личная варочная стойка: 5 слотов (3 бутылки, ингредиент, топливо) в base64. */
    public final String[] brewSlots = new String[5];
    public int brewFuel = 0;
    public int brewTime = 0;
    public String brewIngredient = null;

    public PlayerData(UUID uuid) { this.uuid = uuid; }

    public YamlConfiguration toYaml() {
        YamlConfiguration y = new YamlConfiguration();
        y.set("scale", scale);
        y.set("boat-level", boatLevel);
        y.set("settings.show-prefix", showPrefix);
        y.set("settings.reward-reminders", rewardReminders);
        y.set("settings.keep-scale", keepScale);
        y.set("rewards.progress", rewardProgressSeconds);
        y.set("playtime.unsent", unsentActiveSeconds);
        y.set("playtime.total", totalActiveSeconds);
        List<Map<String, String>> cs = new ArrayList<>();
        for (Credit c : credits) cs.add(Map.of("id", c.id(), "reward", c.rewardKey(), "source", c.source()));
        y.set("rewards.credits", cs);
        y.set("messages", pendingMessages);
        for (int i = 0; i < 5; i++) y.set("brew.slot" + i, brewSlots[i]);
        y.set("brew.fuel", brewFuel);
        y.set("brew.time", brewTime);
        y.set("brew.ingredient", brewIngredient);
        return y;
    }

    public static PlayerData fromYaml(UUID uuid, YamlConfiguration y) {
        PlayerData d = new PlayerData(uuid);
        d.scale = y.getDouble("scale", 1.0);
        d.boatLevel = y.getInt("boat-level", 0);
        d.showPrefix = y.getBoolean("settings.show-prefix", true);
        d.rewardReminders = y.getBoolean("settings.reward-reminders", true);
        d.keepScale = y.getBoolean("settings.keep-scale", true);
        d.rewardProgressSeconds = y.getLong("rewards.progress", 0);
        d.unsentActiveSeconds = y.getLong("playtime.unsent", 0);
        d.totalActiveSeconds = y.getLong("playtime.total", 0);
        for (Map<?, ?> m : y.getMapList("rewards.credits")) {
            Object id = m.get("id"), r = m.get("reward"), s = m.get("source");
            if (id != null && r != null) d.credits.add(new Credit(id.toString(), r.toString(), s == null ? "PLAYTIME" : s.toString()));
        }
        d.pendingMessages.addAll(y.getStringList("messages"));
        ConfigurationSection b = y.getConfigurationSection("brew");
        if (b != null) {
            for (int i = 0; i < 5; i++) d.brewSlots[i] = b.getString("slot" + i);
            d.brewFuel = b.getInt("fuel");
            d.brewTime = b.getInt("time");
            d.brewIngredient = b.getString("ingredient");
        }
        return d;
    }
}
