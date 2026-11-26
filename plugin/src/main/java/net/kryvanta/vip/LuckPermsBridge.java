package net.kryvanta.vip;

import net.luckperms.api.LuckPerms;
import net.luckperms.api.LuckPermsProvider;
import net.luckperms.api.model.group.Group;
import net.luckperms.api.model.user.User;
import net.luckperms.api.node.Node;
import net.luckperms.api.node.NodeType;
import net.luckperms.api.node.types.InheritanceNode;
import net.luckperms.api.node.types.PermissionNode;
import net.luckperms.api.node.types.PrefixNode;
import net.luckperms.api.node.types.WeightNode;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * Интеграция с LuckPerms. VIP — это членство в группе kryvanta_vip с временем окончания
 * (временный узел LuckPerms), поэтому VIP снимается автоматически даже при выключенном сайте.
 * Группа содержит только разрешения kryvanta.vip.* и префикс — никаких административных прав и OP.
 */
public final class LuckPermsBridge {
    public static final List<String> VIP_PERMISSIONS = List.of(
            "kryvanta.vip", "kryvanta.vip.menu", "kryvanta.vip.size", "kryvanta.vip.boat", "kryvanta.vip.ec",
            "kryvanta.vip.anvil", "kryvanta.vip.craft", "kryvanta.vip.enchant", "kryvanta.vip.grindstone",
            "kryvanta.vip.smithing", "kryvanta.vip.loom", "kryvanta.vip.stonecutter", "kryvanta.vip.cartography",
            "kryvanta.vip.brew", "kryvanta.vip.rewards", "kryvanta.vip.settings");

    private final Plugin plugin;
    private final LuckPerms lp;
    private final String group;

    public LuckPermsBridge(Plugin plugin, String group) {
        this.plugin = plugin;
        this.lp = LuckPermsProvider.get();
        this.group = group;
    }

    public String group() { return group; }

    /** Создаёт/обновляет группу kryvanta_vip: разрешения, префикс, вес. Опасные узлы удаляются. */
    public CompletableFuture<Void> ensureGroup(String prefix, int prefixPriority, int weight) {
        return lp.getGroupManager().createAndLoadGroup(group).thenCompose(g -> {
            g.data().clear(n -> n instanceof PrefixNode || n instanceof WeightNode);
            // защита от случайно выданных групп/прав администратора
            g.data().clear(n -> n instanceof InheritanceNode
                    || (n instanceof PermissionNode p && !p.getPermission().startsWith("kryvanta.vip") && !p.getPermission().startsWith("kryvanta.board")));
            for (String perm : VIP_PERMISSIONS) g.data().add(PermissionNode.builder(perm).value(true).build());
            g.data().add(PermissionNode.builder("kryvanta.admin").value(false).build());
            g.data().add(PrefixNode.builder(prefix, prefixPriority).build());
            g.data().add(WeightNode.builder(weight).build());
            return lp.getGroupManager().saveGroup(g);
        }).exceptionally(ex -> {
            plugin.getLogger().severe("LuckPerms: не удалось настроить группу " + group + ": " + ex.getMessage());
            return null;
        });
    }

    private boolean isOurNode(Node n) {
        return n instanceof InheritanceNode i && i.getGroupName().equalsIgnoreCase(group);
    }

    /** Выдать VIP до указанного момента (null — снять). Работает и для офлайн-игроков. */
    public CompletableFuture<Void> setVip(UUID uuid, Instant until) {
        return lp.getUserManager().modifyUser(uuid, (User u) -> {
            u.data().clear(this::isOurNode);
            if (until != null && until.isAfter(Instant.now())) {
                u.data().add(InheritanceNode.builder(group).expiry(until.getEpochSecond()).build());
            }
        });
    }

    /** Текущее окончание VIP по данным LuckPerms (null — нет VIP). Только для онлайн-игроков. */
    public Instant currentExpiry(Player p) {
        User u = lp.getUserManager().getUser(p.getUniqueId());
        if (u == null) return null;
        return u.getNodes(NodeType.INHERITANCE).stream()
                .filter(this::isOurNode)
                .map(n -> n.hasExpiry() ? n.getExpiry() : Instant.MAX)
                .max(Instant::compareTo).orElse(null);
    }

    /** Префикс игрока из LuckPerms (meta), либо null. */
    public String prefix(UUID uuid) {
        User u = lp.getUserManager().getUser(uuid);
        if (u == null) return null;
        return u.getCachedData().getMetaData().getPrefix();
    }

    public int groupWeight(UUID uuid) {
        User u = lp.getUserManager().getUser(uuid);
        if (u == null) return 0;
        int best = 0;
        for (Group g : u.getInheritedGroups(u.getQueryOptions())) best = Math.max(best, g.getWeight().orElse(0));
        return best;
    }

    public LuckPerms api() { return lp; }
}
