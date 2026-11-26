package net.kryvanta.vip;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import net.kryvanta.core.KryvantaPlugin;
import net.kryvanta.core.Text;
import net.kryvanta.vip.api.ApiClient;
import net.kryvanta.vip.data.Outbox;
import net.kryvanta.vip.data.PlayerData;
import net.kryvanta.vip.data.PlayerDataStore;
import net.kryvanta.vip.data.SyncState;
import net.kryvanta.vip.feature.*;
import net.kryvanta.vip.gui.MenuListener;
import net.luckperms.api.event.user.UserDataRecalculateEvent;
import org.bukkit.Bukkit;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.AsyncPlayerPreLoginEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.scheduler.BukkitTask;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Модуль KRYVANTA VIP: синхронизация с сайтом, LuckPerms, VIP-функции, награды, учёт активности.
 * Сетевые запросы и файловые операции выполняются асинхронно; игровая логика — в основном потоке.
 */
public final class VipModule implements Listener {
    private final KryvantaPlugin plugin;
    private final PlayerDataStore store;
    private final SyncState sync;
    private final Outbox outbox;
    private ApiClient api;
    private final LuckPermsBridge lp;
    private final ActivityTracker activity;
    private final RewardService rewards;
    private final SizeFeature size;
    private final BoatFeature boats;
    private final Workstations stations;
    private final BrewingFeature brewing;
    private final List<BukkitTask> tasks = new ArrayList<>();
    private final AtomicBoolean syncing = new AtomicBoolean(false);
    private volatile JsonObject lastConfig;
    private volatile boolean siteReachable = false;
    private volatile String lastSyncError = null;

    public VipModule(KryvantaPlugin plugin) {
        this.plugin = plugin;
        this.store = new PlayerDataStore(plugin);
        this.sync = new SyncState(plugin.getDataFolder());
        this.sync.loadDefaults(plugin.getConfig());
        this.lastConfig = sync.read();
        this.outbox = new Outbox(plugin);
        this.lp = new LuckPermsBridge(plugin, plugin.getConfig().getString("vip.group", "kryvanta_vip"));
        this.activity = new ActivityTracker(this);
        this.rewards = new RewardService(this);
        this.size = new SizeFeature(this);
        this.boats = new BoatFeature(this);
        this.stations = new Workstations(this);
        this.brewing = new BrewingFeature(this);
        configureApi();
    }

    private void configureApi() {
        FileConfiguration c = plugin.getConfig();
        this.api = new ApiClient(c.getString("api.url", ""), c.getString("api.secret", ""), c.getInt("api.timeout-seconds", 10));
    }

    public void enable() {
        var pm = plugin.getServer().getPluginManager();
        pm.registerEvents(this, plugin);
        pm.registerEvents(new MenuListener(), plugin);
        pm.registerEvents(activity, plugin);
        pm.registerEvents(size, plugin);
        pm.registerEvents(stations, plugin);
        pm.registerEvents(brewing, plugin);

        ensureGroup();
        // префикс в чате/TAB обновляется, когда LuckPerms пересчитывает данные игрока (выдача/окончание VIP)
        lp.api().getEventBus().subscribe(plugin, UserDataRecalculateEvent.class, e ->
                Bukkit.getScheduler().runTask(plugin, () -> {
                    Player p = Bukkit.getPlayer(e.getUser().getUniqueId());
                    if (p != null) onPermissionsChanged(p);
                }));

        if (!Bukkit.getOnlineMode()) {
            plugin.getLogger().warning("Сервер в offline-mode: /link не может доказать владение аккаунтом без прокси с проверкой (Velocity/BungeeCord + online-mode). Используйте online-mode или авторизацию через прокси.");
        }
        if (!api.configured()) plugin.getLogger().warning("api.url / api.secret не настроены в config.yml — синхронизация с сайтом отключена, используются локальные данные.");

        for (Player p : Bukkit.getOnlinePlayers()) { store.loadBlocking(p.getUniqueId()); afterJoin(p); }

        int syncSec = Math.max(10, plugin.getConfig().getInt("api.sync-interval-seconds", 30));
        int playSec = Math.max(60, plugin.getConfig().getInt("api.playtime-interval-seconds", 300));
        tasks.add(Bukkit.getScheduler().runTaskTimer(plugin, (Runnable) () -> { activity.tick(); size.tick(); }, 20L, 20L));
        tasks.add(Bukkit.getScheduler().runTaskTimer(plugin, (Runnable) boats::tick, 1L, 1L));
        tasks.add(Bukkit.getScheduler().runTaskTimer(plugin, (Runnable) brewing::tick, 1L, 1L));
        tasks.add(Bukkit.getScheduler().runTaskTimer(plugin, (Runnable) this::reconcileOnline, 20L * 60, 20L * 60));
        tasks.add(Bukkit.getScheduler().runTaskTimer(plugin, (Runnable) this::queuePlaytime, 20L * playSec, 20L * playSec));
        tasks.add(Bukkit.getScheduler().runTaskTimer(plugin, (Runnable) () -> { for (UUID id : store.online().keySet()) brewing.persist(id); store.flushAll(); }, 20L * 60, 20L * 60));
        tasks.add(Bukkit.getScheduler().runTaskTimerAsynchronously(plugin, (Runnable) this::syncNow, 40L, 20L * syncSec));
    }

    public void disable() {
        tasks.forEach(BukkitTask::cancel);
        for (Player p : Bukkit.getOnlinePlayers()) {
            // закрываем виртуальные интерфейсы — сервер вернёт предметы из слотов в инвентарь
            p.closeInventory();
            brewing.unload(p);
        }
        queuePlaytime();
        store.shutdown();
        sync.write(sync.snapshot(lastConfig));
    }

    public void reload() {
        configureApi();
        ensureGroup();
        Bukkit.getScheduler().runTaskAsynchronously(plugin, this::syncNow);
    }

    private void ensureGroup() {
        String prefix = sync.vipPrefix;
        lp.ensureGroup(prefix, plugin.getConfig().getInt("vip.prefix-priority", 50), plugin.getConfig().getInt("vip.group-weight", 20));
    }

    // ------------------------------------------------------------------ геттеры
    public KryvantaPlugin plugin() { return plugin; }
    public PlayerDataStore store() { return store; }
    public SyncState sync() { return sync; }
    public Outbox outbox() { return outbox; }
    public ApiClient api() { return api; }
    public ActivityTracker activity() { return activity; }
    public RewardService rewards() { return rewards; }
    public SizeFeature size() { return size; }
    public BoatFeature boats() { return boats; }
    public BrewingFeature brewing() { return brewing; }
    public LuckPermsBridge luckPerms() { return lp; }
    public boolean siteReachable() { return siteReachable; }
    public String lastSyncError() { return lastSyncError; }

    /** VIP определяется группой LuckPerms (разрешение kryvanta.vip выдаётся только группой kryvanta_vip). */
    public boolean isVip(Player p) { return p.hasPermission("kryvanta.vip"); }

    public Instant vipUntil(Player p) {
        Instant lpUntil = lp.currentExpiry(p);
        return lpUntil != null ? lpUntil : sync.vips.get(p.getUniqueId());
    }

    public void openStation(Player p, String key) { stations.open(p, key); }

    // ------------------------------------------------------------------ вход/выход
    @EventHandler(priority = EventPriority.MONITOR)
    public void onPreLogin(AsyncPlayerPreLoginEvent e) {
        if (e.getLoginResult() == AsyncPlayerPreLoginEvent.Result.ALLOWED) store.loadBlocking(e.getUniqueId());
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent e) {
        Player p = e.getPlayer();
        if (store.get(p.getUniqueId()) == null) store.loadBlocking(p.getUniqueId());
        afterJoin(p);
    }

    private void afterJoin(Player p) {
        PlayerData d = store.get(p.getUniqueId());
        if (d != null && !d.keepScale) d.scale = 1.0;
        reconcile(p);
        Bukkit.getScheduler().runTaskLater(plugin, (Runnable) () -> {
            if (!p.isOnline()) return;
            size.refresh(p);
            PlayerData dd = store.get(p.getUniqueId());
            if (dd == null) return;
            for (String m : dd.pendingMessages) Text.send(p, m);
            if (!dd.pendingMessages.isEmpty()) { dd.pendingMessages.clear(); store.save(dd); }
            if (!dd.credits.isEmpty() && dd.rewardReminders) Text.send(p, "<gold>✦ У вас есть неполученные награды: <white>" + dd.credits.size() + " <gray>— <yellow>/viprewards");
        }, 40L);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent e) {
        Player p = e.getPlayer();
        brewing.unload(p);
        PlayerData d = store.get(p.getUniqueId());
        if (d != null && d.unsentActiveSeconds > 0) queuePlaytime(List.of(d));
        store.unload(p.getUniqueId());
    }

    /** Состояние VIP в LuckPerms должно совпадать с данными сайта (или последним кэшем, если сайт недоступен). */
    private void reconcile(Player p) {
        Instant want = sync.vips.get(p.getUniqueId());
        boolean shouldBeVip = want != null && want.isAfter(Instant.now());
        Instant have = lp.currentExpiry(p);
        if (shouldBeVip && (have == null || !have.equals(want))) {
            lp.setVip(p.getUniqueId(), want);
        } else if (!shouldBeVip && have != null && dataTrusted()) {
            lp.setVip(p.getUniqueId(), null);
        }
        if (!isVip(p) && !shouldBeVip) onVipLost(p);
    }

    /** Снимаем VIP только при свежих данных с сайта — при сбое связи ничего не отнимаем. */
    private boolean dataTrusted() {
        return sync.lastSyncMillis > 0 && System.currentTimeMillis() - sync.lastSyncMillis < 10 * 60_000L;
    }

    private void reconcileOnline() { for (Player p : Bukkit.getOnlinePlayers()) reconcile(p); }

    private void onPermissionsChanged(Player p) {
        if (!isVip(p)) onVipLost(p); else size.refresh(p);
        prefixChanged(p);
    }

    private void onVipLost(Player p) {
        size.reset(p);
        PlayerData d = store.get(p.getUniqueId());
        if (d != null && d.brewSlots != null) {
            boolean hasItems = false;
            for (String s : d.brewSlots) if (s != null) { hasItems = true; break; }
            if (hasItems) brewing.returnContents(p);
        }
    }

    public void prefixChanged(Player p) {
        plugin.boards().refreshTeams();
    }

    /** Показывать ли LuckPerms-префикс игрока (настройка VIP «префикс в чате»). */
    public boolean showPrefix(UUID id) {
        PlayerData d = store.get(id);
        return d == null || d.showPrefix;
    }

    // ------------------------------------------------------------------ синхронизация
    /** Фоновый поток: синхронизация с сайтом. */
    public void syncNow() {
        if (!api.configured() || !syncing.compareAndSet(false, true)) return;
        try {
            outbox.flush(api);
            JsonObject req = new JsonObject();
            req.addProperty("online", Bukkit.getOnlinePlayers().size());
            req.addProperty("max", Bukkit.getMaxPlayers());
            req.addProperty("version", Bukkit.getMinecraftVersion() + " / Kryvanta " + plugin.getPluginMeta().getVersion());
            JsonArray players = new JsonArray();
            for (Player p : Bukkit.getOnlinePlayers()) {
                JsonObject o = new JsonObject();
                o.addProperty("uuid", p.getUniqueId().toString());
                o.addProperty("name", p.getName());
                players.add(o);
            }
            req.add("players", players);
            ApiClient.Result r = api.post("/api/plugin/sync", req).join();
            if (!r.ok()) {
                siteReachable = false;
                lastSyncError = "HTTP " + r.status() + " " + r.body();
                plugin.getLogger().warning("Синхронизация с сайтом: " + lastSyncError);
                return;
            }
            JsonObject body = r.body();
            JsonObject cfg = body.getAsJsonObject("config");
            String oldPrefix = sync.vipPrefix;
            if (cfg != null) { sync.applyConfig(cfg); lastConfig = cfg; }
            sync.applyVips(body.getAsJsonArray("vips"));
            sync.lastSyncMillis = System.currentTimeMillis();
            siteReachable = true;
            lastSyncError = null;
            JsonArray deliveries = body.getAsJsonArray("deliveries");
            Bukkit.getScheduler().runTask(plugin, () -> {
                if (!Objects.equals(oldPrefix, sync.vipPrefix)) ensureGroup();
                List<String> done = processDeliveries(deliveries);
                reconcileOnline();
                String snap = sync.snapshot(lastConfig);
                Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
                    sync.write(snap);
                    if (!done.isEmpty()) ack(done);
                });
            });
        } catch (Exception e) {
            siteReachable = false;
            lastSyncError = e.getClass().getSimpleName() + ": " + e.getMessage();
            plugin.getLogger().warning("Сайт недоступен, работаем с сохранёнными данными (" + lastSyncError + ")");
        } finally {
            syncing.set(false);
        }
    }

    private void ack(List<String> ids) {
        JsonObject b = new JsonObject();
        JsonArray a = new JsonArray();
        ids.forEach(a::add);
        b.add("ids", a);
        try { api.post("/api/plugin/ack", b).join(); } catch (Exception ignored) { /* повторим при следующей синхронизации */ }
    }

    /** Основной поток. Каждая доставка выполняется ровно один раз (локальный журнал выполненных id). */
    private List<String> processDeliveries(JsonArray deliveries) {
        List<String> done = new ArrayList<>();
        if (deliveries == null) return done;
        for (JsonElement el : deliveries) {
            JsonObject d = el.getAsJsonObject();
            String id = d.get("id").getAsString();
            if (sync.processedDeliveries.contains(id)) { done.add(id); continue; }
            String type = d.get("type").getAsString();
            JsonObject payload = d.has("payload") && d.get("payload").isJsonObject() ? d.getAsJsonObject("payload") : new JsonObject();
            try {
                switch (type) {
                    case "VIP_SYNC" -> {
                        UUID uuid = UUID.fromString(payload.get("uuid").getAsString());
                        JsonElement exp = payload.get("expiresAt");
                        Instant until = exp == null || exp.isJsonNull() ? null : Instant.parse(exp.getAsString());
                        if (until != null && until.isAfter(Instant.now())) sync.vips.put(uuid, until); else sync.vips.remove(uuid);
                        lp.setVip(uuid, until);
                    }
                    case "NOTIFY" -> {
                        UUID uuid = UUID.fromString(payload.get("uuid").getAsString());
                        String msg = payload.get("message").getAsString();
                        Player p = Bukkit.getPlayer(uuid);
                        if (p != null) Text.send(p, msg);
                        else store.modify(uuid, pd -> pd.pendingMessages.add(msg));
                    }
                    case "REWARD_CREDIT" -> {
                        UUID uuid = UUID.fromString(payload.get("uuid").getAsString());
                        rewards.creditExternal(uuid, payload.get("rewardKey").getAsString(),
                                payload.has("count") ? payload.get("count").getAsInt() : 1,
                                payload.has("source") ? payload.get("source").getAsString() : "MANUAL");
                        Player p = Bukkit.getPlayer(uuid);
                        if (p != null) Text.send(p, "<gold>✦ Вам выдана награда! <yellow>/viprewards");
                    }
                    case "COMMANDS" -> {
                        for (JsonElement c : payload.getAsJsonArray("commands")) {
                            String cmd = c.getAsString().replaceFirst("^/", "");
                            plugin.getLogger().info("Выполняю команду из покупки: " + cmd);
                            Bukkit.dispatchCommand(Bukkit.getConsoleSender(), cmd);
                        }
                    }
                    case "CONFIG_RELOAD" -> { /* конфигурация уже применена этой синхронизацией */ }
                    default -> plugin.getLogger().warning("Неизвестный тип доставки: " + type);
                }
                sync.markProcessed(id);
                done.add(id);
            } catch (Exception ex) {
                plugin.getLogger().severe("Ошибка обработки доставки " + id + " (" + type + "): " + ex.getMessage());
            }
        }
        return done;
    }

    /** Основной поток: собрать накопленное активное время в пакеты для сайта (через outbox). */
    private void queuePlaytime() { queuePlaytime(new ArrayList<>(store.online().values())); }

    private void queuePlaytime(Collection<PlayerData> players) {
        // сайт принимает не более часа на игрока за пакет: большие интервалы делим на несколько пакетов
        List<JsonArray> batches = new ArrayList<>();
        for (PlayerData d : players) {
            long secs = d.unsentActiveSeconds;
            Player p = Bukkit.getPlayer(d.uuid);
            int idx = 0;
            do {
                long part = Math.min(3600, secs);
                JsonObject o = new JsonObject();
                o.addProperty("uuid", d.uuid.toString());
                o.addProperty("name", p != null ? p.getName() : "unknown");
                o.addProperty("activeSeconds", part);
                o.addProperty("rewardProgressSeconds", d.rewardProgressSeconds);
                o.addProperty("rewardsStored", d.credits.size());
                if (idx == batches.size()) batches.add(new JsonArray());
                batches.get(idx++).add(o);
                secs -= part;
            } while (secs > 0);
            d.unsentActiveSeconds = 0;
        }
        for (JsonArray b : batches) {
            JsonObject body = new JsonObject();
            body.addProperty("batchId", UUID.randomUUID().toString());
            body.add("entries", b);
            outbox.add("/api/plugin/playtime", body);
        }
        for (PlayerData d : players) store.save(d);
    }

}
