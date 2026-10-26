package net.kryvanta.core;

import net.kyori.adventure.text.Component;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.util.*;

public final class PrefixManager {

    public record PrefixDef(String id, int weight, String text) {}

    private final KryvantaPlugin plugin;
    private final File file;
    private final Map<String, PrefixDef> defs = new LinkedHashMap<>();
    private final Map<UUID, String> assigned = new HashMap<>();
    private final Set<UUID> boardHidden = new HashSet<>();

    public PrefixManager(KryvantaPlugin plugin) {
        this.plugin = plugin;
        this.file = new File(plugin.getDataFolder(), "data.yml");
    }

    public void load() {
        boolean first = !file.exists();
        defs.clear();
        assigned.clear();
        boardHidden.clear();

        if (first) {
            defs.put("admin", new PrefixDef("admin", 100, "&#ff4d6d&l[Админ]"));
            defs.put("moderator", new PrefixDef("moderator", 50, "&#4dabf7&l[Модератор]"));
            defs.put("vip", new PrefixDef("vip", 20, "&#ffb347[VIP]"));
            save();
            return;
        }

        YamlConfiguration y = YamlConfiguration.loadConfiguration(file);
        ConfigurationSection ps = y.getConfigurationSection("prefixes");
        if (ps != null) {
            for (String id : ps.getKeys(false)) {
                defs.put(id, new PrefixDef(id, ps.getInt(id + ".weight"), ps.getString(id + ".text", "")));
            }
        }
        ConfigurationSection pl = y.getConfigurationSection("players");
        if (pl != null) {
            for (String k : pl.getKeys(false)) {
                try {
                    String id = pl.getString(k);
                    if (id != null && defs.containsKey(id)) assigned.put(UUID.fromString(k), id);
                } catch (IllegalArgumentException ignored) {}
            }
        }
        for (String s : y.getStringList("board-hidden")) {
            try { boardHidden.add(UUID.fromString(s)); } catch (IllegalArgumentException ignored) {}
        }
    }

    public void save() {
        YamlConfiguration y = new YamlConfiguration();
        for (PrefixDef d : defs.values()) {
            y.set("prefixes." + d.id() + ".weight", d.weight());
            y.set("prefixes." + d.id() + ".text", d.text());
        }
        for (Map.Entry<UUID, String> e : assigned.entrySet()) {
            y.set("players." + e.getKey(), e.getValue());
        }
        y.set("board-hidden", boardHidden.stream().map(UUID::toString).toList());
        try {
            plugin.getDataFolder().mkdirs();
            y.save(file);
        } catch (IOException ex) {
            plugin.getLogger().severe("Не удалось сохранить data.yml: " + ex.getMessage());
        }
    }

    // ---------- префиксы ----------
    public Collection<PrefixDef> all() { return defs.values(); }
    public PrefixDef get(String id) { return defs.get(id); }

    public boolean create(String id, int weight, String text) {
        if (defs.containsKey(id)) return false;
        defs.put(id, new PrefixDef(id, weight, text));
        save();
        return true;
    }

    public boolean setText(String id, String text) {
        PrefixDef d = defs.get(id);
        if (d == null) return false;
        defs.put(id, new PrefixDef(id, d.weight(), text));
        save();
        return true;
    }

    public boolean setWeight(String id, int weight) {
        PrefixDef d = defs.get(id);
        if (d == null) return false;
        defs.put(id, new PrefixDef(id, weight, d.text()));
        save();
        return true;
    }

    public boolean delete(String id) {
        if (defs.remove(id) == null) return false;
        assigned.values().removeIf(v -> v.equals(id));
        save();
        return true;
    }

    // ---------- выдача ----------
    public void assign(UUID player, String id) { assigned.put(player, id); save(); }
    public boolean unassign(UUID player) {
        boolean had = assigned.remove(player) != null;
        if (had) save();
        return had;
    }

    public PrefixDef assignedDef(UUID player) {
        String id = assigned.get(player);
        return id == null ? null : defs.get(id);
    }

    public int weightOf(UUID player) {
        PrefixDef d = assignedDef(player);
        return d == null ? 0 : d.weight();
    }

    /** Префикс для чата/таба/над головой с пробелом на конце, либо пустой компонент. */
    public Component spaced(UUID player) {
        PrefixDef d = assignedDef(player);
        String text = d != null ? d.text() : plugin.getConfig().getString("default-prefix", "");
        if (text == null || text.isBlank()) return Component.empty();
        return Component.text().append(Text.flexible(text)).append(Component.space()).build();
    }

    /** Ранг для скорборда. */
    public Component rankDisplay(UUID player) {
        PrefixDef d = assignedDef(player);
        if (d != null) return Text.flexible(d.text());
        return Text.mm(plugin.getConfig().getString("default-rank-name", "<gray>Игрок"));
    }

    // ---------- скорборд ----------
    public boolean isBoardHidden(UUID player) { return boardHidden.contains(player); }
    public void setBoardHidden(UUID player, boolean hidden) {
        if (hidden) boardHidden.add(player); else boardHidden.remove(player);
        save();
    }
}
