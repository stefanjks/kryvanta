package net.kryvanta.vip.logic;

/**
 * Правила «реальной активности» игрока. Время засчитывается, только если с последнего
 * осознанного действия прошло меньше afkTimeout секунд.
 *
 * Осознанные действия: поворот камеры, ходьба с нажатием клавиш движения, ломание/установка блоков,
 * взаимодействие, чат, команды, клики в инвентаре, атака. Пассивное движение (поток воды, вагонетка,
 * толкание другими игроками) без нажатия клавиш не считается — так AFK-бассейны не накручивают время.
 * Повторяющийся один и тот же поворот камеры (макрос) тоже не засчитывается.
 */
public final class ActivityPolicy {
    private ActivityPolicy() {}

    /** Минимальный поворот головы (градусы), который считается действием. */
    public static final float MIN_ROTATION = 2.0f;
    /** Сколько одинаковых поворотов подряд считаем макросом. */
    public static final int MACRO_REPEATS = 20;

    public static boolean isActive(long nowMillis, long lastActivityMillis, int afkTimeoutSeconds) {
        return lastActivityMillis > 0 && nowMillis - lastActivityMillis < afkTimeoutSeconds * 1000L;
    }

    public static boolean significantRotation(float dYaw, float dPitch) {
        float y = Math.abs(dYaw) % 360f;
        if (y > 180f) y = 360f - y;
        return y >= MIN_ROTATION || Math.abs(dPitch) >= MIN_ROTATION;
    }

    /** Ходьба засчитывается только при нажатых клавишах движения и реальном смещении. */
    public static boolean intentionalMove(boolean movementKeysPressed, double horizontalDistanceSq, boolean inVehicle) {
        return movementKeysPressed && !inVehicle && horizontalDistanceSq > 0.0025; // > 5 см
    }
}
