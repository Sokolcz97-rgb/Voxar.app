package com.studiovoxario.voxarioforge;

import org.bukkit.entity.Entity;
import org.bukkit.plugin.Plugin;

import java.util.function.Consumer;

/**
 * Tenky wrapper nad Paper/Folia schedulery.
 * Folia nema Bukkit.getScheduler() regiony - vse jede pres global / entity / region scheduler.
 */
public final class Scheduling {

    private static final boolean FOLIA = detectFolia();

    private Scheduling() {
    }

    private static boolean detectFolia() {
        try {
            Class.forName("io.papermc.paper.threadedregions.RegionizedServer");
            return true;
        } catch (ClassNotFoundException ignored) {
            return false;
        }
    }

    public static boolean isFolia() {
        return FOLIA;
    }

    /** Bezi na globalnim region threadu (bezpecne na Folii i Paperu). */
    public static void global(Plugin plugin, Runnable task) {
        plugin.getServer().getGlobalRegionScheduler().execute(plugin, task);
    }

    public static void globalLater(Plugin plugin, Runnable task, long delayTicks) {
        plugin.getServer().getGlobalRegionScheduler()
                .runDelayed(plugin, t -> task.run(), Math.max(1L, delayTicks));
    }

    public static void globalTimer(Plugin plugin, Runnable task, long delayTicks, long periodTicks) {
        plugin.getServer().getGlobalRegionScheduler()
                .runAtFixedRate(plugin, t -> task.run(), Math.max(1L, delayTicks), Math.max(1L, periodTicks));
    }

    /** Bezi mimo hlavni vlakno (IO, stavba packu). */
    public static void async(Plugin plugin, Runnable task) {
        plugin.getServer().getAsyncScheduler().runNow(plugin, t -> task.run());
    }

    /** Opakovana async uloha (v sekundach). */
    public static void asyncTimer(Plugin plugin, Runnable task, long delaySeconds, long periodSeconds) {
        plugin.getServer().getAsyncScheduler().runAtFixedRate(plugin, t -> task.run(),
                Math.max(1L, delaySeconds), Math.max(1L, periodSeconds), java.util.concurrent.TimeUnit.SECONDS);
    }


    /** Bezi na regionu dane entity (Folia-safe). */
    public static void entity(Plugin plugin, Entity entity, Consumer<Entity> task) {
        entity.getScheduler().run(plugin, t -> task.accept(entity), null);
    }
}
