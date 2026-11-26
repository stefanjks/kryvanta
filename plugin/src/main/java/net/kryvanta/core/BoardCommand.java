package net.kryvanta.core;

import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabExecutor;
import org.bukkit.entity.Player;

import java.util.List;
import java.util.UUID;

public final class BoardCommand implements TabExecutor {
    private final KryvantaPlugin plugin;

    public BoardCommand(KryvantaPlugin plugin) { this.plugin = plugin; }

    @Override
    public boolean onCommand(CommandSender sender, Command cmd, String label, String[] args) {
        if (!(sender instanceof Player p)) {
            Text.send(sender, "<red>Только для игроков.");
            return true;
        }
        UUID id = p.getUniqueId();
        boolean hide;
        if (args.length > 0 && args[0].equalsIgnoreCase("off")) hide = true;
        else if (args.length > 0 && args[0].equalsIgnoreCase("on")) hide = false;
        else hide = !plugin.prefixes().isBoardHidden(id);

        plugin.prefixes().setBoardHidden(id, hide);
        plugin.boards().tickPlayer(p);

        if (hide) Text.send(p, "<yellow>Скорборд скрыт. <gray>Вернуть: <white>/board");
        else Text.send(p, "<green>Скорборд включён.");
        return true;
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command cmd, String label, String[] args) {
        return args.length == 1 ? List.of("on", "off") : List.of();
    }
}
