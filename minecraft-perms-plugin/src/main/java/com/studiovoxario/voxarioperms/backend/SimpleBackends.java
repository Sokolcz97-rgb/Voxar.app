package com.studiovoxario.voxarioperms.backend;

import java.util.ArrayList;
import java.util.List;

/** Dalsi bezne permission pluginy ovladane prikazy. */
public final class SimpleBackends {

    private SimpleBackends() {}

    public static final class Pex extends CommandBackend {
        public Pex() { super("pex", "PermissionsEx", "PermissionsEx"); }
        @Override public List<String> groups() { return VaultBackend.vaultGroups(); }
        @Override public List<String> grantCommands(String g, String n, boolean v) {
            return v ? of("pex group " + g + " add " + n) : of("pex group " + g + " add " + n + " false");
        }
        @Override public List<String> unsetCommands(String g, String n) { return of("pex group " + g + " remove " + n); }
        @Override public List<String> createGroupCommands(String g) { return of("pex group " + g + " create"); }
        @Override public List<String> addPlayerCommands(String p, String g) { return of("pex user " + p + " group add " + g); }
    }

    public static final class GroupManager extends CommandBackend {
        public GroupManager() { super("groupmanager", "GroupManager", "GroupManager"); }
        @Override public List<String> groups() { return VaultBackend.vaultGroups(); }
        @Override public List<String> grantCommands(String g, String n, boolean v) {
            return v ? of("manselect 0", "mangaddp " + g + " " + n)
                     : of("manselect 0", "mangaddp " + g + " -" + n);
        }
        @Override public List<String> unsetCommands(String g, String n) { return of("manselect 0", "mangdelp " + g + " " + n); }
        @Override public List<String> createGroupCommands(String g) { return of("manselect 0", "mangadd " + g); }
        @Override public List<String> addPlayerCommands(String p, String g) { return of("manselect 0", "manuadd " + p + " " + g); }
    }

    public static final class ZPermissions extends CommandBackend {
        public ZPermissions() { super("zpermissions", "zPermissions", "zPermissions"); }
        @Override public List<String> groups() { return VaultBackend.vaultGroups(); }
        @Override public List<String> grantCommands(String g, String n, boolean v) { return of("permissions group " + g + " set " + n + " " + v); }
        @Override public List<String> unsetCommands(String g, String n) { return of("permissions group " + g + " unset " + n); }
        @Override public List<String> createGroupCommands(String g) { return of("permissions group " + g + " create"); }
        @Override public List<String> addPlayerCommands(String p, String g) { return of("permissions group " + g + " add " + p); }
    }

    public static final class UltraPermissions extends CommandBackend {
        public UltraPermissions() { super("ultrapermissions", "UltraPermissions", "UltraPermissions"); }
        @Override public List<String> groups() { return VaultBackend.vaultGroups(); }
        @Override public List<String> grantCommands(String g, String n, boolean v) { return of("up group " + g + " add permission " + n + " " + v); }
        @Override public List<String> unsetCommands(String g, String n) { return of("up group " + g + " remove permission " + n); }
        @Override public List<String> createGroupCommands(String g) { return of("up group create " + g); }
        @Override public List<String> addPlayerCommands(String p, String g) { return of("up user " + p + " add group " + g); }
    }

    public static final class PowerfulPerms extends CommandBackend {
        public PowerfulPerms() { super("powerfulperms", "PowerfulPerms", "PowerfulPerms"); }
        @Override public List<String> groups() { return VaultBackend.vaultGroups(); }
        @Override public List<String> grantCommands(String g, String n, boolean v) { return of("pp group " + g + " permissions add " + n + " " + (v ? "true" : "false")); }
        @Override public List<String> unsetCommands(String g, String n) { return of("pp group " + g + " permissions remove " + n); }
        @Override public List<String> createGroupCommands(String g) { return of("pp group create " + g); }
        @Override public List<String> addPlayerCommands(String p, String g) { return of("pp user " + p + " groups add " + g); }
    }

    public static List<PermBackend> all() {
        List<PermBackend> l = new ArrayList<>();
        l.add(new LuckPermsBackend());
        l.add(new Pex());
        l.add(new GroupManager());
        l.add(new ZPermissions());
        l.add(new UltraPermissions());
        l.add(new PowerfulPerms());
        l.add(new VaultBackend());
        return l;
    }
}
