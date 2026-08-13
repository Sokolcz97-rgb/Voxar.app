package com.studiovoxario.voxarioperms;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Rychla tlacitka: heuristicky vyber permissions podle role. */
public final class Presets {

    public enum Role {
        OWNER("Owner", "&c"),
        ADMIN("Admin", "&6"),
        MODERATOR("Moderator", "&e"),
        BUILDER("Builder", "&a"),
        HELPER("Helper", "&b"),
        DEFAULT("Default", "&7");

        public final String label;
        public final String color;
        Role(String label, String color) { this.label = label; this.color = color; }
    }

    private static final String[] ADMIN_KEYS = {"admin", "reload", "config", "manage", "setup", "op", "bypass", "gamemode", "give"};
    private static final String[] MOD_KEYS = {"ban", "kick", "mute", "warn", "jail", "staff", "mod", "vanish", "freeze", "report", "spy", "history", "check", "inspect", "tempban", "unban"};
    private static final String[] BUILD_KEYS = {"build", "wand", "edit", "schem", "brush", "region", "worldedit", "paste", "copy", "place", "break", "fly", "creative"};
    private static final String[] HELPER_KEYS = {"help", "tp", "teleport", "kick", "mute", "warn", "msg", "list", "who", "afk"};
    private static final String[] USER_KEYS = {"use", "user", "player", "spawn", "home", "tpa", "chat", "join", "basic", "default"};

    private Presets() {}

    public static List<String> pick(Role role, List<String> nodes) {
        List<String> out = new ArrayList<>();
        if (role == Role.OWNER || role == Role.ADMIN) {
            if (role == Role.OWNER) return nodes;
        }
        String[] keys = switch (role) {
            case ADMIN -> ADMIN_KEYS;
            case MODERATOR -> MOD_KEYS;
            case BUILDER -> BUILD_KEYS;
            case HELPER -> HELPER_KEYS;
            default -> USER_KEYS;
        };
        for (String n : nodes) {
            String low = n.toLowerCase(Locale.ROOT);
            for (String k : keys) {
                if (low.contains(k)) { out.add(n); break; }
            }
        }
        return out;
    }

    /** Ma se pri teto roli udelit wildcard "*"? */
    public static boolean wildcard(Role role) { return role == Role.OWNER; }
}
