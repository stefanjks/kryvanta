package net.kryvanta.vip;

import net.kryvanta.core.Text;
import net.kryvanta.vip.data.PlayerData;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabExecutor;
import org.bukkit.entity.Player;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

/**
 * /kvip status | sync | info <игрок> — служебная команда администрации (kryvanta.admin).
 * Выдача и снятие VIP выполняются на сайте (/admin → VIP), чтобы все операции попадали в журнал.
 */
public final class KvipCommand implements TabExecutor {
    private final VipModule vip;
    public KvipCommand(VipModule vip) { this.vip = vip; }

    @Override
    public boolean onCommand(CommandSender s, Command cmd, String label, String[] args) {
        if (!s.hasPermission("kryvanta.admin")) { Text.send(s, "<red>Нет прав."); return true; }
        String sub = args.length > 0 ? args[0].toLowerCase(Locale.ROOT) : "status";
        switch (sub) {
            case "sync" -> {
                Bukkit.getScheduler().runTaskAsynchronously(vip.plugin(), vip::syncNow);
                Text.send(s, "<gray>Синхронизация запущена.");
            }
            case "info" -> {
                if (args.length < 2) { Text.send(s, "<gray>/kvip info <игрок>"); return true; }
                Player p = Bukkit.getPlayerExact(args[1]);
                if (p == null) { Text.send(s, "<red>Игрок не в сети."); return true; }
                PlayerData d = vip.store().get(p.getUniqueId());
                Instant until = vip.vipUntil(p);
                Text.send(s, "<gold>" + p.getName() + "<gray>: VIP=" + (vip.isVip(p) ? "<green>да" : "<red>нет") + "<gray>, до " + (until == null ? "—" : until)
                        + ", активен=" + vip.activity().isActive(p) + ", прогресс=" + (d == null ? "?" : d.rewardProgressSeconds) + "с, наград=" + (d == null ? "?" : d.credits.size())
                        + ", размер=" + vip.size().current(p) + ", лодка=" + (d == null ? "?" : d.boatLevel));
            }
            default -> {
                long ago = vip.sync().lastSyncMillis == 0 ? -1 : (System.currentTimeMillis() - vip.sync().lastSyncMillis) / 1000;
                Text.send(s, "<gold>KRYVANTA VIP<gray>: сайт " + (vip.siteReachable() ? "<green>доступен" : "<red>недоступен")
                        + "<gray>, последняя синхронизация: " + (ago < 0 ? "никогда" : ago + " с назад")
                        + ", VIP в кэше: " + vip.sync().vips.size() + ", очередь событий: " + vip.outbox().size()
                        + (vip.lastSyncError() != null ? "<newline><red>" + vip.lastSyncError().replace("<", "‹") : ""));
            }
        }
        return true;
    }

    @Override
    public List<String> onTabComplete(CommandSender s, Command cmd, String label, String[] args) {
        if (!s.hasPermission("kryvanta.admin")) return List.of();
        if (args.length == 1) return List.of("status", "sync", "info").stream().filter(x -> x.startsWith(args[0].toLowerCase(Locale.ROOT))).toList();
        if (args.length == 2 && args[0].equalsIgnoreCase("info")) return Bukkit.getOnlinePlayers().stream().map(Player::getName).filter(n -> n.toLowerCase().startsWith(args[1].toLowerCase())).toList();
        return List.of();
    }
}
