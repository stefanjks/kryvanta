package net.kryvanta.core;

import io.papermc.paper.scoreboard.numbers.NumberFormat;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.JoinConfiguration;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.Bukkit;
import org.bukkit.Statistic;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.scheduler.BukkitTask;
import org.bukkit.scoreboard.*;

import java.util.*;

/** Скорборд (сбоку), TAB (заголовок/подвал/префиксы) и префиксы над головой. Всё из одного источника. */
public final class BoardManager implements Listener {

    private static final String OBJ = "kryvanta";
    private static final int MAX_LINES = 15;

    private final KryvantaPlugin plugin;
    private final Map<UUID, Scoreboard> boards = new HashMap<>();
    private final Map<UUID, List<Component>> lastLines = new HashMap<>();
    private BukkitTask task;

    public BoardManager(KryvantaPlugin plugin) { this.plugin = plugin; }

    public void start() {
        for (Player p : Bukkit.getOnlinePlayers()) createBoard(p);
        refreshTeams();
        task = Bukkit.getScheduler().runTaskTimer(plugin, this::tick, 20L, 20L);
    }

    public void stop() {
        if (task != null) task.cancel();
        Scoreboard main = Bukkit.getScoreboardManager().getMainScoreboard();
        for (Player p : Bukkit.getOnlinePlayers()) p.setScoreboard(main);
        boards.clear();
        lastLines.clear();
    }

    /** После /kryvanta reload: пересоздать объекты с новыми заголовками. */
    public void reload() {
        for (Scoreboard b : boards.values()) {
            Objective o = b.getObjective(OBJ);
            if (o != null) o.unregister();
        }
        lastLines.clear();
        refreshAll();
    }

    public void refreshAll() {
        refreshTeams();
        tick();
    }

    // ---------- события ----------
    @EventHandler
    public void onJoin(PlayerJoinEvent e) {
        createBoard(e.getPlayer());
        refreshTeams();
        tickPlayer(e.getPlayer());
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent e) {
        Player p = e.getPlayer();
        boards.remove(p.getUniqueId());
        lastLines.remove(p.getUniqueId());
        for (Scoreboard b : boards.values()) {
            Team t = b.getEntryTeam(p.getName());
            if (t != null) {
                t.removeEntry(p.getName());
                if (t.getEntries().isEmpty()) t.unregister();
            }
        }
    }

    private void createBoard(Player p) {
        Scoreboard b = Bukkit.getScoreboardManager().getNewScoreboard();
        boards.put(p.getUniqueId(), b);
        p.setScoreboard(b);
    }

    // ---------- префиксы (TAB + над головой) ----------
    public void refreshTeams() {
        for (Player viewer : Bukkit.getOnlinePlayers()) {
            Scoreboard b = boards.get(viewer.getUniqueId());
            if (b == null) continue;
            for (Player target : Bukkit.getOnlinePlayers()) {
                if (boards.containsKey(target.getUniqueId())) syncTarget(b, target);
            }
        }
    }

    private void syncTarget(Scoreboard board, Player target) {
        String name = teamName(target);
        Team old = board.getEntryTeam(target.getName());
        if (old != null && !old.getName().equals(name)) {
            old.removeEntry(target.getName());
            if (old.getEntries().isEmpty()) old.unregister();
        }
        Team team = board.getTeam(name);
        if (team == null) team = board.registerNewTeam(name);
        if (!team.hasEntry(target.getName())) team.addEntry(target.getName());
        team.prefix(plugin.prefixes().spaced(target.getUniqueId()));
    }

    /** Чем больше вес префикса, тем выше игрок в TAB. */
    private String teamName(Player t) {
        int w = Math.max(0, Math.min(999, plugin.prefixes().weightOf(t.getUniqueId())));
        String n = t.getName();
        if (n.length() > 13) n = n.substring(0, 13);
        return String.format("%03d", 999 - w) + n;
    }

    // ---------- обновление ----------
    public void tick() {
        for (Player p : Bukkit.getOnlinePlayers()) tickPlayer(p);
    }

    public void tickPlayer(Player p) {
        if (!boards.containsKey(p.getUniqueId())) return;
        updateSidebar(p);
        updateTab(p);
    }

    private void updateSidebar(Player p) {
        UUID id = p.getUniqueId();
        Scoreboard board = boards.get(id);
        Objective obj = board.getObjective(OBJ);

        boolean show = plugin.getConfig().getBoolean("sidebar.enabled", true)
                && !plugin.prefixes().isBoardHidden(id);
        if (!show) {
            if (obj != null) obj.unregister();
            lastLines.remove(id);
            return;
        }

        TagResolver res = resolver(p);
        if (obj == null) {
            Component title = Text.mm(plugin.getConfig().getString("sidebar.title", "<bold>KRYVANTA"), res);
            obj = board.registerNewObjective(OBJ, Criteria.DUMMY, title);
            obj.setDisplaySlot(DisplaySlot.SIDEBAR);
            obj.numberFormat(NumberFormat.blank()); // прячем красные цифры справа
            lastLines.remove(id);
        }

        List<Component> lines = new ArrayList<>();
        for (String s : plugin.getConfig().getStringList("sidebar.lines")) {
            if (lines.size() >= MAX_LINES) break;
            lines.add(s.isBlank() ? Component.space() : Text.mm(s, res));
        }
        if (lines.equals(lastLines.get(id))) return;
        lastLines.put(id, lines);

        int size = lines.size();
        for (int i = 0; i < size; i++) {
            Score sc = obj.getScore(entry(i));
            sc.setScore(size - i);
            sc.customName(lines.get(i));
        }
        for (int i = size; i < MAX_LINES; i++) board.resetScores(entry(i));
    }

    private static String entry(int i) {
        return "\u00a7" + Integer.toHexString(i) + "\u00a7r";
    }

    private void updateTab(Player p) {
        if (!plugin.getConfig().getBoolean("tab.enabled", true)) return;
        TagResolver res = resolver(p);
        p.sendPlayerListHeaderAndFooter(
                joinLines(plugin.getConfig().getStringList("tab.header"), res),
                joinLines(plugin.getConfig().getStringList("tab.footer"), res));
    }

    private Component joinLines(List<String> list, TagResolver res) {
        List<Component> cs = new ArrayList<>();
        for (String s : list) cs.add(Text.mm(s, res));
        return Component.join(JoinConfiguration.newlines(), cs);
    }

    // ---------- плейсхолдеры ----------
    private TagResolver resolver(Player p) {
        int ping = p.getPing();
        NamedTextColor pc = ping < 60 ? NamedTextColor.GREEN : ping < 120 ? NamedTextColor.YELLOW : NamedTextColor.RED;

        double tps = Math.min(20.0, Bukkit.getTPS()[0]);
        NamedTextColor tc = tps >= 18 ? NamedTextColor.GREEN : tps >= 15 ? NamedTextColor.YELLOW : NamedTextColor.RED;

        return TagResolver.resolver(
                Text.base(plugin.getConfig()),
                Placeholder.unparsed("player", p.getName()),
                Placeholder.component("rank", plugin.prefixes().rankDisplay(p.getUniqueId())),
                Placeholder.unparsed("online", String.valueOf(Bukkit.getOnlinePlayers().size())),
                Placeholder.unparsed("max", String.valueOf(Bukkit.getMaxPlayers())),
                Placeholder.component("ping", Component.text(ping, pc)),
                Placeholder.component("tps", Component.text(String.format(Locale.US, "%.1f", tps), tc)),
                Placeholder.unparsed("kills", String.valueOf(p.getStatistic(Statistic.PLAYER_KILLS))),
                Placeholder.unparsed("deaths", String.valueOf(p.getStatistic(Statistic.DEATHS))));
    }
}
