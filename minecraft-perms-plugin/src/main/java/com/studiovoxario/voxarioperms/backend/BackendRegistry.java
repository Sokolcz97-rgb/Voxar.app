package com.studiovoxario.voxarioperms.backend;

import java.util.ArrayList;
import java.util.List;

/** Drzi vsechny backendy a rika, ktere jsou na serveru dostupne. */
public final class BackendRegistry {

    private final List<PermBackend> all = SimpleBackends.all();

    public List<PermBackend> all() { return all; }

    public List<PermBackend> available() {
        List<PermBackend> out = new ArrayList<>();
        for (PermBackend b : all) if (b.available()) out.add(b);
        return out;
    }

    public PermBackend byId(String id) {
        for (PermBackend b : all) if (b.id().equalsIgnoreCase(id)) return b;
        return null;
    }

    /** Nejvhodnejsi backend (LuckPerms ma prednost, Vault jako posledni). */
    public PermBackend best() {
        for (PermBackend b : all) if (b.available() && !b.id().equals("vault")) return b;
        for (PermBackend b : all) if (b.available()) return b;
        return null;
    }
}
