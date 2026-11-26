package net.kryvanta.vip.data;

import com.google.gson.*;
import org.bukkit.configuration.file.FileConfiguration;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Последние данные, полученные с сайта: конфигурация VIP, список активных VIP, наборы наград.
 * Хранится в sync-cache.json, поэтому при недоступности сайта сервер продолжает работать.
 */
public final class SyncState {
    public record RewardItem(String material, int amount) {}
    public record RewardKit(String key, String nameRu, String nameEn, String tier, int weight, List<RewardItem> items) {}

    public volatile List<Double> allowedScales = List.of(0.5, 0.75, 1.0, 1.25, 1.5, 2.0);
    public volatile List<Double> boatMaxSpeeds = List.of(0.5, 0.6, 0.7);
    public volatile boolean combatNormalizeScale = true;
    public volatile boolean rewardsEnabled = true;
    public volatile int rewardIntervalSeconds = 3 * 3600;
    public volatile int maxStoredRewards = 3;
    public volatile int afkTimeoutSeconds = 180;
    public volatile String vipPrefix = "&#d4af37&l✦ VIP";
    public final Map<String, Boolean> features = new ConcurrentHashMap<>();
    public volatile Map<String, RewardKit> rewards = new LinkedHashMap<>();
    /** uuid → окончание VIP */
    public final Map<UUID, Instant> vips = new ConcurrentHashMap<>();
    /** id уже выполненных доставок — защита от повторного выполнения, если подтверждение не дошло */
    public final Set<String> processedDeliveries = Collections.synchronizedSet(new LinkedHashSet<>());
    public volatile long lastSyncMillis = 0;

    private final File file;

    public SyncState(File dataFolder) { this.file = new File(dataFolder, "sync-cache.json"); }

    public boolean featureEnabled(String key) { return features.getOrDefault(key, true); }

    public boolean isVipCached(UUID id) {
        Instant e = vips.get(id);
        return e != null && e.isAfter(Instant.now());
    }

    /** Значения по умолчанию из config.yml (до первой синхронизации). */
    public void loadDefaults(FileConfiguration c) {
        List<Double> sc = c.getDoubleList("vip.defaults.allowed-scales");
        if (!sc.isEmpty()) allowedScales = List.copyOf(sc);
        List<Double> bs = c.getDoubleList("vip.defaults.boat-max-speeds");
        if (bs.size() == 3) boatMaxSpeeds = List.copyOf(bs);
        rewardIntervalSeconds = c.getInt("vip.defaults.reward-interval-seconds", rewardIntervalSeconds);
        afkTimeoutSeconds = c.getInt("vip.defaults.afk-timeout-seconds", afkTimeoutSeconds);
    }

    public void applyConfig(JsonObject cfg) {
        JsonObject vip = cfg.getAsJsonObject("vip");
        if (vip != null) {
            List<Double> sc = new ArrayList<>();
            vip.getAsJsonArray("allowedScales").forEach(e -> sc.add(e.getAsDouble()));
            if (!sc.isEmpty()) allowedScales = List.copyOf(sc);
            List<Double> bs = new ArrayList<>();
            vip.getAsJsonArray("boatMaxSpeeds").forEach(e -> bs.add(e.getAsDouble()));
            if (bs.size() == 3) boatMaxSpeeds = List.copyOf(bs);
            combatNormalizeScale = vip.get("combatNormalizeScale").getAsBoolean();
            rewardsEnabled = vip.get("rewardsEnabled").getAsBoolean();
            rewardIntervalSeconds = Math.max(600, vip.get("rewardIntervalSeconds").getAsInt());
            maxStoredRewards = Math.max(1, vip.get("maxStoredRewards").getAsInt());
            afkTimeoutSeconds = Math.max(30, vip.get("afkTimeoutSeconds").getAsInt());
            vipPrefix = vip.get("prefix").getAsString();
        }
        JsonObject f = cfg.getAsJsonObject("features");
        if (f != null) for (Map.Entry<String, JsonElement> e : f.entrySet()) features.put(e.getKey(), e.getValue().getAsBoolean());
        JsonArray rw = cfg.getAsJsonArray("rewards");
        if (rw != null) {
            Map<String, RewardKit> m = new LinkedHashMap<>();
            for (JsonElement el : rw) {
                JsonObject o = el.getAsJsonObject();
                List<RewardItem> items = new ArrayList<>();
                for (JsonElement it : o.getAsJsonArray("items")) {
                    JsonObject io = it.getAsJsonObject();
                    items.add(new RewardItem(io.get("material").getAsString(), io.get("amount").getAsInt()));
                }
                m.put(o.get("key").getAsString(), new RewardKit(o.get("key").getAsString(), o.get("nameRu").getAsString(),
                        o.get("nameEn").getAsString(), o.get("tier").getAsString(), o.get("weight").getAsInt(), items));
            }
            rewards = m;
        }
    }

    public void applyVips(JsonArray arr) {
        Map<UUID, Instant> next = new HashMap<>();
        for (JsonElement el : arr) {
            JsonObject o = el.getAsJsonObject();
            next.put(UUID.fromString(o.get("uuid").getAsString()), Instant.parse(o.get("expiresAt").getAsString()));
        }
        vips.keySet().retainAll(next.keySet());
        vips.putAll(next);
    }

    public void markProcessed(String id) {
        synchronized (processedDeliveries) {
            processedDeliveries.add(id);
            while (processedDeliveries.size() > 5000) {
                Iterator<String> it = processedDeliveries.iterator();
                it.next();
                it.remove();
            }
        }
    }

    // ---------- сохранение ----------
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public String snapshot(JsonObject lastConfig) {
        JsonObject root = new JsonObject();
        root.add("config", lastConfig == null ? new JsonObject() : lastConfig);
        JsonArray v = new JsonArray();
        vips.forEach((k, e) -> { JsonObject o = new JsonObject(); o.addProperty("uuid", k.toString()); o.addProperty("expiresAt", e.toString()); v.add(o); });
        root.add("vips", v);
        JsonArray p = new JsonArray();
        synchronized (processedDeliveries) { processedDeliveries.forEach(p::add); }
        root.add("processed", p);
        root.addProperty("lastSync", lastSyncMillis);
        return GSON.toJson(root);
    }

    public void write(String json) {
        try {
            Path tmp = file.toPath().resolveSibling("sync-cache.json.tmp");
            Files.writeString(tmp, json, StandardCharsets.UTF_8);
            Files.move(tmp, file.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException ignored) { }
    }

    /** Возвращает сохранённую конфигурацию (или null). */
    public JsonObject read() {
        if (!file.exists()) return null;
        try {
            JsonObject root = JsonParser.parseString(Files.readString(file.toPath(), StandardCharsets.UTF_8)).getAsJsonObject();
            JsonObject cfg = root.getAsJsonObject("config");
            if (cfg != null && cfg.has("vip")) applyConfig(cfg);
            if (root.has("vips")) applyVips(root.getAsJsonArray("vips"));
            if (root.has("processed")) root.getAsJsonArray("processed").forEach(e -> processedDeliveries.add(e.getAsString()));
            lastSyncMillis = root.has("lastSync") ? root.get("lastSync").getAsLong() : 0;
            return cfg;
        } catch (Exception e) {
            return null;
        }
    }
}
