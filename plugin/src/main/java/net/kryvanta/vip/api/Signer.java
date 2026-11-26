package net.kryvanta.vip.api;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;

/**
 * Подпись запросов к сайту (совместима с web/src/server/plugin.ts):
 * HMAC_SHA256(secret, ts + "\n" + nonce + "\n" + METHOD + "\n" + path + "\n" + sha256hex(body)).
 * Ответ: HMAC_SHA256(secret, ts + "\n" + nonce + "\n" + sha256hex(body)).
 */
public final class Signer {
    private static final SecureRandom RANDOM = new SecureRandom();
    private Signer() {}

    public static String sha256Hex(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public static String hmacHex(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public static String signRequest(String secret, String ts, String nonce, String method, String path, String body) {
        return hmacHex(secret, ts + "\n" + nonce + "\n" + method.toUpperCase() + "\n" + path + "\n" + sha256Hex(body));
    }

    public static String signResponse(String secret, String ts, String nonce, String body) {
        return hmacHex(secret, ts + "\n" + nonce + "\n" + sha256Hex(body));
    }

    /** Сравнение за постоянное время. */
    public static boolean safeEquals(String a, String b) {
        if (a == null || b == null) return false;
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    public static String nonce() {
        byte[] b = new byte[16];
        RANDOM.nextBytes(b);
        return HexFormat.of().formatHex(b);
    }
}
