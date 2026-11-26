package net.kryvanta.vip.logic;

import java.util.Random;

/**
 * Стоимость предложений стола зачарования — алгоритм ванильного EnchantmentHelper.getEnchantmentCost
 * для указанного числа книжных полок (максимум 15 → уровень 30).
 * Ванильный стол засевает генератор семенем зачарования игрока; LegacyRandomSource использует тот же
 * линейный конгруэнтный генератор, что и java.util.Random, поэтому значения совпадают с настоящим столом.
 */
public final class EnchantCosts {
    private EnchantCosts() {}

    public static int[] costs(long enchantmentSeed, int bookshelves) {
        int shelves = Math.max(0, Math.min(15, bookshelves));
        Random random = new Random(enchantmentSeed);
        int[] out = new int[3];
        for (int slot = 0; slot < 3; slot++) {
            int j = random.nextInt(8) + 1 + (shelves >> 1) + random.nextInt(shelves + 1);
            int cost = slot == 0 ? Math.max(j / 3, 1) : slot == 1 ? j * 2 / 3 + 1 : Math.max(j, shelves * 2);
            out[slot] = cost < slot + 1 ? 0 : cost;
        }
        return out;
    }
}
