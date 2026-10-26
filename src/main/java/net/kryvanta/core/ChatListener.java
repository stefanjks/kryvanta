package net.kryvanta.core;

import io.papermc.paper.chat.ChatRenderer;
import io.papermc.paper.event.player.AsyncChatEvent;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;

public final class ChatListener implements Listener {
    private final KryvantaPlugin plugin;

    public ChatListener(KryvantaPlugin plugin) { this.plugin = plugin; }

    @EventHandler(priority = EventPriority.HIGH)
    public void onChat(AsyncChatEvent e) {
        Component prefix = plugin.prefixes().spaced(e.getPlayer().getUniqueId());
        String format = plugin.getConfig().getString("chat-format",
                "<prefix><name> <dark_gray>»</dark_gray> <white><message>");

        e.renderer(ChatRenderer.viewerUnaware((source, sourceName, message) ->
                Text.mm(format,
                        Placeholder.component("prefix", prefix),
                        Placeholder.unparsed("name", source.getName()),
                        Placeholder.component("message", message))));
    }
}
