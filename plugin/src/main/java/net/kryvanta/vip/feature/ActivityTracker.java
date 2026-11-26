package net.kryvanta.vip.feature;

import io.papermc.paper.event.player.AsyncChatEvent;
import net.kryvanta.vip.VipModule;
import net.kryvanta.vip.data.PlayerData;
import net.kryvanta.vip.logic.ActivityPolicy;
import net.kryvanta.vip.logic.RewardClock;
import org.bukkit.Bukkit;
import org.bukkit.Input;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.entity.Projectile;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.player.*;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Учёт реального активного игрового времени. Каждую секунду онлайн-игрокам, которые были активны
 * в пределах AFK-таймаута, добавляется 1 секунда: в общую статистику (для реферальной программы) и,
 * для VIP, в прогресс награды.
 */
public final class ActivityTracker implements Listener {
    private final VipModule vip;
    private final Map<UUID, Long> lastActivity = new ConcurrentHashMap<>();
    private final Map<UUID, float[]> lastRotationDelta = new ConcurrentHashMap<>();
    private final Map<UUID, Integer> sameRotationCount = new ConcurrentHashMap<>();

    public ActivityTracker(VipModule vip) { this.vip = vip; }

    public void touch(Player p) { lastActivity.put(p.getUniqueId(), System.currentTimeMillis()); }

    public boolean isActive(Player p) {
        return ActivityPolicy.isActive(System.currentTimeMillis(), lastActivity.getOrDefault(p.getUniqueId(), 0L), vip.sync().afkTimeoutSeconds);
    }

    /** Вызывается раз в секунду из основного потока. */
    public void tick() {
        for (Player p : Bukkit.getOnlinePlayers()) {
            if (!isActive(p)) continue;
            PlayerData d = vip.store().get(p.getUniqueId());
            if (d == null) continue;
            d.unsentActiveSeconds++;
            d.totalActiveSeconds++;
            if (vip.isVip(p) && vip.sync().rewardsEnabled && vip.sync().featureEnabled("rewards")) {
                int before = d.credits.size();
                RewardClock.Step s = RewardClock.advance(d.rewardProgressSeconds, playtimeCredits(d), 1, vip.sync().rewardIntervalSeconds, vip.sync().maxStoredRewards);
                d.rewardProgressSeconds = s.progressSeconds();
                for (int i = 0; i < s.newRewards(); i++) vip.rewards().creditPlaytime(p, d);
                if (d.credits.size() > before) vip.store().save(d);
            }
        }
    }

    private int playtimeCredits(PlayerData d) {
        int n = 0;
        for (PlayerData.Credit c : d.credits) if ("PLAYTIME".equals(c.source())) n++;
        return n;
    }

    // ---------------- сигналы активности ----------------
    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onMove(PlayerMoveEvent e) {
        Location f = e.getFrom(), t = e.getTo();
        Player p = e.getPlayer();
        float dYaw = t.getYaw() - f.getYaw(), dPitch = t.getPitch() - f.getPitch();
        if (ActivityPolicy.significantRotation(dYaw, dPitch)) {
            float[] prev = lastRotationDelta.get(p.getUniqueId());
            boolean same = prev != null && Math.abs(prev[0] - dYaw) < 0.01f && Math.abs(prev[1] - dPitch) < 0.01f;
            int n = same ? sameRotationCount.merge(p.getUniqueId(), 1, Integer::sum) : 0;
            if (!same) sameRotationCount.put(p.getUniqueId(), 0);
            lastRotationDelta.put(p.getUniqueId(), new float[]{dYaw, dPitch});
            if (n < ActivityPolicy.MACRO_REPEATS) touch(p);
            return;
        }
        double dx = t.getX() - f.getX(), dz = t.getZ() - f.getZ();
        Input in = p.getCurrentInput();
        boolean keys = in.isForward() || in.isBackward() || in.isLeft() || in.isRight() || in.isJump();
        if (ActivityPolicy.intentionalMove(keys, dx * dx + dz * dz, p.isInsideVehicle())) touch(p);
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onVehicleInput(PlayerInputEvent e) {
        // управление лодкой/лошадью — осознанное действие
        if (e.getPlayer().isInsideVehicle() && (e.getInput().isForward() || e.getInput().isBackward() || e.getInput().isLeft() || e.getInput().isRight())) touch(e.getPlayer());
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true) public void onBreak(BlockBreakEvent e) { touch(e.getPlayer()); }
    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true) public void onPlace(BlockPlaceEvent e) { touch(e.getPlayer()); }
    @EventHandler(priority = EventPriority.MONITOR) public void onInteract(PlayerInteractEvent e) { touch(e.getPlayer()); }
    @EventHandler(priority = EventPriority.MONITOR) public void onChat(AsyncChatEvent e) { touch(e.getPlayer()); }
    @EventHandler(priority = EventPriority.MONITOR) public void onCommand(PlayerCommandPreprocessEvent e) { touch(e.getPlayer()); }
    @EventHandler(priority = EventPriority.MONITOR) public void onInv(InventoryClickEvent e) { if (e.getWhoClicked() instanceof Player p) touch(p); }
    @EventHandler(priority = EventPriority.MONITOR) public void onConsume(PlayerItemConsumeEvent e) { touch(e.getPlayer()); }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onAttack(EntityDamageByEntityEvent e) {
        if (e.getDamager() instanceof Player p) touch(p);
        else if (e.getDamager() instanceof Projectile pr && pr.getShooter() instanceof Player p) touch(p);
    }

    @EventHandler public void onJoin(PlayerJoinEvent e) { touch(e.getPlayer()); }

    @EventHandler public void onQuit(PlayerQuitEvent e) {
        UUID id = e.getPlayer().getUniqueId();
        lastActivity.remove(id);
        lastRotationDelta.remove(id);
        sameRotationCount.remove(id);
    }
}
