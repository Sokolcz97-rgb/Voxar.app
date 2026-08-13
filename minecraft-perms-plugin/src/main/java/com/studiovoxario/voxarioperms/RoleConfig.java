package com.studiovoxario.voxarioperms;

import com.studiovoxario.voxarioperms.Presets.Role;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/** Mapovani skupina -> role (owner/admin/moderator/builder/helper/default). */
public final class RoleConfig {

    private final File file;
    private YamlConfiguration yml;
    private final Map<String, Role> map = new LinkedHashMap<>();

    public RoleConfig(File dataFolder) {
        this.file = new File(dataFolder, "roles.yml");
        load();
    }

    public void load() {
        map.clear();
        file.getParentFile().mkdirs();
        yml = YamlConfiguration.loadConfiguration(file);
        var sec = yml.getConfigurationSection("groups");
        if (sec != null) {
            for (String g : sec.getKeys(false)) {
                try { map.put(g.toLowerCase(Locale.ROOT), Role.valueOf(sec.getString(g, "DEFAULT").toUpperCase(Locale.ROOT))); }
                catch (Exception ignored) {}
            }
        }
    }

    public void save() {
        yml.set("groups", null);
        for (var e : map.entrySet()) yml.set("groups." + e.getKey(), e.getValue().name());
        try { yml.save(file); } catch (Exception ignored) {}
    }

    public Role get(String group) {
        Role r = map.get(group.toLowerCase(Locale.ROOT));
        if (r != null) return r;
        return guess(group);
    }

    public void set(String group, Role role) {
        map.put(group.toLowerCase(Locale.ROOT), role);
        save();
    }

    public Role cycle(String group) {
        Role cur = get(group);
        Role[] v = Role.values();
        Role next = v[(cur.ordinal() + 1) % v.length];
        set(group, next);
        return next;
    }

    /** Automaticky odhad role podle nazvu skupiny. */
    public static Role guess(String group) {
        String g = group.toLowerCase(Locale.ROOT);
        if (g.contains("owner") || g.contains("majitel") || g.contains("root")) return Role.OWNER;
        if (g.contains("admin") || g.contains("srmod") || g.contains("manager")) return Role.ADMIN;
        if (g.contains("mod") || g.contains("staff")) return Role.MODERATOR;
        if (g.contains("build") || g.contains("stavitel") || g.contains("architect")) return Role.BUILDER;
        if (g.contains("help") || g.contains("trial") || g.contains("support")) return Role.HELPER;
        return Role.DEFAULT;
    }
}
