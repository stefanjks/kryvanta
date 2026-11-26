package net.kryvanta.vip.feature;

import net.kryvanta.vip.VipModule;
import net.kryvanta.vip.logic.EnchantCosts;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.enchantments.Enchantment;
import org.bukkit.enchantments.EnchantmentOffer;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.enchantment.EnchantItemEvent;
import org.bukkit.event.enchantment.PrepareItemEnchantEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.InventoryView;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.EnchantmentStorageMeta;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Виртуальные рабочие станции — настоящие ванильные меню (контейнеры сервера), открытые в позиции игрока
 * без проверки расстояния до блока. Все механики (ремонт, опыт, рецепты, возврат предметов при закрытии)
 * выполняет сам сервер. Эндер-сундук — личное хранилище игрока.
 *
 * Стол зачарования: ванильный алгоритм с силой 15 книжных полок (уровень 30), обычные стоимость опыта
 * и расход лазурита (их списывает сервер), зачарования выбираются ванильным EnchantmentHelper.
 */
@SuppressWarnings("deprecation")
public final class Workstations implements Listener {
    private static final int SHELVES = 15;
    private final VipModule vip;
    /** Открытые виртуальные столы зачарования. */
    private final Map<UUID, InventoryView> enchantViews = new ConcurrentHashMap<>();

    public Workstations(VipModule vip) { this.vip = vip; }

    public void open(Player p, String key) {
        var loc = p.getLocation();
        switch (key) {
            case "ec" -> p.openInventory(p.getEnderChest());
            case "anvil" -> p.openAnvil(loc, true);
            case "craft" -> p.openWorkbench(loc, true);
            case "grindstone" -> p.openGrindstone(loc, true);
            case "smithing" -> p.openSmithingTable(loc, true);
            case "loom" -> p.openLoom(loc, true);
            case "stonecutter" -> p.openStonecutter(loc, true);
            case "cartography" -> p.openCartographyTable(loc, true);
            case "enchant" -> {
                InventoryView v = p.openEnchanting(loc, true);
                if (v != null) enchantViews.put(p.getUniqueId(), v);
            }
            case "brew" -> vip.brewing().open(p);
            default -> { }
        }
    }

    private boolean isVirtual(Player p, InventoryView view) {
        InventoryView v = enchantViews.get(p.getUniqueId());
        return v != null && (v == view || v.getTopInventory().equals(view.getTopInventory()));
    }

    /** Набор зачарований для слота: детерминирован по семени игрока, поэтому подсказка совпадает с результатом. */
    static Map<Enchantment, Integer> roll(ItemStack item, int seed, int slot, int cost) {
        ItemStack base = item.clone();
        base.setAmount(1);
        Random r = new Random((long) seed + slot);
        ItemStack res = Bukkit.getItemFactory().enchantWithLevels(base, cost, false, r);
        Map<Enchantment, Integer> map = new LinkedHashMap<>();
        ItemMeta meta = res.getItemMeta();
        if (meta instanceof EnchantmentStorageMeta esm) map.putAll(esm.getStoredEnchants());
        else if (meta != null) map.putAll(meta.getEnchants());
        if (item.getType() == Material.BOOK && map.size() > 1) {
            // как у ванильного стола: книга получает на одно зачарование меньше
            List<Enchantment> keys = new ArrayList<>(map.keySet());
            map.remove(keys.get(r.nextInt(keys.size())));
        }
        return map;
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onPrepare(PrepareItemEnchantEvent e) {
        Player p = e.getEnchanter();
        if (!isVirtual(p, e.getView())) return;
        int seed = p.getEnchantmentSeed();
        int[] costs = EnchantCosts.costs(seed, SHELVES);
        EnchantmentOffer[] offers = e.getOffers();
        for (int slot = 0; slot < 3; slot++) {
            offers[slot] = null;
            if (costs[slot] <= 0) continue;
            Map<Enchantment, Integer> list = roll(e.getItem(), seed, slot, costs[slot]);
            if (list.isEmpty()) continue;
            Map.Entry<Enchantment, Integer> hint = list.entrySet().iterator().next();
            offers[slot] = new EnchantmentOffer(hint.getKey(), hint.getValue(), costs[slot]);
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onEnchant(EnchantItemEvent e) {
        Player p = e.getEnchanter();
        if (!isVirtual(p, e.getView())) return;
        int slot = e.whichButton();
        int seed = p.getEnchantmentSeed();
        int cost = EnchantCosts.costs(seed, SHELVES)[slot];
        if (cost <= 0 || cost != e.getExpLevelCost()) { e.setCancelled(true); return; }
        Map<Enchantment, Integer> list = roll(e.getItem(), seed, slot, cost);
        if (list.isEmpty()) { e.setCancelled(true); return; }
        e.getEnchantsToAdd().clear();
        e.getEnchantsToAdd().putAll(list);
        // уровень и лазурит списывает сервер по ванильным правилам (кнопка + 1)
    }

    @EventHandler
    public void onClose(InventoryCloseEvent e) {
        if (e.getPlayer() instanceof Player p && isVirtual(p, e.getView())) enchantViews.remove(p.getUniqueId());
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent e) { enchantViews.remove(e.getPlayer().getUniqueId()); }
}
