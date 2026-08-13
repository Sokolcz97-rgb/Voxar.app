package com.studiovoxario.voxarioupdater;

import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.util.List;
import java.util.concurrent.TimeUnit;

public final class VoxarioUpdater extends JavaPlugin {

    private AuthStore auth;
    private UpdateManager manager;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        this.auth = new AuthStore(getDataFolder());
        this.manager = new UpdateManager(this);
        Guide.write(getDataFolder());

        UpdateCommand cmd = new UpdateCommand(this);
        var c = getCommand("voxupdate");
        if (c != null) {
            c.setExecutor(cmd);
            c.setTabCompleter(cmd);
        }

        reportPending();

        if (getConfig().getBoolean("check-on-start", true)) {
            Bukkit.getAsyncScheduler().runDelayed(this, t -> runCheck(true), 10, TimeUnit.SECONDS);
        }
        int mins = getConfig().getInt("check-interval-minutes", 180);
        if (mins > 0) {
            Bukkit.getAsyncScheduler().runAtFixedRate(this, t -> runCheck(true),
                    mins, mins, TimeUnit.MINUTES);
        }
        getLogger().info("VoxarioUpdater zapnut. /voxupdate help");
    }

    public AuthStore auth() { return auth; }

    public UpdateManager manager() { return manager; }

    /** Kontrola vsech pluginu; volej pouze z async vlakna. */
    public void runCheck(boolean autoDownload) {
        List<UpdateInfo> res = manager.checkAll();
        int found = 0;
        for (UpdateInfo u : res) if (u.available) found++;
        if (found == 0) {
            getLogger().info("Vsechny pluginy jsou aktualni.");
            return;
        }
        getLogger().info("Nalezeno " + found + " aktualizaci. /voxupdate list");
        boolean auto = autoDownload && getConfig().getBoolean("auto-download", false);
        for (UpdateInfo u : res) {
            if (!u.available) continue;
            if (auto && (!u.paid || u.ownershipVerified)) {
                UpdateManager.Result r = manager.download(u);
                getLogger().info((r.ok() ? "[OK] " : "[--] ") + r.message());
            } else {
                getLogger().info(" - " + u.entry.name + " " + u.entry.version + " -> " + u.latestVersion
                        + (u.paid ? (u.ownershipVerified ? " (placeny, vlastnite)" : " (placeny, NEOVERENO)") : ""));
            }
        }
        if (getConfig().getBoolean("notify-ops", true)) {
            final int n = found;
            Bukkit.getGlobalRegionScheduler().run(this, t -> {
                for (var p : Bukkit.getOnlinePlayers()) {
                    if (p.hasPermission("voxarioupdater.admin")) {
                        p.sendMessage(Msg.color("&6[VoxarioUpdater] &eK dispozici je " + n
                                + " aktualizaci. &7/voxupdate list"));
                    }
                }
            });
        }
    }

    private void reportPending() {
        File stage = new File(getDataFolder().getParentFile(), getConfig().getString("staging-folder", "update"));
        File[] f = stage.listFiles(x -> x.getName().toLowerCase().endsWith(".jar"));
        if (f != null && f.length > 0) {
            getLogger().info(f.length + " aktualizaci ceka v plugins/" + stage.getName()
                    + "/ - nasadi se pri dalsim startu serveru.");
        }
    }
}
