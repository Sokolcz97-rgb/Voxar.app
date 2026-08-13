package com.studiovoxario.voxarioperms.backend;

import org.bukkit.Bukkit;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;

/** LuckPerms - skupiny cte pres LuckPerms API (reflexe), zmeny dela pres /lp prikazy. */
public final class LuckPermsBackend extends CommandBackend {

    public LuckPermsBackend() { super("luckperms", "LuckPerms", "LuckPerms"); }

    @Override
    public List<String> groups() {
        List<String> out = new ArrayList<>();
        try {
            Class<?> provider = Class.forName("net.luckperms.api.LuckPermsProvider");
            Object api = provider.getMethod("get").invoke(null);
            Class<?> apiIf = Class.forName("net.luckperms.api.LuckPerms");
            Object gm = apiIf.getMethod("getGroupManager").invoke(api);
            Method loaded = gm.getClass().getMethod("getLoadedGroups");
            loaded.setAccessible(true);
            Object res = loaded.invoke(gm);
            if (res instanceof Collection<?> col) {
                for (Object g : col) {
                    Method n = g.getClass().getMethod("getName");
                    n.setAccessible(true);
                    out.add(String.valueOf(n.invoke(g)));
                }
            }
        } catch (Throwable ignored) {
            // API neni dostupne -> zkusime Vault
            out.addAll(VaultBackend.vaultGroups());
        }
        out.sort(String.CASE_INSENSITIVE_ORDER);
        return out;
    }

    @Override
    public List<String> grantCommands(String group, String node, boolean value) {
        return of("lp group " + group + " permission set " + node + " " + value);
    }

    @Override
    public List<String> unsetCommands(String group, String node) {
        return of("lp group " + group + " permission unset " + node);
    }

    @Override
    public List<String> createGroupCommands(String group) {
        return of("lp creategroup " + group.toLowerCase(Locale.ROOT));
    }

    @Override
    public List<String> addPlayerCommands(String player, String group) {
        return of("lp user " + player + " parent add " + group);
    }

    public static boolean present() {
        var p = Bukkit.getPluginManager().getPlugin("LuckPerms");
        return p != null && p.isEnabled();
    }
}
