package net.kryvanta.vip.feature;

import net.kryvanta.core.Text;
import net.kryvanta.vip.VipModule;
import net.kryvanta.vip.data.PlayerData;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.block.Block;
import org.bukkit.block.data.Waterlogged;
import org.bukkit.entity.Boat;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.util.Vector;

import java.util.List;
import java.util.Set;

/**
 * /boat — ускорение лодки. Срабатывает только если:
 *  - лодкой управляет (первый пассажир) сам VIP с выбранным уровнем ускорения,
 *  - лодка на воде (на льду и суше ускорение не работает — нет «ледяных трасс»),
 *  - игрок нажимает «вперёд».
 * Скорость плавно доводится до максимума уровня и никогда его не превышает.
 */
public final class BoatFeature {
    private static final Set<Material> ICE = Set.of(Material.ICE, Material.PACKED_ICE, Material.BLUE_ICE, Material.FROSTED_ICE);
    private static final double ACCEL = 1.06;
    private final VipModule vip;

    public BoatFeature(VipModule vip) { this.vip = vip; }

    public void choose(Player p, int level) {
        if (level < 0 || level > 3) return;
        PlayerData d = vip.store().get(p.getUniqueId());
        if (d == null) return;
        d.boatLevel = level;
        vip.store().save(d);
        Text.send(p, level == 0 ? "<green>Обычная скорость лодки." : "<green>Ускорение лодки: <white>" + "I".repeat(level));
    }

    private static boolean onWater(Boat b) {
        Block at = b.getLocation().getBlock();
        Block below = b.getLocation().clone().subtract(0, 0.35, 0).getBlock();
        if (ICE.contains(below.getType()) || ICE.contains(at.getRelative(0, -1, 0).getType())) return false;
        return isWater(at) || isWater(below);
    }

    private static boolean isWater(Block b) {
        return b.getType() == Material.WATER || (b.getBlockData() instanceof Waterlogged w && w.isWaterlogged());
    }

    /** Каждый тик. */
    public void tick() {
        if (!vip.sync().featureEnabled("boat")) return;
        List<Double> caps = vip.sync().boatMaxSpeeds;
        for (Player p : Bukkit.getOnlinePlayers()) {
            if (!(p.getVehicle() instanceof Boat boat)) continue;
            List<Entity> passengers = boat.getPassengers();
            if (passengers.isEmpty() || !passengers.get(0).equals(p)) continue; // только водитель
            PlayerData d = vip.store().get(p.getUniqueId());
            if (d == null || d.boatLevel <= 0 || !vip.isVip(p)) continue;
            if (!p.getCurrentInput().isForward() || !onWater(boat)) continue;
            double cap = caps.get(Math.min(3, d.boatLevel) - 1);
            Vector v = boat.getVelocity();
            double speed = Math.hypot(v.getX(), v.getZ());
            if (speed < 0.05 || speed >= cap) continue;
            double target = Math.min(cap, speed * ACCEL);
            double k = target / speed;
            boat.setVelocity(new Vector(v.getX() * k, v.getY(), v.getZ() * k));
        }
    }
}
