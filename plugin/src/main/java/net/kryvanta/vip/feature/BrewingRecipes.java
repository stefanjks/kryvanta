package net.kryvanta.vip.feature;

import org.bukkit.Material;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.PotionMeta;
import org.bukkit.potion.PotionType;

import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;

import static org.bukkit.potion.PotionType.*;

/**
 * Ванильные рецепты варки Minecraft 1.21 (PotionBrewing.addVanillaMixes) для личной варочной стойки.
 */
public final class BrewingRecipes {
    private static final Map<PotionType, Map<Material, PotionType>> MIXES = new EnumMap<>(PotionType.class);

    private static void mix(PotionType from, Material ing, PotionType to) {
        MIXES.computeIfAbsent(from, k -> new HashMap<>()).put(ing, to);
    }

    /** addStartMix: вода + ингредиент → «Обычное зелье», неуклюжее + ингредиент → эффект. */
    private static void start(Material ing, PotionType to) {
        mix(WATER, ing, MUNDANE);
        mix(AWKWARD, ing, to);
    }

    static {
        mix(WATER, Material.GLOWSTONE_DUST, THICK);
        mix(WATER, Material.REDSTONE, MUNDANE);
        mix(WATER, Material.NETHER_WART, AWKWARD);
        start(Material.BREEZE_ROD, WIND_CHARGED);
        start(Material.SLIME_BLOCK, OOZING);
        start(Material.STONE, INFESTED);
        start(Material.COBWEB, WEAVING);
        mix(AWKWARD, Material.GOLDEN_CARROT, NIGHT_VISION);
        mix(NIGHT_VISION, Material.REDSTONE, LONG_NIGHT_VISION);
        mix(NIGHT_VISION, Material.FERMENTED_SPIDER_EYE, INVISIBILITY);
        mix(LONG_NIGHT_VISION, Material.FERMENTED_SPIDER_EYE, LONG_INVISIBILITY);
        mix(INVISIBILITY, Material.REDSTONE, LONG_INVISIBILITY);
        start(Material.MAGMA_CREAM, FIRE_RESISTANCE);
        mix(FIRE_RESISTANCE, Material.REDSTONE, LONG_FIRE_RESISTANCE);
        start(Material.RABBIT_FOOT, LEAPING);
        mix(LEAPING, Material.REDSTONE, LONG_LEAPING);
        mix(LEAPING, Material.GLOWSTONE_DUST, STRONG_LEAPING);
        mix(LEAPING, Material.FERMENTED_SPIDER_EYE, SLOWNESS);
        mix(LONG_LEAPING, Material.FERMENTED_SPIDER_EYE, LONG_SLOWNESS);
        mix(SLOWNESS, Material.REDSTONE, LONG_SLOWNESS);
        mix(SLOWNESS, Material.GLOWSTONE_DUST, STRONG_SLOWNESS);
        mix(AWKWARD, Material.TURTLE_HELMET, TURTLE_MASTER);
        mix(TURTLE_MASTER, Material.REDSTONE, LONG_TURTLE_MASTER);
        mix(TURTLE_MASTER, Material.GLOWSTONE_DUST, STRONG_TURTLE_MASTER);
        mix(SWIFTNESS, Material.FERMENTED_SPIDER_EYE, SLOWNESS);
        mix(LONG_SWIFTNESS, Material.FERMENTED_SPIDER_EYE, LONG_SLOWNESS);
        start(Material.SUGAR, SWIFTNESS);
        mix(SWIFTNESS, Material.REDSTONE, LONG_SWIFTNESS);
        mix(SWIFTNESS, Material.GLOWSTONE_DUST, STRONG_SWIFTNESS);
        mix(AWKWARD, Material.PUFFERFISH, WATER_BREATHING);
        mix(WATER_BREATHING, Material.REDSTONE, LONG_WATER_BREATHING);
        start(Material.GLISTERING_MELON_SLICE, HEALING);
        mix(HEALING, Material.GLOWSTONE_DUST, STRONG_HEALING);
        mix(HEALING, Material.FERMENTED_SPIDER_EYE, HARMING);
        mix(STRONG_HEALING, Material.FERMENTED_SPIDER_EYE, STRONG_HARMING);
        mix(HARMING, Material.GLOWSTONE_DUST, STRONG_HARMING);
        mix(POISON, Material.FERMENTED_SPIDER_EYE, HARMING);
        mix(LONG_POISON, Material.FERMENTED_SPIDER_EYE, HARMING);
        mix(STRONG_POISON, Material.FERMENTED_SPIDER_EYE, STRONG_HARMING);
        start(Material.SPIDER_EYE, POISON);
        mix(POISON, Material.REDSTONE, LONG_POISON);
        mix(POISON, Material.GLOWSTONE_DUST, STRONG_POISON);
        start(Material.GHAST_TEAR, REGENERATION);
        mix(REGENERATION, Material.REDSTONE, LONG_REGENERATION);
        mix(REGENERATION, Material.GLOWSTONE_DUST, STRONG_REGENERATION);
        start(Material.BLAZE_POWDER, STRENGTH);
        mix(STRENGTH, Material.REDSTONE, LONG_STRENGTH);
        mix(STRENGTH, Material.GLOWSTONE_DUST, STRONG_STRENGTH);
        mix(WATER, Material.FERMENTED_SPIDER_EYE, WEAKNESS);
        mix(WEAKNESS, Material.REDSTONE, LONG_WEAKNESS);
        mix(AWKWARD, Material.PHANTOM_MEMBRANE, SLOW_FALLING);
        mix(SLOW_FALLING, Material.REDSTONE, LONG_SLOW_FALLING);
    }

    private BrewingRecipes() {}

    public static boolean isBottle(ItemStack s) {
        if (s == null) return false;
        Material m = s.getType();
        return m == Material.POTION || m == Material.SPLASH_POTION || m == Material.LINGERING_POTION;
    }

    private static ItemStack retype(ItemStack bottle, Material to) {
        ItemStack out = new ItemStack(to, bottle.getAmount());
        out.setItemMeta(bottle.getItemMeta());
        return out;
    }

    /** Результат варки одной бутылки или null, если ингредиент к ней не подходит. */
    public static ItemStack result(ItemStack bottle, ItemStack ingredient) {
        if (!isBottle(bottle) || bottle.getAmount() != 1 || ingredient == null || !(bottle.getItemMeta() instanceof PotionMeta meta)) return null;
        Material ing = ingredient.getType();
        // смена типа бутылки: порох → взрывное, драконье дыхание → туманное
        if (ing == Material.GUNPOWDER && bottle.getType() == Material.POTION) return retype(bottle, Material.SPLASH_POTION);
        if (ing == Material.DRAGON_BREATH && bottle.getType() == Material.SPLASH_POTION) return retype(bottle, Material.LINGERING_POTION);
        PotionType base = meta.getBasePotionType();
        if (base == null) return null;
        PotionType to = MIXES.getOrDefault(base, Map.of()).get(ing);
        if (to == null) return null;
        ItemStack out = bottle.clone();
        PotionMeta pm = (PotionMeta) out.getItemMeta();
        pm.setBasePotionType(to);
        out.setItemMeta(pm);
        return out;
    }
}
