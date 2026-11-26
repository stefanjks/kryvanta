package net.kryvanta.vip.feature;

import net.kryvanta.core.Text;
import net.kryvanta.vip.VipModule;
import net.kryvanta.vip.data.PlayerData;
import org.bukkit.Bukkit;
import org.bukkit.World;
import org.bukkit.attribute.Attribute;
import org.bukkit.attribute.AttributeInstance;
import org.bukkit.block.Block;
import org.bukkit.entity.Player;
import org.bukkit.entity.Projectile;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.player.PlayerRespawnEvent;
import org.bukkit.util.BoundingBox;
import org.bukkit.util.VoxelShape;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * /size — масштаб персонажа через атрибут minecraft:scale. Атрибут честно меняет хитбокс,
 * высоту глаз и камеру. Защита от преимуществ:
 *  - разрешены только размеры из настроек администрации;
 *  - увеличение невозможно, если новый хитбокс пересечётся с блоками (нельзя застрять/пройти сквозь стену);
 *  - в PvP-бою размер временно возвращается к 1.0 (маленький хитбокс не даёт преимущества);
 *  - после окончания VIP размер сбрасывается.
 */
public final class SizeFeature implements Listener {
    private static final long COMBAT_MS = 15_000;
    private final VipModule vip;
    private final Map<UUID, Long> combatUntil = new ConcurrentHashMap<>();

    public SizeFeature(VipModule vip) { this.vip = vip; }

    private static AttributeInstance attr(Player p) { return p.getAttribute(Attribute.SCALE); }

    public double current(Player p) {
        AttributeInstance a = attr(p);
        return a == null ? 1.0 : a.getBaseValue();
    }

    public boolean inCombat(Player p) { return combatUntil.getOrDefault(p.getUniqueId(), 0L) > System.currentTimeMillis(); }

    /** Проверка: поместится ли игрок с новым масштабом на текущем месте. */
    public boolean fits(Player p, double scale) {
        double w = 0.6 * scale, h = 1.8 * scale;
        double x = p.getLocation().getX(), y = p.getLocation().getY(), z = p.getLocation().getZ();
        BoundingBox box = new BoundingBox(x - w / 2, y + 0.001, z - w / 2, x + w / 2, y + h, z + w / 2);
        World world = p.getWorld();
        for (int bx = (int) Math.floor(box.getMinX()); bx <= (int) Math.floor(box.getMaxX()); bx++)
            for (int by = (int) Math.floor(box.getMinY()); by <= (int) Math.floor(box.getMaxY()); by++)
                for (int bz = (int) Math.floor(box.getMinZ()); bz <= (int) Math.floor(box.getMaxZ()); bz++) {
                    Block b = world.getBlockAt(bx, by, bz);
                    if (b.isPassable()) continue;
                    VoxelShape shape = b.getCollisionShape();
                    if (shape.overlaps(box.clone().shift(-bx, -by, -bz))) return false;
                }
        return true;
    }

    /** Выбор размера игроком. */
    public void choose(Player p, double scale) {
        if (!vip.sync().allowedScales.contains(scale)) { Text.send(p, "<red>Этот размер недоступен."); return; }
        if (inCombat(p)) { Text.send(p, "<red>Нельзя менять размер во время боя."); return; }
        if (scale > current(p) && !fits(p, scale)) { Text.send(p, "<red>Здесь недостаточно места для такого размера."); return; }
        PlayerData d = vip.store().get(p.getUniqueId());
        if (d == null) return;
        d.scale = scale;
        vip.store().save(d);
        apply(p, scale);
        Text.send(p, "<green>Размер изменён: <white>" + format(scale) + "x");
    }

    public static String format(double s) {
        String r = String.valueOf(s);
        return r.endsWith(".0") ? r.substring(0, r.length() - 2) + ".0" : r;
    }

    private void apply(Player p, double scale) {
        AttributeInstance a = attr(p);
        if (a != null && Math.abs(a.getBaseValue() - scale) > 1e-6) a.setBaseValue(scale);
    }

    /** Синхронизировать фактический размер с настройкой/статусом VIP (вход, конец боя, окончание VIP). */
    public void refresh(Player p) {
        PlayerData d = vip.store().get(p.getUniqueId());
        double want = 1.0;
        if (d != null && vip.isVip(p) && vip.sync().featureEnabled("size") && vip.sync().allowedScales.contains(d.scale)) want = d.scale;
        if (inCombat(p) && vip.sync().combatNormalizeScale) want = 1.0;
        if (want > current(p) && !fits(p, want)) return; // попробуем позже, когда будет место
        apply(p, want);
    }

    public void reset(Player p) { apply(p, 1.0); }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onPvp(EntityDamageByEntityEvent e) {
        if (!(e.getEntity() instanceof Player victim)) return;
        Player attacker = e.getDamager() instanceof Player p ? p
                : e.getDamager() instanceof Projectile pr && pr.getShooter() instanceof Player p2 ? p2 : null;
        if (attacker == null || attacker.equals(victim)) return;
        long until = System.currentTimeMillis() + COMBAT_MS;
        for (Player p : new Player[]{victim, attacker}) {
            combatUntil.put(p.getUniqueId(), until);
            if (vip.sync().combatNormalizeScale && Math.abs(current(p) - 1.0) > 1e-6) {
                if (current(p) < 1.0 && !fits(p, 1.0)) continue;
                apply(p, 1.0);
                Text.send(p, "<gray>Вы в бою — размер временно возвращён к 1.0x.");
            }
        }
    }

    @EventHandler
    public void onRespawn(PlayerRespawnEvent e) {
        Player p = e.getPlayer();
        Bukkit.getScheduler().runTaskLater(vip.plugin(), (Runnable) () -> { if (p.isOnline()) refresh(p); }, 2L);
    }

    /** Каждую секунду: окончание боя → восстановить выбранный размер. */
    public void tick() {
        long now = System.currentTimeMillis();
        combatUntil.entrySet().removeIf(en -> {
            if (en.getValue() > now) return false;
            Player p = Bukkit.getPlayer(en.getKey());
            if (p != null) refresh(p);
            return true;
        });
    }
}
