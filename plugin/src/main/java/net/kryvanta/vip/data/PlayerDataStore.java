package net.kryvanta.vip.data;

import org.bukkit.Bukkit;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.Plugin;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.function.Consumer;

/**
 * Хранилище данных игроков. Файловый ввод-вывод выполняется в одном фоновом потоке (порядок операций
 * гарантирован), основной поток сервера не блокируется. Запись атомарная (tmp + move).
 */
public final class PlayerDataStore {
    private final Plugin plugin;
    private final File dir;
    private final ExecutorService io = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "Kryvanta-IO");
        t.setDaemon(true);
        return t;
    });
    private final Map<UUID, PlayerData> online = new ConcurrentHashMap<>();

    public PlayerDataStore(Plugin plugin) {
        this.plugin = plugin;
        this.dir = new File(plugin.getDataFolder(), "players");
        dir.mkdirs();
    }

    public PlayerData get(UUID id) { return online.get(id); }
    public Map<UUID, PlayerData> online() { return online; }

    /** Загрузка при входе (вызывается из AsyncPlayerPreLoginEvent — уже не основной поток). */
    public PlayerData loadBlocking(UUID id) {
        try {
            PlayerData d = io.submit(() -> readFile(id)).get(5, TimeUnit.SECONDS);
            online.put(id, d);
            return d;
        } catch (Exception e) {
            plugin.getLogger().severe("Не удалось загрузить данные игрока " + id + ": " + e.getMessage());
            PlayerData d = new PlayerData(id);
            online.put(id, d);
            return d;
        }
    }

    /** Сохранить снимок (сериализация в основном потоке, запись — в фоне). */
    public void save(PlayerData d) {
        String yaml = d.toYaml().saveToString();
        io.execute(() -> writeFile(d.uuid, yaml));
    }

    public void unload(UUID id) {
        PlayerData d = online.remove(id);
        if (d != null) save(d);
    }

    /**
     * Изменить данные игрока, который может быть офлайн (например, награда пришла с сайта).
     * Если игрок онлайн — изменение выполняется в основном потоке над живыми данными.
     */
    public void modify(UUID id, Consumer<PlayerData> change) {
        PlayerData live = online.get(id);
        if (live != null) {
            change.accept(live);
            save(live);
            return;
        }
        io.execute(() -> {
            PlayerData live2 = online.get(id);
            if (live2 != null) {
                Bukkit.getScheduler().runTask(plugin, () -> modify(id, change));
                return;
            }
            PlayerData d = readFile(id);
            change.accept(d);
            writeFile(id, d.toYaml().saveToString());
        });
    }

    public void flushAll() {
        for (PlayerData d : online.values()) save(d);
    }

    public void shutdown() {
        flushAll();
        io.shutdown();
        try {
            if (!io.awaitTermination(10, TimeUnit.SECONDS)) plugin.getLogger().warning("Не все данные успели сохраниться");
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }

    private PlayerData readFile(UUID id) {
        File f = new File(dir, id + ".yml");
        if (!f.exists()) return new PlayerData(id);
        return PlayerData.fromYaml(id, YamlConfiguration.loadConfiguration(f));
    }

    private void writeFile(UUID id, String yaml) {
        try {
            Path target = dir.toPath().resolve(id + ".yml");
            Path tmp = dir.toPath().resolve(id + ".yml.tmp");
            Files.writeString(tmp, yaml, StandardCharsets.UTF_8);
            Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            plugin.getLogger().severe("Не удалось сохранить данные игрока " + id + ": " + e.getMessage());
        }
    }

    /** Запуск произвольной фоновой файловой операции в том же потоке. */
    public void runIo(Runnable r) { io.execute(r); }
}
