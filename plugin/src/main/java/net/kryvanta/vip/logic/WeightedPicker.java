package net.kryvanta.vip.logic;

import java.util.List;
import java.util.Random;
import java.util.function.ToIntFunction;

public final class WeightedPicker {
    private WeightedPicker() {}

    /** Выбор по весам. Элементы с весом <= 0 не выпадают. null — если выбирать не из чего. */
    public static <T> T pick(List<T> items, ToIntFunction<T> weight, Random random) {
        long total = 0;
        for (T t : items) total += Math.max(0, weight.applyAsInt(t));
        if (total <= 0) return null;
        long r = (long) (random.nextDouble() * total);
        for (T t : items) {
            int w = Math.max(0, weight.applyAsInt(t));
            if (r < w) return t;
            r -= w;
        }
        return items.get(items.size() - 1);
    }
}
