package gg.craked.mctiers;

import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;

/** /register, /login, /logout for offline mode. */
public final class AuthCommand implements CommandExecutor, TabCompleter {

    private final TierTestPlugin plugin;

    public AuthCommand(TierTestPlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage("Only players can use that command.");
            return true;
        }
        String cmd = command.getName().toLowerCase(java.util.Locale.ROOT);

        if (cmd.equals("logout")) {
            plugin.auth().markLoggedOut(player.getUniqueId());
            player.sendMessage(plugin.c("auth.logged-out"));
            plugin.sendToVoid(player);
            return true;
        }

        if (args.length < 1) {
            player.sendMessage("Usage: /" + cmd + " <password>");
            return true;
        }
        String password = args[0];
        if (password.length() < plugin.getConfig().getInt("auth.password-min-length", 4)) {
            player.sendMessage(plugin.c("auth.password-too-short"));
            return true;
        }

        if (cmd.equals("register")) {
            if (plugin.auth().hasAccount(player.getName())) {
                player.sendMessage(plugin.c("auth.already-registered"));
                return true;
            }
            if (!plugin.auth().register(player.getName(), password)) {
                player.sendMessage("Something went wrong — try again.");
                return true;
            }
            plugin.auth().markLoggedIn(player.getUniqueId());
            player.sendMessage(plugin.c("auth.registered"));
            plugin.sendToSpawn(player);
            return true;
        }

        if (cmd.equals("login")) {
            if (!plugin.auth().hasAccount(player.getName())) {
                player.sendMessage(plugin.c("auth.not-registered"));
                return true;
            }
            if (!plugin.auth().check(player.getName(), password)) {
                player.sendMessage(plugin.c("auth.wrong-password"));
                return true;
            }
            plugin.auth().markLoggedIn(player.getUniqueId());
            player.sendMessage(plugin.c("auth.logged-in"));
            plugin.sendToSpawn(player);
            return true;
        }

        return true;
    }

    @Override
    public java.util.List<String> onTabComplete(CommandSender sender, Command command, String label, String[] args) {
        return java.util.Collections.emptyList();
    }
}
