package net.kryvanta.core;

import org.bukkit.Bukkit;
import org.bukkit.command.PluginCommand;
import org.bukkit.command.TabExecutor;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.util.List;

public final class KryvantaPlugin extends JavaPlugin {

    private PrefixManager prefixes;
    private BoardManager boards;
    private BukkitTask announceTask;
    private int announceIndex = 0;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        prefixes = new PrefixManager(this);
        prefixes.load();

        boards = new BoardManager(this);
        getServer().getPluginManager().registerEvents(boards, this);
        getServer().getPluginManager().registerEvents(new ChatListener(this), this);
        boards.start();

        bind("prefix", new PrefixCommand(this));
        bind("board", new BoardCommand(this));
        bind("kryvanta", new KryvantaCommand(this));

        startAnnouncements();
        getLogger().info("KRYVANTA запущен.");
    }

    @Override
    public void onDisable() {
        if (announceTask != null) announceTask.cancel();
        if (boards != null) boards.stop();
    }

    private void bind(String name, TabExecutor ex) {
        PluginCommand c = getCommand(name);
        if (c == null) return;
        c.setExecutor(ex);
        c.setTabCompleter(ex);
    }

    public void reloadAll() {
        reloadConfig();
        prefixes.load();
        boards.reload();
        startAnnouncements();
    }

    public void startAnnouncements() {
        if (announceTask != null) announceTask.cancel();
        announceTask = null;
        ConfigurationSection s = getConfig().getConfigurationSection("announcements");
        if (s == null || !s.getBoolean("enabled", true)) return;

        long ticks = Math.max(10, s.getInt("interval-seconds", 180)) * 20L;
        announceTask = Bukkit.getScheduler().runTaskTimer(this, () -> {
            List<String> msgs = getConfig().getStringList("announcements.messages");
            if (msgs.isEmpty() || Bukkit.getOnlinePlayers().isEmpty()) return;
            announceIndex = (announceIndex + 1) % msgs.size();
            Bukkit.broadcast(Text.mm(msgs.get(announceIndex), Text.base(getConfig())));
        }, ticks, ticks);
    }

    public PrefixManager prefixes() { return prefixes; }
    public BoardManager boards() { return boards; }
}
