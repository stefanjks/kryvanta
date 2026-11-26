package net.kryvanta.vip.api;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;

/**
 * Асинхронный клиент REST API сайта. Все вызовы выполняются вне основного потока сервера.
 * Секретный ключ не передаётся по сети — только HMAC-подпись.
 */
public final class ApiClient {
    public record Result(int status, JsonObject body) {
        public boolean ok() { return status >= 200 && status < 300; }
    }

    private final Gson gson = new Gson();
    private final HttpClient http;
    private final String baseUrl;
    private final String secret;
    private final Duration timeout;

    public ApiClient(String baseUrl, String secret, int timeoutSeconds) {
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.secret = secret;
        this.timeout = Duration.ofSeconds(Math.max(3, timeoutSeconds));
        this.http = HttpClient.newBuilder().connectTimeout(this.timeout).followRedirects(HttpClient.Redirect.NEVER).build();
    }

    public boolean configured() {
        return !baseUrl.isBlank() && !secret.isBlank() && !secret.startsWith("CHANGE_ME");
    }

    public CompletableFuture<Result> post(String path, Object payload) {
        String body = payload instanceof String s ? s : gson.toJson(payload);
        String ts = String.valueOf(System.currentTimeMillis() / 1000);
        String nonce = Signer.nonce();
        String sig = Signer.signRequest(secret, ts, nonce, "POST", path, body);
        HttpRequest req = HttpRequest.newBuilder(URI.create(baseUrl + path))
                .timeout(timeout)
                .header("Content-Type", "application/json")
                .header("User-Agent", "KryvantaPlugin/2")
                .header("X-Kry-Timestamp", ts)
                .header("X-Kry-Nonce", nonce)
                .header("X-Kry-Signature", sig)
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        return http.sendAsync(req, HttpResponse.BodyHandlers.ofString()).thenApply(res -> {
            String text = res.body() == null ? "" : res.body();
            String rts = res.headers().firstValue("X-Kry-Timestamp").orElse("");
            String rsig = res.headers().firstValue("X-Kry-Signature").orElse("");
            boolean signed = !rsig.isEmpty() && Signer.safeEquals(Signer.signResponse(secret, rts, nonce, text), rsig);
            if (res.statusCode() < 300 && !signed) {
                throw new IllegalStateException("Ответ сайта не подписан или подпись неверна (" + path + ")");
            }
            JsonObject obj;
            try {
                JsonElement el = JsonParser.parseString(text);
                obj = el.isJsonObject() ? el.getAsJsonObject() : new JsonObject();
            } catch (Exception e) {
                obj = new JsonObject();
            }
            return new Result(res.statusCode(), obj);
        });
    }
}
