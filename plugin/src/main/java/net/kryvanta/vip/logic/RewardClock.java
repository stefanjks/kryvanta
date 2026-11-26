package net.kryvanta.vip.logic;

/**
 * Накопление времени до VIP-награды. Чистая логика без Bukkit — покрыта unit-тестами.
 */
public final class RewardClock {
    private RewardClock() {}

    /** Результат одного шага: новый прогресс и сколько наград нужно начислить. */
    public record Step(long progressSeconds, int newRewards) {}

    /**
     * @param progress   текущий прогресс (сек)
     * @param stored     сколько наград уже накоплено и не забрано
     * @param add        сколько активных секунд добавить
     * @param interval   интервал награды (сек)
     * @param maxStored  максимум накопленных наград (дальше прогресс замирает на интервале)
     */
    public static Step advance(long progress, int stored, long add, long interval, int maxStored) {
        if (interval <= 0 || add <= 0) return new Step(Math.max(0, progress), 0);
        long p = Math.max(0, progress) + add;
        int given = 0;
        while (p >= interval && stored + given < maxStored) {
            p -= interval;
            given++;
        }
        if (stored + given >= maxStored && p > interval) p = interval;
        return new Step(p, given);
    }
}
