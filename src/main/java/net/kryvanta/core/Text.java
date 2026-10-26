package net.kryvanta.core;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.FileConfiguration;

public final class Text {
    private static final MiniMessage MM = MiniMessage.miniMessage();
    private static final LegacyComponentSerializer LEGACY =
            LegacyComponentSerializer.builder().character('&').hexColors().build();

    private Text() {}

    public static Component mm(String s, TagResolver... resolvers) {
        return MM.deserialize(s, resolvers);
    }

    /** Префикс, введённый админом: либо MiniMessage (<red>), либо &-коды (&c, &#ff0000). */
    public static Component flexible(String s) {
        int lt = s.indexOf('<');
        if (lt >= 0 && s.indexOf('>', lt) > lt) {
            return MM.deserialize(s);
        }
        return LEGACY.deserialize(s);
    }

    public static void send(CommandSender to, String message, TagResolver... resolvers) {
        to.sendMessage(MM.deserialize(
                "<dark_gray>[<gradient:#ff4d6d:#ffb347>KRYVANTA</gradient>]</dark_gray> " + message, resolvers));
    }

    /** Общие плейсхолдеры: <server> <ip> <discord> */
    public static TagResolver base(FileConfiguration c) {
        return TagResolver.resolver(
                Placeholder.parsed("server", c.getString("server-name", "KRYVANTA")),
                Placeholder.parsed("ip", c.getString("server-ip", "")),
                Placeholder.parsed("discord", c.getString("discord", "")));
    }
}
