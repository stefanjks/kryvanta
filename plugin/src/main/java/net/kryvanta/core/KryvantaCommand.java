package net.kryvanta.core;

import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabExecutor;

import java.util.List;

public final class KryvantaCommand implements TabExecutor {
    private final KryvantaPlugin plugin;

    public KryvantaCommand(KryvantaPlugin plugin) { this.plugin = plugin; }

    @Override
    public boolean onCommand(CommandSender sender, Command cmd, String label, String[] args) {
        if (!sender.hasPermission("kryvanta.admin")) {
            Text.send(sender, "<red>Нет прав.");
            return true;
        }
        if (args.length > 0 && args[0].equalsIgnoreCase("reload")) {
            plugin.reloadAll();
            Text.send(sender, "<green>Конфиг и префиксы перезагружены.");
        } else {
            Text.send(sender, "<gray>Используй: <white>/kryvanta reload");
        }
        return true;
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command cmd, String label, String[] args) {
        return args.length == 1 && sender.hasPermission("kryvanta.admin") ? List.of("reload") : List.of();
    }
}
