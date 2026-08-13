package com.studiovoxario.voxarioperms;

import com.studiovoxario.voxarioperms.backend.PermBackend;
import com.studiovoxario.voxarioperms.backend.VaultBackend;
import org.bukkit.Bukkit;
import org.bukkit.command.CommandSender;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collection;
import java.util.List;

/** Provadi zmeny permissions a loguje je. */
public final class Applier {

    private final VoxarioPerms plugin;

    public Applier(VoxarioPerms plugin) { this.plugin = plugin; }

    /** Udeli seznam permissions skupine. Vraci pocet uspesnych zapisu. */
    public int grant(PermBackend backend, String group, Collection<String> nodes, boolean value, CommandSender who) {
        int ok = 0;
        boolean dry = plugin.getConfig().getBoolean("dry-run", false);
        for (String node : nodes) {
            if (backend instanceof VaultBackend vb) {
                if (dry || vb.apply(group, node, value)) ok++;
            } else {
                List<String> cmds = backend.grantCommands(group, node, value);
                boolean done = true;
                for (String c : cmds) done &= dry || dispatch(c);
                if (done) ok++;
            }
            log(who, backend.id(), group, node, value ? "set true" : "set false");
        }
        return ok;
    }

    public int unset(PermBackend backend, String group, Collection<String> nodes, CommandSender who) {
        int ok = 0;
        boolean dry = plugin.getConfig().getBoolean("dry-run", false);
        for (String node : nodes) {
            if (backend instanceof VaultBackend vb) {
                if (dry || vb.apply(group, node, false)) ok++;
            } else {
                boolean done = true;
                for (String c : backend.unsetCommands(group, node)) done &= dry || dispatch(c);
                if (done) ok++;
            }
            log(who, backend.id(), group, node, "unset");
        }
        return ok;
    }

    public boolean createGroup(PermBackend backend, String group) {
        boolean ok = true;
        for (String c : backend.createGroupCommands(group)) ok &= dispatch(c);
        return ok;
    }

    public boolean addPlayer(PermBackend backend, String player, String group) {
        if (backend instanceof VaultBackend vb) return vb.addPlayer(player, group);
        boolean ok = true;
        for (String c : backend.addPlayerCommands(player, group)) ok &= dispatch(c);
        return ok;
    }

    /** Bezpecne spusti prikaz z konzole na hlavnim vlakne. */
    public boolean dispatch(String command) {
        try {
            if (Bukkit.isPrimaryThread()) {
                return Bukkit.dispatchCommand(Bukkit.getConsoleSender(), command);
            }
            final boolean[] r = new boolean[1];
            Bukkit.getGlobalRegionScheduler().run(plugin, t ->
                    r[0] = Bukkit.dispatchCommand(Bukkit.getConsoleSender(), command));
            return true;
        } catch (Throwable t) {
            plugin.getLogger().warning("Prikaz selhal: " + command + " (" + t.getMessage() + ")");
            return false;
        }
    }

    private void log(CommandSender who, String backend, String group, String node, String action) {
        if (!plugin.getConfig().getBoolean("audit-log", true)) return;
        try {
            File f = new File(plugin.getDataFolder(), "audit.log");
            f.getParentFile().mkdirs();
            String line = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
                    + " | " + (who == null ? "console" : who.getName())
                    + " | " + backend + " | group=" + group + " | " + node + " | " + action + System.lineSeparator();
            Files.writeString(f.toPath(), line, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException ignored) {}
    }
}
