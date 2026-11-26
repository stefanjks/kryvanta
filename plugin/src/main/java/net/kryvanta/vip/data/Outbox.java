package net.kryvanta.vip.data;

import com.google.gson.*;
import net.kryvanta.vip.api.ApiClient;
import org.bukkit.plugin.Plugin;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Очередь исходящих событий (игровое время, выданные награды). Хранится на диске и отправляется
 * повторно, пока сайт не подтвердит приём. Каждое событие имеет уникальный идентификатор,
 * поэтому повторная отправка не создаёт дублей на сайте.
 */
public final class Outbox {
    private record Item(String path, String body) {}

    private final Plugin plugin;
    private final File file;
    private final Deque<Item> queue = new ArrayDeque<>();
    private final AtomicBoolean flushing = new AtomicBoolean(false);
    private static final Gson GSON = new Gson();

    public Outbox(Plugin plugin) {
        this.plugin = plugin;
        this.file = new File(plugin.getDataFolder(), "outbox.json");
        load();
    }

    public synchronized void add(String path, JsonObject body) {
        queue.addLast(new Item(path, GSON.toJson(body)));
        while (queue.size() > 10_000) queue.removeFirst();
        persist();
    }

    public synchronized int size() { return queue.size(); }

    /** Отправка по одному элементу, по порядку. Вызывается из фонового потока. */
    public void flush(ApiClient api) {
        if (!api.configured() || !flushing.compareAndSet(false, true)) return;
        try {
            while (true) {
                Item next;
                synchronized (this) { next = queue.peekFirst(); }
                if (next == null) break;
                ApiClient.Result r = api.post(next.path(), next.body()).join();
                if (r.ok() || (r.status() >= 400 && r.status() < 500 && r.status() != 401 && r.status() != 429)) {
                    if (!r.ok()) plugin.getLogger().warning("Сайт отклонил событие " + next.path() + ": HTTP " + r.status() + " " + r.body());
                    synchronized (this) { queue.pollFirst(); persist(); }
                } else {
                    break; // сайт недоступен — повторим позже
                }
            }
        } catch (Exception e) {
            // сеть недоступна — повторим позже
        } finally {
            flushing.set(false);
        }
    }

    private void persist() {
        JsonArray a = new JsonArray();
        for (Item i : queue) { JsonObject o = new JsonObject(); o.addProperty("path", i.path()); o.addProperty("body", i.body()); a.add(o); }
        try {
            Path tmp = file.toPath().resolveSibling("outbox.json.tmp");
            Files.writeString(tmp, GSON.toJson(a), StandardCharsets.UTF_8);
            Files.move(tmp, file.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (Exception e) {
            plugin.getLogger().warning("Не удалось сохранить outbox.json: " + e.getMessage());
        }
    }

    private void load() {
        if (!file.exists()) return;
        try {
            for (JsonElement el : JsonParser.parseString(Files.readString(file.toPath(), StandardCharsets.UTF_8)).getAsJsonArray()) {
                JsonObject o = el.getAsJsonObject();
                queue.addLast(new Item(o.get("path").getAsString(), o.get("body").getAsString()));
            }
        } catch (Exception e) {
            plugin.getLogger().warning("outbox.json повреждён, очередь очищена: " + e.getMessage());
        }
    }
}
