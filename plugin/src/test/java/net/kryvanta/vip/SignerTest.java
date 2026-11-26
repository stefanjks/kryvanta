package net.kryvanta.vip;

import net.kryvanta.vip.api.Signer;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Векторы получены из реализации сайта (Node.js, web/src/server/plugin.ts). */
class SignerTest {
    @Test
    void requestSignatureMatchesWebsite() {
        assertEquals("aa3e38b066720dcdbbd0019fc58a42be483c2adb5f8caa0a968666420c9ae187",
                Signer.signRequest("secret", "1700000000", "nonce123456789abcdef", "post", "/api/plugin/sync", "{\"a\":1}"));
    }

    @Test
    void responseSignatureMatchesWebsite() {
        assertEquals("9e3881efcfa94183584826e99bbdf2981d9fc2dae647af3247cea23152276f0c",
                Signer.signResponse("secret", "1700000000", "nonce123456789abcdef", "{\"a\":1}"));
    }

    @Test
    void nonceIsUniqueAndValid() {
        String a = Signer.nonce(), b = Signer.nonce();
        assertNotEquals(a, b);
        assertTrue(a.matches("[0-9a-f]{32}"));
        assertTrue(Signer.safeEquals(a, a));
        assertFalse(Signer.safeEquals(a, b));
    }
}
