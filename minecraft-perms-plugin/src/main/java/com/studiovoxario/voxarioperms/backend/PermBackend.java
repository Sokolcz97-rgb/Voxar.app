package com.studiovoxario.voxarioperms.backend;

import java.util.List;
import java.util.Map;

/** Adapter pro konkretni permissions plugin. */
public interface PermBackend {

    /** Interni id, napr. "luckperms". */
    String id();

    /** Zobrazovany nazev. */
    String display();

    /** Je plugin na serveru pritomen a zapnuty? */
    boolean available();

    /** Seznam skupin (rank/group). */
    List<String> groups();

    /** Prikazy, ktere udeli jednu permission dane skupine. */
    List<String> grantCommands(String group, String node, boolean value);

    /** Prikazy, ktere permission ze skupiny odeberou. */
    List<String> unsetCommands(String group, String node);

    /** Prikaz na vytvoreni skupiny (muze byt prazdny seznam). */
    List<String> createGroupCommands(String group);

    /** Prikazy pro pridani hrace do skupiny. */
    List<String> addPlayerCommands(String player, String group);

    /** Permissions, ktere skupina uz ma (node -> true/false). Prazdna mapa = nezname. */
    default Map<String, Boolean> groupPermissions(String group) { return Map.of(); }

    /**
     * Ma skupina danou permission? true = udelena, false = zakazana, null = nezname/nema.
     */
    default Boolean has(String group, String node) {
        Map<String, Boolean> m = groupPermissions(group);
        Boolean v = m.get(node);
        if (v != null) return v;
        if (Boolean.TRUE.equals(m.get("*"))) return true;
        int dot = node.lastIndexOf('.');
        while (dot > 0) {
            Boolean w = m.get(node.substring(0, dot) + ".*");
            if (w != null) return w;
            dot = node.lastIndexOf('.', dot - 1);
        }
        if (!m.isEmpty()) return null;
        return VaultBackend.groupHas(group, node);
    }
}
