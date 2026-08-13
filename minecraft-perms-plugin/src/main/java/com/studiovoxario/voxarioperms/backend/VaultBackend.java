package com.studiovoxario.voxarioperms.backend;

import org.bukkit.Bukkit;

import java.util.ArrayList;
import java.util.List;

/** Univerzalni fallback pres Vault (funguje pro vetsinu permission pluginu). */
public final class VaultBackend implements PermBackend {

    @Override public String id() { return "vault"; }
    @Override public String display() { return "Vault (univerzalni)"; }

    @Override public boolean available() {
        var p = Bukkit.getPluginManager().getPlugin("Vault");
        return p != null && p.isEnabled() && provider() != null;
    }

    static Object provider() {
        try {
            Class<?> perm = Class.forName("net.milkbowl.vault.permission.Permission");
            var rsp = Bukkit.getServicesManager().getRegistration((Class) perm);
            return rsp == null ? null : rsp.getProvider();
        } catch (Throwable t) {
            return null;
        }
    }

    static List<String> vaultGroups() {
        List<String> out = new ArrayList<>();
        Object p = provider();
        if (p == null) return out;
        try {
            Object g = p.getClass().getMethod("getGroups").invoke(p);
            if (g instanceof String[] arr) for (String s : arr) if (s != null && !s.isBlank()) out.add(s);
        } catch (Throwable ignored) {}
        out.sort(String.CASE_INSENSITIVE_ORDER);
        return out;
    }

    @Override public List<String> groups() { return vaultGroups(); }

    /** Vault se nevolá prikazem – zmeny provadi primo API. */
    @Override public List<String> grantCommands(String group, String node, boolean value) { return List.of(); }
    @Override public List<String> unsetCommands(String group, String node) { return List.of(); }
    @Override public List<String> createGroupCommands(String group) { return List.of(); }
    @Override public List<String> addPlayerCommands(String player, String group) { return List.of(); }

    /** Primy zapis pres Vault API. */
    public boolean apply(String group, String node, boolean value) {
        Object p = provider();
        if (p == null) return false;
        try {
            if (value) {
                p.getClass().getMethod("groupAdd", String.class, String.class, String.class)
                        .invoke(p, null, group, node);
            } else {
                p.getClass().getMethod("groupRemove", String.class, String.class, String.class)
                        .invoke(p, null, group, node);
            }
            return true;
        } catch (Throwable t) {
            return false;
        }
    }

    public boolean addPlayer(String player, String group) {
        Object p = provider();
        if (p == null) return false;
        try {
            p.getClass().getMethod("playerAddGroup", String.class, String.class, String.class)
                    .invoke(p, null, player, group);
            return true;
        } catch (Throwable t) {
            return false;
        }
    }
}
