package net.kryvanta.core;

import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabExecutor;
import org.bukkit.entity.Player;

import java.util.*;
import java.util.regex.Pattern;

public final class PrefixCommand implements TabExecutor {
    private static final Pattern ID = Pattern.compile("[a-z0-9_]{1,16}");
    private final KryvantaPlugin plugin;

    public PrefixCommand(KryvantaPlugin plugin) { this.plugin = plugin; }

    @Override
    public boolean onCommand(CommandSender sender, Command cmd, String label, String[] args) {
        if (!sender.hasPermission("kryvanta.admin")) {
            Text.send(sender, "<red>Нет прав.");
            return true;
        }
        PrefixManager pm = plugin.prefixes();
        if (args.length == 0 || args[0].equalsIgnoreCase("help")) {
            help(sender);
            return true;
        }

        switch (args[0].toLowerCase(Locale.ROOT)) {
            case "create" -> {
                if (args.length < 4) { help(sender); return true; }
                String id = args[1].toLowerCase(Locale.ROOT);
                if (!ID.matcher(id).matches()) {
                    Text.send(sender, "<red>ID: только a-z, 0-9, _ (до 16 символов).");
                    return true;
                }
                Integer w = weight(args[2]);
                if (w == null) { Text.send(sender, "<red>Вес — число от 0 до 999."); return true; }
                String text = String.join(" ", Arrays.copyOfRange(args, 3, args.length));
                if (!pm.create(id, w, text)) {
                    Text.send(sender, "<red>Префикс <white><id></white> уже существует.", Placeholder.unparsed("id", id));
                    return true;
                }
                Text.send(sender, "<green>Префикс <white><id></white> создан: <prev>",
                        Placeholder.unparsed("id", id), Placeholder.component("prev", Text.flexible(text)));
            }
            case "edit" -> {
                if (args.length < 3) { help(sender); return true; }
                String id = args[1].toLowerCase(Locale.ROOT);
                String text = String.join(" ", Arrays.copyOfRange(args, 2, args.length));
                if (!pm.setText(id, text)) { unknown(sender, id); return true; }
                Text.send(sender, "<green>Префикс <white><id></white> изменён: <prev>",
                        Placeholder.unparsed("id", id), Placeholder.component("prev", Text.flexible(text)));
            }
            case "weight" -> {
                if (args.length < 3) { help(sender); return true; }
                String id = args[1].toLowerCase(Locale.ROOT);
                Integer w = weight(args[2]);
                if (w == null) { Text.send(sender, "<red>Вес — число от 0 до 999."); return true; }
                if (!pm.setWeight(id, w)) { unknown(sender, id); return true; }
                Text.send(sender, "<green>Вес префикса <white><id></white> = <w>.",
                        Placeholder.unparsed("id", id), Placeholder.unparsed("w", String.valueOf(w)));
            }
            case "delete" -> {
                if (args.length < 2) { help(sender); return true; }
                String id = args[1].toLowerCase(Locale.ROOT);
                if (!pm.delete(id)) { unknown(sender, id); return true; }
                Text.send(sender, "<green>Префикс <white><id></white> удалён (у всех игроков тоже).",
                        Placeholder.unparsed("id", id));
            }
            case "list" -> {
                if (pm.all().isEmpty()) {
                    Text.send(sender, "<gray>Префиксов пока нет. Создай: /prefix create");
                    return true;
                }
                Text.send(sender, "<gray>Префиксы:");
                for (PrefixManager.PrefixDef d : pm.all()) {
                    sender.sendMessage(Text.mm(" <dark_gray>•</dark_gray> <white><id> <dark_gray>(вес <w>)</dark_gray> <prev>",
                            Placeholder.unparsed("id", d.id()),
                            Placeholder.unparsed("w", String.valueOf(d.weight())),
                            Placeholder.component("prev", Text.flexible(d.text()))));
                }
            }
            case "give" -> {
                if (args.length < 3) { help(sender); return true; }
                String id = args[2].toLowerCase(Locale.ROOT);
                if (pm.get(id) == null) { unknown(sender, id); return true; }
                OfflinePlayer t = find(args[1]);
                if (t == null) {
                    Text.send(sender, "<red>Игрок <white><n></white> не найден (он должен хотя бы раз зайти).",
                            Placeholder.unparsed("n", args[1]));
                    return true;
                }
                pm.assign(t.getUniqueId(), id);
                Text.send(sender, "<green>Игроку <white><n></white> выдан префикс <white><id></white>.",
                        Placeholder.unparsed("n", args[1]), Placeholder.unparsed("id", id));
            }
            case "remove" -> {
                if (args.length < 2) { help(sender); return true; }
                OfflinePlayer t = find(args[1]);
                if (t == null) {
                    Text.send(sender, "<red>Игрок <white><n></white> не найден.", Placeholder.unparsed("n", args[1]));
                    return true;
                }
                if (pm.unassign(t.getUniqueId()))
                    Text.send(sender, "<green>Префикс у <white><n></white> убран.", Placeholder.unparsed("n", args[1]));
                else
                    Text.send(sender, "<gray>У игрока и так нет префикса.");
            }
            case "reload" -> {
                plugin.reloadAll();
                Text.send(sender, "<green>Перезагружено.");
                return true;
            }
            default -> { help(sender); return true; }
        }
        plugin.boards().refreshAll();
        return true;
    }

    private void help(CommandSender s) {
        Text.send(s, "<gray>Команды префиксов:");
        String[] lines = {
                "/prefix create <id> <вес> <текст>",
                "/prefix edit <id> <текст>",
                "/prefix weight <id> <вес>",
                "/prefix delete <id>",
                "/prefix list",
                "/prefix give <игрок> <id>",
                "/prefix remove <игрок>",
                "/prefix reload"
        };
        for (String l : lines) s.sendMessage(Text.mm(" <dark_gray>•</dark_gray> <white><l>", Placeholder.unparsed("l", l)));
        s.sendMessage(Text.mm("<gray>Текст: <white>&c[Модератор]</white> или <white>&#4dabf7&l[Модератор]</white> или <white><red>[Хелпер]</red>"));
        s.sendMessage(Text.mm("<gray>Чем больше вес, тем выше игрок в TAB."));
    }

    private void unknown(CommandSender s, String id) {
        Text.send(s, "<red>Префикс <white><id></white> не найден. <gray>/prefix list", Placeholder.unparsed("id", id));
    }

    private Integer weight(String s) {
        try {
            int w = Integer.parseInt(s);
            return w >= 0 && w <= 999 ? w : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private OfflinePlayer find(String name) {
        Player on = Bukkit.getPlayerExact(name);
        if (on != null) return on;
        return Bukkit.getOfflinePlayerIfCached(name);
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command cmd, String label, String[] args) {
        if (!sender.hasPermission("kryvanta.admin")) return List.of();
        List<String> out = new ArrayList<>();
        String sub = args[0].toLowerCase(Locale.ROOT);

        if (args.length == 1) {
            out.addAll(List.of("create", "edit", "weight", "delete", "list", "give", "remove", "reload"));
        } else if (args.length == 2) {
            switch (sub) {
                case "give", "remove" -> Bukkit.getOnlinePlayers().forEach(p -> out.add(p.getName()));
                case "edit", "weight", "delete" -> plugin.prefixes().all().forEach(d -> out.add(d.id()));
                default -> {}
            }
        } else if (args.length == 3) {
            if (sub.equals("give")) plugin.prefixes().all().forEach(d -> out.add(d.id()));
            if (sub.equals("create")) out.addAll(List.of("10", "50", "100"));
        }
        String last = args[args.length - 1].toLowerCase(Locale.ROOT);
        out.removeIf(s -> !s.toLowerCase(Locale.ROOT).startsWith(last));
        return out;
    }
}
