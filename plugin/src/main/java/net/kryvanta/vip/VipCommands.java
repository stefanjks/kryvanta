package net.kryvanta.vip;

import net.kryvanta.core.Text;
import net.kryvanta.vip.gui.VipMenus;
import net.kryvanta.vip.feature.SizeFeature;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabExecutor;
import org.bukkit.entity.Player;

import java.util.*;

/**
 * Все VIP-команды: /vip /size /boat /ec /anvil /craft /enchant /grindstone /smithing /loom
 * /stonecutter /cartography /brew /viprewards /vipsettings.
 * Проверки: только игрок, разрешение kryvanta.vip.<функция>, функция не отключена администрацией.
 */
public final class VipCommands implements TabExecutor {
    /** имя команды → ключ функции (совпадает с vip_permissions.key на сайте) */
    public static final Map<String, String> FEATURES = Map.ofEntries(
            Map.entry("vip", "menu"), Map.entry("size", "size"), Map.entry("boat", "boat"), Map.entry("ec", "ec"),
            Map.entry("anvil", "anvil"), Map.entry("craft", "craft"), Map.entry("enchant", "enchant"),
            Map.entry("grindstone", "grindstone"), Map.entry("smithing", "smithing"), Map.entry("loom", "loom"),
            Map.entry("stonecutter", "stonecutter"), Map.entry("cartography", "cartography"), Map.entry("brew", "brew"),
            Map.entry("viprewards", "rewards"), Map.entry("vipsettings", "settings"));

    private final VipModule vip;

    public VipCommands(VipModule vip) { this.vip = vip; }

    @Override
    public boolean onCommand(CommandSender sender, Command cmd, String label, String[] args) {
        String name = cmd.getName().toLowerCase(Locale.ROOT);
        String feature = FEATURES.get(name);
        if (feature == null) return false;
        if (!(sender instanceof Player p)) { Text.send(sender, "<red>Команда доступна только игрокам."); return true; }

        // /viprewards доступна без VIP, если есть купленные/выданные награды
        boolean rewardsException = feature.equals("rewards") && hasExternalCredits(p);
        if (!p.hasPermission("kryvanta.vip." + feature) && !rewardsException) {
            Text.send(p, "<red>Эта возможность доступна с <gold>KRYVANTA VIP</gold>. <gray>Подробнее на сайте.");
            return true;
        }
        if (!vip.sync().featureEnabled(feature)) { Text.send(p, "<red>Эта функция временно отключена администрацией."); return true; }

        switch (feature) {
            case "menu" -> new VipMenus.Main(vip, p).open();
            case "size" -> {
                if (args.length > 0) {
                    try {
                        vip.size().choose(p, Double.parseDouble(args[0].replace("x", "").replace(",", ".")));
                    } catch (NumberFormatException e) {
                        Text.send(p, "<red>Использование: /size [<sizes>]", Placeholder.unparsed("sizes", String.join("|", scales())));
                    }
                } else new VipMenus.Size(vip, p).open();
            }
            case "boat" -> {
                if (args.length > 0) {
                    int lvl = switch (args[0].toLowerCase(Locale.ROOT)) { case "0", "off", "normal" -> 0; case "1", "i" -> 1; case "2", "ii" -> 2; case "3", "iii" -> 3; default -> -1; };
                    if (lvl < 0) Text.send(p, "<red>Использование: /boat [0|1|2|3]");
                    else vip.boats().choose(p, lvl);
                } else new VipMenus.Boat(vip, p).open();
            }
            case "rewards" -> new VipMenus.Rewards(vip, p).open();
            case "settings" -> new VipMenus.Settings(vip, p).open();
            default -> vip.openStation(p, feature);
        }
        return true;
    }

    private boolean hasExternalCredits(Player p) {
        var d = vip.store().get(p.getUniqueId());
        return d != null && d.credits.stream().anyMatch(c -> !"PLAYTIME".equals(c.source()));
    }

    private List<String> scales() {
        List<String> out = new ArrayList<>();
        for (double s : vip.sync().allowedScales) out.add(SizeFeature.format(s));
        return out;
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command cmd, String label, String[] args) {
        if (args.length != 1) return List.of();
        String n = cmd.getName().toLowerCase(Locale.ROOT);
        if (!sender.hasPermission("kryvanta.vip." + FEATURES.getOrDefault(n, "x"))) return List.of();
        List<String> opts = switch (n) {
            case "size" -> scales();
            case "boat" -> List.of("0", "1", "2", "3");
            default -> List.of();
        };
        String pre = args[0].toLowerCase(Locale.ROOT);
        return opts.stream().filter(o -> o.startsWith(pre)).toList();
    }
}
