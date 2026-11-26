package net.kryvanta.vip;

import net.kryvanta.vip.logic.*;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

class LogicTest {
    static final long H3 = 3 * 3600;

    @Test
    void rewardEveryThreeHoursOfActivePlay() {
        var s = RewardClock.advance(0, 0, H3 - 1, H3, 3);
        assertEquals(0, s.newRewards());
        assertEquals(H3 - 1, s.progressSeconds());
        s = RewardClock.advance(s.progressSeconds(), 0, 1, H3, 3);
        assertEquals(1, s.newRewards());
        assertEquals(0, s.progressSeconds());
    }

    @Test
    void progressSurvivesRestartAndCapsAtMaxStored() {
        // прогресс сохранён в файле (например, 2 ч), после перезапуска продолжаем
        var s = RewardClock.advance(2 * 3600, 0, 3600, H3, 3);
        assertEquals(1, s.newRewards());
        // накоплено максимум — новые награды не начисляются, прогресс замирает на интервале
        s = RewardClock.advance(0, 3, 10 * H3, H3, 3);
        assertEquals(0, s.newRewards());
        assertEquals(H3, s.progressSeconds());
    }

    @Test
    void enchantingTableWith15ShelvesReachesLevel30() {
        int max = 0;
        for (long seed = 0; seed < 5000; seed++) {
            int[] c = EnchantCosts.costs(seed, 15);
            assertTrue(c[0] >= 1 && c[0] <= c[1] && c[1] <= c[2]);
            assertTrue(c[2] >= 30, "третий слот при 15 полках всегда >= 30");
            max = Math.max(max, c[2]);
        }
        assertEquals(30, max);
        // без полок максимум 8 — именно поэтому виртуальному столу нужна эмуляция 15 полок
        for (long seed = 0; seed < 2000; seed++) assertTrue(EnchantCosts.costs(seed, 0)[2] <= 8);
    }

    @Test
    void enchantCostsAreDeterministicPerSeed() {
        assertArrayEquals(EnchantCosts.costs(12345, 15), EnchantCosts.costs(12345, 15));
    }

    @Test
    void weightedPickRespectsWeights() {
        record K(String n, int w) {}
        var items = List.of(new K("common", 70), new K("rare", 25), new K("epic", 5), new K("manual", 0));
        Random r = new Random(1);
        int epic = 0, manual = 0;
        for (int i = 0; i < 100_000; i++) {
            K k = WeightedPicker.pick(items, K::w, r);
            if (k.n().equals("epic")) epic++;
            if (k.n().equals("manual")) manual++;
        }
        assertEquals(0, manual);
        assertTrue(epic > 4000 && epic < 6000, "эпический ~5%: " + epic);
        assertNull(WeightedPicker.pick(List.of(new K("x", 0)), K::w, r));
    }

    @Test
    void afkPolicy() {
        assertTrue(ActivityPolicy.isActive(100_000, 90_000, 180));
        assertFalse(ActivityPolicy.isActive(400_000, 100_000, 180));
        assertFalse(ActivityPolicy.isActive(1000, 0, 180));
        assertFalse(ActivityPolicy.intentionalMove(false, 4.0, false), "поток воды без клавиш");
        assertFalse(ActivityPolicy.intentionalMove(true, 4.0, true), "в транспорте");
        assertFalse(ActivityPolicy.intentionalMove(true, 0.0, false), "упёрся в стену");
        assertTrue(ActivityPolicy.intentionalMove(true, 0.04, false));
        assertTrue(ActivityPolicy.significantRotation(359f, 0f) == false);
        assertTrue(ActivityPolicy.significantRotation(10f, 0f));
    }
}
