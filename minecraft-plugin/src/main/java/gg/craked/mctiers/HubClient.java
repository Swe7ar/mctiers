package gg.craked.mctiers;

import com.google.gson.JsonObject;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Tiny HTTP client for the MCTiers tier hub.
 *
 * <p>The hub is the local API that {@code tools/serve.mjs} exposes. Plugin facing endpoints
 * require the shared token so nothing else on the network can push codes into the queue.</p>
 */
public final class HubClient {

    private final TierTestPlugin plugin;
    private final HttpClient http;
    private final String base;
    private final String token;

    public HubClient(TierTestPlugin plugin) {
        this.plugin = plugin;
        this.base = plugin.getConfig().getString("hub.url", "http://localhost:4173").replaceAll("/+$", "");
        this.token = plugin.getConfig().getString("hub.token", "mctiers-local");
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public String base() {
        return base;
    }

    /** Register a freshly issued code with the hub. */
    public boolean registerCode(String code, String player, String uuid) {
        JsonObject body = new JsonObject();
        body.addProperty("code", code);
        body.addProperty("player", player);
        body.addProperty("uuid", uuid);
        return post("/api/tiertest/code", body, true) != null;
    }

    /** All codes that are still open (pending or claimed). */
    public JsonObject getPending() {
        return get("/api/tiertest/pending", true);
    }

    /** The tiers the hub knows for a player. */
    public JsonObject getResult(String player) {
        return get("/api/tiertest/result?player=" + encode(player), false);
    }

    private JsonObject get(String path, boolean auth) {
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(base + path))
                    .timeout(Duration.ofSeconds(8))
                    .header("Accept", "application/json")
                    .GET();
            if (auth) {
                builder.header("x-tier-token", token);
            }
            HttpResponse<String> res = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() / 100 != 2) {
                return null;
            }
            return com.google.gson.JsonParser.parseString(res.body()).getAsJsonObject();
        } catch (Exception e) {
            plugin.getLogger().warning("Hub GET " + path + " failed: " + e.getMessage());
            return null;
        }
    }

    private JsonObject post(String path, JsonObject body, boolean auth) {
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(base + path))
                    .timeout(Duration.ofSeconds(8))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8));
            if (auth) {
                builder.header("x-tier-token", token);
            }
            HttpResponse<String> res = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() / 100 != 2) {
                return null;
            }
            return com.google.gson.JsonParser.parseString(res.body()).getAsJsonObject();
        } catch (Exception e) {
            plugin.getLogger().warning("Hub POST " + path + " failed: " + e.getMessage());
            return null;
        }
    }

    private static String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }
}
