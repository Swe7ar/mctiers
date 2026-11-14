package gg.craked.mctiers;

import org.bukkit.generator.BiomeProvider;
import org.bukkit.generator.ChunkGenerator;
import org.bukkit.generator.WorldInfo;
import java.util.Random;

/** A world with no blocks at all — the player waits stripped down / out of sight. */
public final class VoidChunkGenerator extends ChunkGenerator {

    @Override
    public void generateNoise(WorldInfo worldInfo, Random random, int chunkX, int chunkZ, ChunkData chunkData) {
        /* leave every block empty */
    }

    @Override
    public BiomeProvider getDefaultBiomeProvider(WorldInfo worldInfo) {
        return null;
    }
}
