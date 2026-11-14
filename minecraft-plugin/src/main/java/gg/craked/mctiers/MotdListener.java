package gg.craked.mctiers;

import com.destroystokyo.paper.event.server.PaperServerListPingEvent;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import org.bukkit.ChatColor;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;

/**
 * Keeps the server list name in sync with {@code config.yml}.
 *
 * <p>Paper only: the event is registered behind a Paper check in
 * {@link TierTestPlugin}, so the plugin still loads on plain Spigot.</p>
 */
public final class MotdListener implements Listener {

    private final TierTestPlugin plugin;

    public MotdListener(TierTestPlugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.HIGH)
    public void onPing(PaperServerListPingEvent event) {
        String motd = plugin.configuredMotd();
        if (motd == null || motd.isBlank()) {
            return;
        }
        event.motd(LegacyComponentSerializer.legacyAmpersand().deserialize(motd));
    }

    /** The MOTD with legacy colour codes, ready for the server list. */
    public static String colorize(String raw) {
        return ChatColor.translateAlternateColorCodes('&', raw == null ? "" : raw);
    }
}
