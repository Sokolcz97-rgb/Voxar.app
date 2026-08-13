package com.studiovoxario.voxarioperms.gui;

import com.studiovoxario.voxarioperms.PermScanner;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Stav GUI pro jednoho hrace. */
public final class Session {

    public enum Stage { MAIN, BACKENDS, PLUGINS, PERMS, GROUPS, ROLES }

    public Stage stage = Stage.MAIN;
    public String backendId;
    public PermScanner.ScannedPlugin plugin;
    public List<PermScanner.ScannedPlugin> plugins;
    public List<String> nodes;
    public final Set<String> selected = new LinkedHashSet<>();
    public int page = 0;

    public void resetSelection() {
        selected.clear();
        page = 0;
    }
}
