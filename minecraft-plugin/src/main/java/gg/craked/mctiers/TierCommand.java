package gg.craked.mctiers;

import java.util.ArrayList;
import java.util.List;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;

/** {@code /tiertest} and {@code /tiers}. */
public final class TierCommand implements CommandExecutor, TabCompleter {

    private final TierTestPlugin plugin;

    public TierCommand(TierTestPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (command.getName().equalsIgnoreCase("tiers")) {
            showTiers(sender);
            return true;
        }

        if (args.length > 0 && args[0].equalsIgnoreCase("list")) {
            if (!sender.hasPermission("mctiers.tiertest.admin")) {
                sender.sendMessage(plugin.prefix() + ChatColor.RED + "You are not allowed to do that.");
                return true;
            }
            sender.sendMessage(plugin.prefix() + ChatColor.GRAY
                    + "Open requests are listed on the website: chat.html");
            return true;
        }

        if (!(sender instanceof Player player)) {
            sender.sendMessage(plugin.prefix() + ChatColor.RED + "Only players can run that command.");
            return true;
        }

        if (args.length > 0 && args[0].equalsIgnoreCase("reset")) {
            String code = plugin.codeOf(player);
            plugin.clearCode(player);
            sender.sendMessage(plugin.prefix() + plugin.message("code-reset").replace("%code%", code == null ? "-" : code));
            return true;
        }

        String existing = plugin.codeOf(player);
        if (existing != null) {
            sender.sendMessage(plugin.prefix() + plugin.message("code-duplicate").replace("%code%", existing));
            return true;
        }

        String code = plugin.issueCode(player);
        plugin.sendCodeMessage(player, code);
        sender.sendMessage(plugin.prefix() + plugin.message("code-hint"));
        return true;
    }

    private void showTiers(CommandSender sender) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage(plugin.prefix() + ChatColor.RED + "Only players have tiers.");
            return;
        }
        sender.sendMessage(plugin.prefix() + ChatColor.GRAY + "Checking the leaderboard…");
        plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
            var result = plugin.hub().getResult(player.getName());
            String summary = "none";
            if (result != null && result.has("tiers")) {
                var tiers = result.getAsJsonObject("tiers");
                var clean = new com.google.gson.JsonObject();
                for (String key : tiers.keySet()) {
                    if (key.startsWith("__") || key.endsWith("_since")) {
                        continue;
                    }
                    clean.addProperty(key, tiers.get(key).getAsString());
                }
                summary = clean.toString();
            }
            final String text = summary;
            plugin.getServer().getScheduler().runTask(plugin, () -> {
                if ("none".equals(text) || "{}".equals(text)) {
                    player.sendMessage(plugin.prefix() + plugin.message("tier-none"));
                    return;
                }
                player.sendMessage(plugin.prefix() + ChatColor.GRAY + "Tiers: " + ChatColor.WHITE + text);
            });
        });
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 1 && command.getName().equalsIgnoreCase("tiertest")) {
            List<String> options = new ArrayList<>();
            if (sender.hasPermission("mctiers.tiertest.admin")) {
                options.add("list");
            }
            options.add("reset");
            return options;
        }
        return List.of();
    }
}
