package net.kryvanta.vip.gui;

import net.kryvanta.core.Text;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.ClickType;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.*;
import java.util.function.BiConsumer;

/**
 * Простое меню-интерфейс. Все клики в нём отменяются (см. MenuListener), предметы забрать нельзя —
 * кнопки только вызывают действия.
 */
public abstract class Menu implements InventoryHolder {
    protected final Player player;
    private final Inventory inv;
    private final Map<Integer, BiConsumer<Player, ClickType>> actions = new HashMap<>();

    protected Menu(Player player, int rows, String title) {
        this.player = player;
        this.inv = Bukkit.createInventory(this, rows * 9, Text.mm(title));
    }

    @Override
    public Inventory getInventory() { return inv; }

    protected abstract void render();

    public void open() {
        redraw();
        player.openInventory(inv);
    }

    public void redraw() {
        inv.clear();
        actions.clear();
        fillBorder();
        render();
    }

    protected void set(int slot, ItemStack item, BiConsumer<Player, ClickType> action) {
        inv.setItem(slot, item);
        if (action != null) actions.put(slot, action);
    }

    void click(int slot, ClickType type) {
        BiConsumer<Player, ClickType> a = actions.get(slot);
        if (a != null) a.accept(player, type);
    }

    private void fillBorder() {
        ItemStack pane = item(Material.BLACK_STAINED_GLASS_PANE, " ");
        int size = inv.getSize();
        for (int i = 0; i < size; i++) {
            int r = i / 9, c = i % 9;
            if (r == 0 || r == size / 9 - 1 || c == 0 || c == 8) inv.setItem(i, pane);
        }
    }

    public static ItemStack item(Material m, String name, String... lore) {
        return item(m, name, Arrays.asList(lore));
    }

    public static ItemStack item(Material m, String name, List<String> lore) {
        ItemStack it = new ItemStack(m);
        ItemMeta meta = it.getItemMeta();
        if (meta != null) {
            meta.displayName(Text.mm(name).decorationIfAbsent(TextDecoration.ITALIC, TextDecoration.State.FALSE));
            List<Component> l = new ArrayList<>();
            for (String s : lore) l.add(Text.mm(s).decorationIfAbsent(TextDecoration.ITALIC, TextDecoration.State.FALSE));
            meta.lore(l);
            meta.addItemFlags(ItemFlag.values());
            it.setItemMeta(meta);
        }
        return it;
    }

    public static ItemStack glow(ItemStack it, boolean on) {
        if (!on) return it;
        ItemMeta meta = it.getItemMeta();
        meta.setEnchantmentGlintOverride(true);
        it.setItemMeta(meta);
        return it;
    }
}
