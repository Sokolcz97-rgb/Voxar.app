package com.studiovoxario.voxarioperms.backend;

import java.util.List;

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
}
