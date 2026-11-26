package net.kryvanta.vip.feature;

import net.kryvanta.core.Text;
import net.kryvanta.vip.VipModule;
import net.kryvanta.vip.data.PlayerData;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.Sound;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.event.inventory.InventoryType;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.InventoryView;
import org.bukkit.inventory.ItemStack;

import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * /brew — личная варочная стойка. Это настоящий интерфейс варочной стойки, но варка выполняется
 * плагином по ванильным правилам (400 тиков, 1 огненный порошок = 20 варок, ванильные рецепты).
 * Содержимое хранится в данных игрока и не теряется при закрытии меню, выходе и перезапуске.
 * Варка идёт, пока игрок в сети.
 */
public final class BrewingFeature implements Listener {
    private static final int BREW_TICKS = 400;

    public static final class Stand implements InventoryHolder {
        final UUID owner;
        Inventory inv;
        Stand(UUID owner) { this.owner = owner; }
        @Override public Inventory getInventory() { return inv; }
    }

    private final VipModule vip;
    private final Map<UUID, Stand> stands = new ConcurrentHashMap<>();

    public BrewingFeature(VipModule vip) { this.vip = vip; }

    private Stand stand(Player p) {
        return stands.computeIfAbsent(p.getUniqueId(), id -> {
            Stand s = new Stand(id);
            s.inv = Bukkit.createInventory(s, InventoryType.BREWING, Text.mm("<gradient:#e9cf7a:#d4af37>Личная варочная стойка</gradient>"));
            PlayerData d = vip.store().get(id);
            if (d != null) for (int i = 0; i < 5; i++) s.inv.setItem(i, decode(d.brewSlots[i]));
            return s;
        });
    }

    public void open(Player p) {
        p.openInventory(stand(p).inv);
        updateViewers(p.getUniqueId());
    }

    /** Сохранить содержимое в данные игрока (основной поток). */
    public void persist(UUID id) {
        Stand s = stands.get(id);
        PlayerData d = vip.store().get(id);
        if (s == null || d == null) return;
        for (int i = 0; i < 5; i++) d.brewSlots[i] = encode(s.inv.getItem(i));
    }

    /** Выход игрока: сохранить и выгрузить стойку. */
    public void unload(Player p) {
        Stand s = stands.get(p.getUniqueId());
        if (s == null) return;
        for (var viewer : s.inv.getViewers().toArray(new org.bukkit.entity.HumanEntity[0])) viewer.closeInventory();
        persist(p.getUniqueId());
        stands.remove(p.getUniqueId());
    }

    /** После окончания VIP содержимое стойки возвращается игроку (лишнее выпадает рядом). */
    public void returnContents(Player p) {
        Stand s = stand(p);
        for (var viewer : s.inv.getViewers().toArray(new org.bukkit.entity.HumanEntity[0])) viewer.closeInventory();
        boolean any = false;
        for (int i = 0; i < 5; i++) {
            ItemStack it = s.inv.getItem(i);
            if (it == null || it.getType().isAir()) continue;
            any = true;
            s.inv.setItem(i, null);
            p.getInventory().addItem(it).values().forEach(left -> p.getWorld().dropItemNaturally(p.getLocation(), left));
        }
        PlayerData d = vip.store().get(p.getUniqueId());
        if (d != null) { d.brewTime = 0; persist(p.getUniqueId()); vip.store().save(d); }
        if (any) Text.send(p, "<yellow>Содержимое личной варочной стойки возвращено в инвентарь.");
    }

    @EventHandler
    public void onClose(InventoryCloseEvent e) {
        if (e.getInventory().getHolder(false) instanceof Stand s) {
            persist(s.owner);
            PlayerData d = vip.store().get(s.owner);
            if (d != null) vip.store().save(d);
        }
    }

    /** Каждый тик: ванильная логика BrewingStandBlockEntity.serverTick. */
    public void tick() {
        for (Stand s : stands.values()) {
            PlayerData d = vip.store().get(s.owner);
            if (d == null) continue;
            Inventory inv = s.inv;
            ItemStack fuelItem = inv.getItem(4);
            if (d.brewFuel <= 0 && fuelItem != null && fuelItem.getType() == Material.BLAZE_POWDER) {
                d.brewFuel = 20;
                fuelItem.setAmount(fuelItem.getAmount() - 1);
                inv.setItem(4, fuelItem.getAmount() > 0 ? fuelItem : null);
            }
            ItemStack ingredient = inv.getItem(3);
            boolean canBrew = canBrew(inv);
            if (d.brewTime > 0) {
                d.brewTime--;
                if (d.brewTime == 0 && canBrew) {
                    doBrew(inv);
                    persist(s.owner);
                    vip.store().save(d);
                    Player p = Bukkit.getPlayer(s.owner);
                    if (p != null && inv.getViewers().contains(p)) p.playSound(p.getLocation(), Sound.BLOCK_BREWING_STAND_BREW, 1f, 1f);
                } else if (!canBrew || ingredient == null || !ingredient.getType().name().equals(d.brewIngredient)) {
                    d.brewTime = 0;
                }
            } else if (canBrew && d.brewFuel > 0) {
                d.brewFuel--;
                d.brewTime = BREW_TICKS;
                d.brewIngredient = ingredient.getType().name();
            }
            if (!inv.getViewers().isEmpty()) updateViewers(s.owner);
        }
    }

    private void updateViewers(UUID owner) {
        Stand s = stands.get(owner);
        PlayerData d = vip.store().get(owner);
        if (s == null || d == null) return;
        for (var viewer : s.inv.getViewers()) {
            InventoryView view = viewer.getOpenInventory();
            if (view.getTopInventory() != s.inv) continue;
            view.setProperty(InventoryView.Property.BREW_TIME, d.brewTime);
            view.setProperty(InventoryView.Property.FUEL_TIME, d.brewFuel);
        }
    }

    private static boolean canBrew(Inventory inv) {
        ItemStack ing = inv.getItem(3);
        if (ing == null || ing.getType().isAir()) return false;
        for (int i = 0; i < 3; i++) if (BrewingRecipes.result(inv.getItem(i), ing) != null) return true;
        return false;
    }

    private static void doBrew(Inventory inv) {
        ItemStack ing = inv.getItem(3);
        for (int i = 0; i < 3; i++) {
            ItemStack r = BrewingRecipes.result(inv.getItem(i), ing);
            if (r != null) inv.setItem(i, r);
        }
        ing.setAmount(ing.getAmount() - 1);
        inv.setItem(3, ing.getAmount() > 0 ? ing : null);
    }

    static String encode(ItemStack it) {
        if (it == null || it.getType().isAir()) return null;
        return Base64.getEncoder().encodeToString(it.serializeAsBytes());
    }

    static ItemStack decode(String s) {
        if (s == null || s.isEmpty()) return null;
        try {
            return ItemStack.deserializeBytes(Base64.getDecoder().decode(s));
        } catch (Exception e) {
            return null;
        }
    }
}
