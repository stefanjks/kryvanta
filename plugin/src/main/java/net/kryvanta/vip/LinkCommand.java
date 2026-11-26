package net.kryvanta.vip;

import com.google.gson.JsonObject;
import net.kryvanta.core.Text;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabExecutor;
import org.bukkit.entity.Player;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** /link <код> — подтверждение владения Minecraft-аккаунтом для привязки к профилю на сайте. */
public final class LinkCommand implements TabExecutor {
    private final VipModule vip;
    private final Map<UUID, Long> cooldown = new ConcurrentHashMap<>();

    public LinkCommand(VipModule vip) { this.vip = vip; }

    @Override
    public boolean onCommand(CommandSender sender, Command cmd, String label, String[] args) {
        if (!(sender instanceof Player p)) { Text.send(sender, "<red>Команда доступна только игрокам."); return true; }
        if (args.length != 1 || !args[0].matches("[A-Za-z0-9]{8}")) {
            Text.send(p, "<gray>Получите код в личном кабинете на сайте и введите: <yellow>/link КОД");
            return true;
        }
        long now = System.currentTimeMillis();
        if (cooldown.getOrDefault(p.getUniqueId(), 0L) > now) { Text.send(p, "<red>Подождите несколько секунд."); return true; }
        cooldown.put(p.getUniqueId(), now + 10_000);
        if (!vip.api().configured()) { Text.send(p, "<red>Связь с сайтом не настроена. Сообщите администрации."); return true; }

        JsonObject body = new JsonObject();
        body.addProperty("code", args[0].toUpperCase());
        body.addProperty("uuid", p.getUniqueId().toString());
        body.addProperty("name", p.getName());
        Text.send(p, "<gray>Проверяем код…");
        vip.api().post("/api/plugin/link", body).whenComplete((r, err) -> Bukkit.getScheduler().runTask(vip.plugin(), () -> {
            if (!p.isOnline()) return;
            if (err != null || r == null || !r.ok()) { Text.send(p, "<red>Сайт недоступен, попробуйте позже."); return; }
            if (r.body().has("ok") && r.body().get("ok").getAsBoolean()) {
                Text.send(p, "<green>✔ Аккаунт привязан к профилю <white><user></white> на сайте!", Placeholder.unparsed("user", r.body().get("username").getAsString()));
            } else {
                String msg = r.body().has("message") ? r.body().get("message").getAsString() : "Код недействителен";
                Text.send(p, "<red><msg>", Placeholder.unparsed("msg", msg));
            }
        }));
        return true;
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command cmd, String label, String[] args) { return List.of(); }
}
