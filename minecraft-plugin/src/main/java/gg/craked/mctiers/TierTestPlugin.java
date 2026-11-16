package gg.craked.mctiers;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.io.File;
import java.nio.file.Files;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.event.HoverEvent;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.entity.Player;
import org.bukkit.permissions.PermissionAttachment;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scoreboard.Scoreboard;
import org.bukkit.scoreboard.Team;
import org.bukkit.scheduler.BukkitTask;

/**
 * MCTiers tier test bridge.
 *
 * <p>Flow:</p>
 * <ol>
 *   <li>A player runs {@code /tiertest} and receives a short code.</li>
 *   <li>The code is registered with the website hub and shown in game.</li>
 *   <li>The player pastes it in the website chat (a chat named "get tier"), which puts them in a
 *       thread with a tester.</li>
 *   <li>The tester runs the fight and awards the tier from the website.</li>
 *   <li>The plugin picks the new tier up and announces it in game.</li>
 * </ol>
 */
public final class TierTestPlugin extends JavaPlugin {

    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private HubClient hub;
    private BukkitTask poller;

    /** code -> player uuid */
    private final Map<String, UUID> codes = new HashMap<>();
    /** player uuid -> code */
    private final Map<UUID, String> playerCode = new HashMap<>();
    /** codes we already told the player about */
    private final Set<String> announced = new HashSet<>();
    /** player uuid -> last tier string we saw on the hub */
    private final Map<UUID, String> lastTiers = new HashMap<>();
    /** player uuid -> the tier we already applied in game */
    private final Map<UUID, String> appliedTier = new HashMap<>();
    /** permission attachments we handed out, so we can remove them again */
    private final Map<UUID, PermissionAttachment> tierAttachment = new HashMap<>();
    /** how many ticks until the next full tier check */
    private int tierCheckTicks = 0;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        this.hub = new HubClient(this);

        TierCommand command = new TierCommand(this);
        var cmd = getCommand("tiertest");
        if (cmd != null) {
            cmd.setExecutor(command);
            cmd.setTabCompleter(command);
        }
        var tiersCmd = getCommand("tiers");
        if (tiersCmd != null) {
            tiersCmd.setExecutor(command);
            tiersCmd.setTabCompleter(command);
        }

        long interval = Math.max(20L, getConfig().getLong("hub.poll-interval-ticks", 40L));
        this.poller = Bukkit.getScheduler().runTaskTimer(this, this::poll, interval, interval);

        Bukkit.getPluginManager().registerEvents(new JoinListener(this), this);
        registerMotdListener();
        applyServerProperties();

        var skinCmd = new SkinCommand(this);
        var skin = getCommand("skin");
        if (skin != null) {
            skin.setExecutor(skinCmd);
            skin.setTabCompleter(skinCmd);
        }

        getLogger().info("Tier test bridge ready (hub: " + hub.base() + ")");
    }

    /** The server list name / MOTD from the config, with legacy colour codes. */
    public String configuredMotd() {
        String motd = getConfig().getString("server.motd", "");
        return MotdListener.colorize(motd);
    }

    public String serverName() {
        return getConfig().getString("server.name", "CrackedMCTiers");
    }

    /** Paper only — override the server list title live. */
    private void registerMotdListener() {
        if (!Bukkit.getName().toLowerCase().contains("paper")) {
            return;
        }
        try {
            Bukkit.getPluginManager().registerEvents(new MotdListener(this), this);
        } catch (Throwable error) {
            getLogger().warning("Could not hook the server list MOTD: " + error.getMessage());
        }
    }

    /**
     * Write the MOTD into server.properties so it also survives a restart.
     * The live server list name is already handled by the Paper ping listener.
     */
    private void applyServerProperties() {
        if (!getConfig().getBoolean("server.write-server-properties", true)) {
            return;
        }
        File root = getServerDirectory();
        if (root == null) {
            return;
        }
        File file = new File(root, "server.properties");
        if (!file.exists()) {
            return;
        }
        try {
            List<String> lines = new ArrayList<>(Files.readAllLines(file.toPath()));
            boolean changed = false;
            String motd = configuredMotd();
            for (int i = 0; i < lines.size(); i++) {
                String line = lines.get(i);
                if (line.startsWith("motd=")) {
                    String next = "motd=" + motd;
                    if (!next.equals(line)) {
                        lines.set(i, next);
                        changed = true;
                    }
                } else if (line.startsWith("server-name=")) {
                    String next = "server-name=" + serverName();
                    if (!next.equals(line)) {
                        lines.set(i, next);
                        changed = true;
                    }
                }
            }
            if (changed) {
                Files.write(file.toPath(), lines);
                getLogger().info("Updated the MOTD in server.properties — restart to apply it.");
            }
        } catch (Exception e) {
            getLogger().warning("Could not update server.properties: " + e.getMessage());
        }
    }

    /** The server root folder, if the running server exposes it. */
    private File getServerDirectory() {
        try {
            Object dir = getServer().getClass().getMethod("getServerDirectory").invoke(getServer());
            if (dir instanceof File file && file.isDirectory()) {
                return file;
            }
        } catch (Throwable ignored) {
            /* older API — fall back below */
        }
        File world = getServer().getWorldContainer();
        if (world == null) {
            return null;
        }
        File parent = world.getParentFile();
        return parent != null && parent.isDirectory() ? parent : world;
    }

    @Override
    public void onDisable() {
        if (poller != null) {
            poller.cancel();
        }
    }

    public HubClient hub() {
        return hub;
    }

    public String message(String key) {
        String raw = getConfig().getString("messages." + key, "");
        return ChatColor.translateAlternateColorCodes('&', raw);
    }

    public String prefix() {
        return message("prefix");
    }

    /** Send the player their code as a clickable message.
        Clicking it opens the website chat with the code already pasted in. */
    public void sendCodeMessage(Player player, String code) {
        String base = getConfig().getString("hub.website", "https://crakedmctiers.gg/chat.html");
        String url = base + (base.contains("?") ? "&" : "?") + "code=" + code;

        Component codeHover = Component.text(" " + code + " ")
                .color(NamedTextColor.GOLD)
                .decorate(TextDecoration.BOLD)
                .clickEvent(ClickEvent.openUrl(url))
                .hoverEvent(HoverEvent.showText(
                        Component.text("Click to open the website with the code ready to paste", NamedTextColor.GRAY)));

        Component message = Component.text()
                .append(Component.text("[TierTest] ", NamedTextColor.GRAY))
                .append(Component.text("Your tier test code is ", NamedTextColor.GREEN))
                .append(codeHover)
                .append(Component.text(". Click it, or paste it on the website in chat.", NamedTextColor.GREEN))
                .build();
        player.sendMessage(message);
    }

    /* ------------------------------------------------------------- codes */

    /** The code this player currently holds, or null. */
    public String codeOf(Player player) {
        return playerCode.get(player.getUniqueId());
    }

    /** Issue a fresh code for a player. */
    public String issueCode(Player player) {
        String code = randomCode();
        String previous = playerCode.put(player.getUniqueId(), code);
        if (previous != null) {
            codes.remove(previous);
            announced.remove(previous);
        }
        codes.put(code, player.getUniqueId());
        hub.registerCode(code, player.getName(), player.getUniqueId().toString());
        return code;
    }

    /** Drop the player's code (it can no longer be used). */
    public void clearCode(Player player) {
        String code = playerCode.remove(player.getUniqueId());
        if (code != null) {
            codes.remove(code);
            announced.remove(code);
        }
    }

    private String randomCode() {
        StringBuilder sb = new StringBuilder(6);
        for (int i = 0; i < 6; i++) {
            sb.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
        }
        return sb.toString();
    }

    /* ------------------------------------------------------- tier in game */

    /** Tiers from the best to the worst — the order the site uses for points. */
    private static final List<String> TIER_ORDER =
            List.of("HT1", "LT1", "HT2", "LT2", "HT3", "LT3", "HT4", "LT4", "HT5", "LT5");

    /** Colour of every tier, used for the in game tag. */
    private static final Map<String, String> TIER_COLOUR = Map.of(
            "HT1", "&6", "LT1", "&e",
            "HT2", "&7", "LT2", "&8",
            "HT3", "&6", "LT3", "&e",
            "HT4", "&5", "LT4", "&d",
            "HT5", "&3", "LT5", "&b");

    /** The best (highest) tier of a tier map, or null. */
    public String bestTier(JsonObject tiers) {
        if (tiers == null) {
            return null;
        }
        for (String tier : TIER_ORDER) {
            if (tiers.has(tier)) {
                return tier;
            }
        }
        return null;
    }

    /**
     * Apply the player's highest tier in game: a coloured tag in front of their name and a
     * {@code mctiers.tier.<TIER>} permission other plugins can check.
     */
    public void applyTier(Player player, String tier) {
        String current = appliedTier.get(player.getUniqueId());
        if (tier == null ? current == null : tier.equals(current)) {
            return;
        }
        appliedTier.put(player.getUniqueId(), tier);

        /* drop the old permission */
        PermissionAttachment old = tierAttachment.remove(player.getUniqueId());
        if (old != null) {
            try {
                player.removeAttachment(old);
            } catch (Throwable ignored) {
                /* the player left */
            }
        }

        if (!getConfig().getBoolean("tier-tag.enabled", true)) {
            return;
        }

        /* remove the player from the other tier teams first */
        Scoreboard board = Bukkit.getScoreboardManager().getMainScoreboard();
        for (String other : TIER_ORDER) {
            Team team = board.getTeam(teamName(other));
            if (team != null) {
                team.removeEntry(player.getName());
            }
        }
        if (tier == null) {
            player.sendMessage(prefix() + ChatColor.GRAY + "Your tier tag was removed.");
            return;
        }

        String team = teamName(tier);
        Team scoreboardTeam = board.getTeam(team);
        if (scoreboardTeam == null) {
            scoreboardTeam = board.registerNewTeam(team);
        }
        String format = getConfig().getString("tier-tag.format", "[%tier%] ")
                .replace("%tier%", tier);
        String tag = TIER_COLOUR.getOrDefault(tier, "&f") + format;
        scoreboardTeam.prefix(LegacyComponentSerializer.legacyAmpersand().deserialize(tag));
        scoreboardTeam.addEntry(player.getName());

        PermissionAttachment attachment = player.addAttachment(this, "mctiers.tier." + tier, true);
        tierAttachment.put(player.getUniqueId(), attachment);

        player.sendMessage(prefix() + ChatColor.translateAlternateColorCodes('&',
                TIER_COLOUR.getOrDefault(tier, "&f")) + "Tier applied: " + ChatColor.WHITE + tier
                + ChatColor.GRAY + " (mctiers.tier." + tier + ")");
    }

    private String teamName(String tier) {
        return "mctiers_" + tier.toLowerCase();
    }

    /** Ask the hub for a player's tiers and apply the best one in game. */
    public void syncTier(Player player) {
        if (player == null || !player.isOnline()) {
            return;
        }
        Bukkit.getScheduler().runTaskAsynchronously(this, () -> {
            JsonObject result = hub.getResult(player.getName());
            String tier = null;
            if (result != null && result.has("tiers") && result.get("tiers").isJsonObject()) {
                tier = bestTier(result.getAsJsonObject("tiers"));
            }
            final String found = tier;
            Bukkit.getScheduler().runTask(this, () -> {
                Player online = Bukkit.getPlayer(player.getUniqueId());
                if (online != null) {
                    applyTier(online, found);
                }
            });
        });
    }

    /* -------------------------------------------------------------- poll */

    /**
     * Ask the hub for open requests and for tier results.
     * The HTTP calls run off the main thread, the messages are sent back on it.
     */
    private void poll() {
        /* Every few rounds the tier tag of every online player is refreshed, so a
           change made on the website shows up in game within a few seconds. */
        tierCheckTicks++;
        if (tierCheckTicks % 5 == 0) {
            for (Player online : Bukkit.getOnlinePlayers()) {
                syncTier(online);
            }
        }

        Bukkit.getScheduler().runTaskAsynchronously(this, () -> {
            JsonObject pending = hub.getPending();
            List<String> claimed = new ArrayList<>();
            if (pending != null) {
                JsonArray list = pending.getAsJsonArray("codes");
                if (list != null) {
                    for (JsonElement element : list) {
                        JsonObject entry = element.getAsJsonObject();
                        String code = entry.get("code").getAsString();
                        String status = entry.has("status") ? entry.get("status").getAsString() : "pending";
                        if (!"claimed".equals(status)) {
                            continue;
                        }
                        String tester = entry.has("tester") && !entry.get("tester").isJsonNull()
                                ? entry.get("tester").getAsString() : "a tester";
                        claimed.add(code + "|" + tester);
                    }
                }
            }

            Map<UUID, String> results = new HashMap<>();
            for (UUID uuid : new ArrayList<>(playerCode.keySet())) {
                Player online = Bukkit.getPlayer(uuid);
                if (online == null) {
                    continue;
                }
                JsonObject result = hub.getResult(online.getName());
                if (result == null || !result.has("tiers")) {
                    continue;
                }
                results.put(uuid, result.get("tiers").toString());
            }

            if (claimed.isEmpty() && results.isEmpty()) {
                return;
            }
            Bukkit.getScheduler().runTask(this, () -> {
                for (String entry : claimed) {
                    String[] parts = entry.split("\\|", 2);
                    String code = parts[0];
                    String tester = parts.length > 1 ? parts[1] : "a tester";
                    UUID owner = codes.get(code);
                    if (owner == null || announced.contains(code)) {
                        continue;
                    }
                    announced.add(code);
                    Player player = Bukkit.getPlayer(owner);
                    if (player != null) {
                        player.sendMessage(prefix() + message("tester-ready").replace("%tester%", tester));
                    }
                    Player testerPlayer = Bukkit.getPlayerExact(tester);
                    if (testerPlayer != null) {
                        testerPlayer.sendMessage(prefix()
                                + message("tester-notify")
                                        .replace("%player%", player == null ? "someone" : player.getName())
                                        .replace("%code%", code));
                    }
                }
                for (Map.Entry<UUID, String> entry : results.entrySet()) {
                    String before = lastTiers.get(entry.getKey());
                    if (entry.getValue().equals(before)) {
                        continue;
                    }
                    lastTiers.put(entry.getKey(), entry.getValue());
                    Player player = Bukkit.getPlayer(entry.getKey());
                    if (player != null) {
                        player.sendMessage(prefix() + tierSummary(player.getName(), entry.getValue()));
                    }
                }
            });
        });
    }

    /** Turn the hub tier JSON into a readable in game summary. */
    private String tierSummary(String player, String json) {
        String raw = json.replaceAll("[{}\"]", "");
        if (raw.isBlank()) {
            return message("tier-none");
        }
        StringBuilder sb = new StringBuilder();
        for (String part : raw.split(",")) {
            String[] kv = part.split(":");
            if (kv.length != 2) {
                continue;
            }
            if (!sb.isEmpty()) {
                sb.append(" &7· ");
            }
            sb.append("&f").append(kv[0].toUpperCase()).append(" &a").append(kv[1]);
        }
        return ChatColor.translateAlternateColorCodes('&',
                "&aYour tiers are now " + sb + "&a. It is live on the leaderboard.");
    }
}
