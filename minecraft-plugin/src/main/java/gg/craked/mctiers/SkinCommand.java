package gg.craked.mctiers;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;
import org.bukkit.profile.PlayerTextures;
import org.bukkit.profile.PlayerTextures.SkinModel;

/**
 * /skin <name> — pulls the skin from Mojang's session server for a premium account
 * and applies it to the player so the skin is visible to everyone online.
 */
public final class SkinCommand implements CommandExecutor, TabCompleter {

    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(6))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private final TierTestPlugin plugin;

    public SkinCommand(TierTestPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage("Only players can use that command.");
            return true;
        }
        if (args.length < 1) {
            player.sendMessage("Usage: /skin <player or skin name>");
            return true;
        }
        String name = args[0];
        if (!name.matches("[A-Za-z0-9_]{3,16}")) {
            player.sendMessage("That is not a valid name.");
            return true;
        }
        player.sendMessage(plugin.c("skin.looking-up").replace("%name%", name));

        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            String messageKey = applySkin(player, name);
            Bukkit.getScheduler().runTask(plugin, () -> player.sendMessage(plugin.c(messageKey).replace("%name%", name)));
        });
        return true;
    }

    private String applySkin(Player player, String name) {
        try {
            /* Resolve UUID from username */
            HttpRequest uuidReq = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.mojang.com/users/profiles/minecraft/" + name))
                    .timeout(Duration.ofSeconds(8))
                    .header("User-Agent", "MCTiers/" + plugin.getDescription().getVersion())
                    .GET()
                    .build();
            HttpResponse<String> uuidRes = HTTP.send(uuidReq, HttpResponse.BodyHandlers.ofString());
            if (uuidRes.statusCode() == 404) {
                return "skin.not-found";
            }
            if (uuidRes.statusCode() / 100 != 2) {
                return "skin.lookup-failed";
            }
            String uuid = JsonParser.parseString(uuidRes.body()).getAsJsonObject().get("id").getAsString();

            /* Fetch the full profile with textures */
            HttpRequest profileReq = HttpRequest.newBuilder()
                    .uri(URI.create("https://sessionserver.mojang.com/session/minecraft/profile/" + uuid + "?unsigned=false"))
                    .timeout(Duration.ofSeconds(8))
                    .header("User-Agent", "MCTiers/" + plugin.getDescription().getVersion())
                    .GET()
                    .build();
            HttpResponse<String> profileRes = HTTP.send(profileReq, HttpResponse.BodyHandlers.ofString());
            if (profileRes.statusCode() / 100 != 2) {
                return "skin.lookup-failed";
            }
            JsonObject obj = JsonParser.parseString(profileRes.body()).getAsJsonObject();
            JsonArray props = obj.getAsJsonArray("properties");
            if (props == null) {
                return "skin.lookup-failed";
            }
            for (JsonElement prop : props) {
                JsonObject p = prop.getAsJsonObject();
                if ("textures".equals(p.get("name").getAsString())) {
                    String value = p.get("value").getAsString();
                    String signature = p.get("signature").getAsString();
                    Bukkit.getScheduler().runTask(plugin, () -> applyProperty(player, value, signature));
                    return "skin.applied";
                }
            }
            return "skin.lookup-failed";
        } catch (Exception e) {
            plugin.getLogger().warning("Skin lookup failed for " + name + ": " + e.getMessage());
            return "skin.lookup-failed";
        }
    }

    private void applyProperty(Player player, String value, String signature) {
        PlayerTextures old = player.getPlayerProfile().getTextures();
        java.net.URL skin = null;
        try {
            /* textures property is base64 JSON {"textures":{"SKIN":{"url":"..."}}} */
            java.nio.charset.Charset utf8 = java.nio.charset.StandardCharsets.UTF_8;
            String json = new String(java.util.Base64.getDecoder().decode(value), utf8);
            String url = JsonParser.parseString(json).getAsJsonObject()
                    .get("textures").getAsJsonObject()
                    .get("SKIN").getAsJsonObject()
                    .get("url").getAsString();
            skin = new java.net.URI(url).toURL();
        } catch (Exception e) {
            player.sendMessage("Could not decode that skin.");
            return;
        }

        com.destroystokyo.paper.profile.PlayerProfile profile =
                (com.destroystokyo.paper.profile.PlayerProfile) player.getPlayerProfile();
        profile.setProperty(new com.destroystokyo.paper.profile.ProfileProperty("textures", value, signature));
        player.setPlayerProfile(profile);
    }

    @Override
    public java.util.List<String> onTabComplete(CommandSender sender, Command command, String label, String[] args) {
        return java.util.Collections.emptyList();
    }
}
