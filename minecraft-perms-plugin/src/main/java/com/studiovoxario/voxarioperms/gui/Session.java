package com.studiovoxario.voxarioperms.gui;

import com.studiovoxario.voxarioperms.PermScanner;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.List;
import java.util.Set;

/** Stav GUI pro jednoho hrace. */
public final class Session {

    public enum Stage { MAIN, BACKENDS, PLUGINS, GROUPPICK, PERMS, GROUPS, ROLES }

    public Stage stage = Stage.MAIN;
    public String backendId;
    public PermScanner.ScannedPlugin plugin;
    public List<PermScanner.ScannedPlugin> plugins;
    public List<String> nodes;
    public final Set<String> selected = new LinkedHashSet<>();
    public int page = 0;
    /** Skupina, pro kterou se zobrazuje stav permissions. */
    public String targetGroup;
    /** node -> true/false/null (uz udeleno / zakazano / nema). */
    public Map<String, Boolean> current = new HashMap<>();
    public boolean hideOwned = false;

    public void resetSelection() {
        selected.clear();
        page = 0;
    }
}
