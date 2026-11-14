package gg.craked.mctiers;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;

/** Reminds a player about a tier test code they already asked for. */
public final class JoinListener implements Listener {

    private final TierTestPlugin plugin;

    public JoinListener(TierTestPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        /* apply the tier tag from the website as soon as they connect */
        plugin.getServer().getScheduler().runTaskLater(plugin, () -> plugin.syncTier(player), 40L);

        String code = plugin.codeOf(player);
        if (code == null) {
            return;
        }
        plugin.getServer().getScheduler().runTaskLater(plugin, () -> {
            if (!player.isOnline()) {
                return;
            }
            player.sendMessage(plugin.prefix() + plugin.message("code-hint"));
            plugin.sendCodeMessage(player, code);
        }, 60L);
    }
}
