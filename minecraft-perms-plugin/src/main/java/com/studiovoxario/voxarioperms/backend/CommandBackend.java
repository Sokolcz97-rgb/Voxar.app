package com.studiovoxario.voxarioperms.backend;

import org.bukkit.Bukkit;

import java.util.ArrayList;
import java.util.List;

/** Zaklad pro backendy ovladane konzolovymi prikazy. */
public abstract class CommandBackend implements PermBackend {

    private final String id;
    private final String display;
    private final String pluginName;

    protected CommandBackend(String id, String display, String pluginName) {
        this.id = id;
        this.display = display;
        this.pluginName = pluginName;
    }

    @Override public String id() { return id; }
    @Override public String display() { return display; }

    @Override public boolean available() {
        var p = Bukkit.getPluginManager().getPlugin(pluginName);
        return p != null && p.isEnabled();
    }

    protected static List<String> of(String... cmds) {
        List<String> l = new ArrayList<>();
        for (String c : cmds) if (c != null && !c.isBlank()) l.add(c);
        return l;
    }

    @Override public List<String> createGroupCommands(String group) { return of(); }
}
