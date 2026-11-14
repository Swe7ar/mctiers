package gg.craked.mctiers;

import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.player.AsyncPlayerPreLoginEvent;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.entity.Player;

/**
 * Lock down players who have not /register or /login yet:
 * no movement, no interactions, no commands other than /register and /login.
 */
public final class AuthListener implements Listener {

    private final TierTestPlugin plugin;

    public AuthListener(TierTestPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.HIGHEST)
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        /* Give the client half a second to load in before teleporting to the void. */
        plugin.getServer().getScheduler().runTaskLater(plugin, () -> {
            if (player.isOnline() && !plugin.auth().isLoggedIn(player.getUniqueId())) {
                plugin.sendToVoid(player);
            }
        }, 10L);
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        plugin.auth().markLoggedOut(event.getPlayer().getUniqueId());
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onMove(PlayerMoveEvent event) {
        if (plugin.auth().isLoggedIn(event.getPlayer().getUniqueId())) {
            return;
        }
        /* Stay exactly in place. */
        if (event.getTo() != null && event.hasChangedBlock()) {
            event.setCancelled(true);
            event.setTo(event.getFrom());
        }
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onCommand(PlayerCommandPreprocessEvent event) {
        Player player = event.getPlayer();
        if (plugin.auth().isLoggedIn(player.getUniqueId())) {
            return;
        }
        String msg = event.getMessage().toLowerCase(java.util.Locale.ROOT);
        if (msg.startsWith("/login") || msg.startsWith("/register") || msg.startsWith("/l") || msg.startsWith("/reg")) {
            return;
        }
        event.setCancelled(true);
        player.sendMessage(plugin.c("auth.login-required"));
    }

    @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = true)
    public void onInteract(PlayerInteractEvent event) {
        Player player = event.getPlayer();
        if (plugin.auth().isLoggedIn(player.getUniqueId())) {
            return;
        }
        /* Only allow right-click on buttons? Deny everything else. */
        if (event.getAction() == Action.LEFT_CLICK_BLOCK || event.getAction() == Action.RIGHT_CLICK_BLOCK
                || event.getAction() == Action.LEFT_CLICK_AIR || event.getAction() == Action.RIGHT_CLICK_AIR) {
            event.setCancelled(true);
        }
    }
}
