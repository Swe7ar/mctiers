package gg.craked.mctiers;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.bukkit.configuration.file.YamlConfiguration;

/**
 * Offline-mode accounts. Passwords are stored as SHA-256 hashes with a per-account salt
 * in plugins/MCTiersTierTest/auth.yml — the plugin never sees a plaintext password
 * after it is hashed on registration.
 */
public final class AuthManager {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final TierTestPlugin plugin;
    private final File authFile;
    private YamlConfiguration auth;

    private final Set<UUID> loggedIn = new HashSet<>();

    public AuthManager(TierTestPlugin plugin) {
        this.plugin = plugin;
        if (!plugin.getDataFolder().exists()) {
            plugin.getDataFolder().mkdirs();
        }
        this.authFile = new File(plugin.getDataFolder(), "auth.yml");
        reload();
    }

    public void reload() {
        if (!authFile.exists()) {
            try {
                authFile.createNewFile();
            } catch (IOException e) {
                plugin.getLogger().warning("Could not create auth.yml: " + e.getMessage());
            }
        }
        this.auth = YamlConfiguration.loadConfiguration(authFile);
    }

    public void save() {
        try {
            auth.save(authFile);
        } catch (IOException e) {
            plugin.getLogger().warning("Could not save auth.yml: " + e.getMessage());
        }
    }

    private static String key(String name) {
        return name.toLowerCase(Locale.ROOT);
    }

    public boolean hasAccount(String name) {
        return auth.contains("accounts." + key(name));
    }

    public boolean register(String name, String password) {
        String k = key(name);
        if (auth.contains("accounts." + k)) {
            return false;
        }
        String salt = newSalt();
        auth.set("accounts." + k + ".salt", salt);
        auth.set("accounts." + k + ".hash", hash(salt, password));
        auth.set("accounts." + k + ".createdAt", System.currentTimeMillis());
        save();
        return true;
    }

    public boolean check(String name, String password) {
        String k = key(name);
        String storedSalt = auth.getString("accounts." + k + ".salt");
        String storedHash = auth.getString("accounts." + k + ".hash");
        if (storedSalt == null || storedHash == null) {
            return false;
        }
        return hash(storedSalt, password).equals(storedHash);
    }

    public void markLoggedIn(UUID id) {
        loggedIn.add(id);
    }

    public void markLoggedOut(UUID id) {
        loggedIn.remove(id);
    }

    public boolean isLoggedIn(UUID id) {
        return loggedIn.contains(id);
    }

    /* ------------------------------------------------------------ security */

    private static String newSalt() {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        return toHex(bytes);
    }

    private static String hash(String salt, String password) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(salt.getBytes(StandardCharsets.UTF_8));
            md.update((byte) 0);
            byte[] digest = md.digest(password.getBytes(StandardCharsets.UTF_8));
            return toHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xF, 16));
            sb.append(Character.forDigit(b & 0xF, 16));
        }
        return sb.toString();
    }
}
