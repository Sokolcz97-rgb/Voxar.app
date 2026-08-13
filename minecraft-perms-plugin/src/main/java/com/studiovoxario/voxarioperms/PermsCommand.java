package com.studiovoxario.voxarioperms;

import com.studiovoxario.voxarioperms.Presets.Role;
import com.studiovoxario.voxarioperms.backend.PermBackend;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class PermsCommand implements CommandExecutor, TabCompleter {

    private final VoxarioPerms plugin;

    public PermsCommand(VoxarioPerms plugin) { this.plugin = plugin; }

    private PermBackend active(CommandSender s) {
        PermBackend b = plugin.backends().best();
        if (b == null) s.sendMessage(Txt.c("&cNenasel jsem zadny permission plugin (LuckPerms, PEX, Vault...)."));
        return b;
    }

    @Override
    public boolean onCommand(@NotNull CommandSender s, @NotNull Command c, @NotNull String l, String[] a) {
        if (!s.hasPermission("voxarioperms.admin")) {
            s.sendMessage(Txt.c("&cNemas opravneni."));
            return true;
        }
        String sub = a.length == 0 ? "gui" : a[0].toLowerCase(Locale.ROOT);

        switch (sub) {
            case "gui" -> {
                if (!(s instanceof Player p)) { s.sendMessage(Txt.c("&cGUI lze otevrit jen ve hre.")); return true; }
                plugin.gui().openMain(p);
            }
            case "backends" -> {
                s.sendMessage(Txt.c("&6Permission pluginy:"));
                for (PermBackend b : plugin.backends().all()) {
                    s.sendMessage(Txt.c((b.available() ? "&a + " : "&8 - ") + b.display()
                            + (b.available() ? " &7(skupin: " + b.groups().size() + ")" : " &7neni na serveru")));
                }
            }
            case "scan" -> {
                var list = plugin.scanner().scan(plugin.getConfig().getBoolean("deep-scan", true));
                s.sendMessage(Txt.c("&6Nalezeno &f" + list.size() + " &6pluginu:"));
                for (var sp : list) s.sendMessage(Txt.c(" &7- &f" + sp.name + " &8(" + sp.perms.size() + " perms)"));
            }
            case "groups" -> {
                PermBackend b = active(s);
                if (b == null) return true;
                s.sendMessage(Txt.c("&6Skupiny (&f" + b.display() + "&6):"));
                for (String g : b.groups()) {
                    Role r = plugin.roles().get(g);
                    s.sendMessage(Txt.c(" &7- " + r.color + g + " &8[" + r.label + "]"));
                }
            }
            case "role" -> {
                if (a.length < 3) { s.sendMessage(Txt.c("&c/voxperms role <skupina> <owner|admin|moderator|builder|helper|default>")); return true; }
                try {
                    Role r = Role.valueOf(a[2].toUpperCase(Locale.ROOT));
                    plugin.roles().set(a[1], r);
                    s.sendMessage(Txt.c("&aSkupina &f" + a[1] + " &a-> " + r.color + r.label));
                } catch (IllegalArgumentException ex) {
                    s.sendMessage(Txt.c("&cNeznama role."));
                }
            }
            case "apply" -> {
                if (a.length < 2) { s.sendMessage(Txt.c("&c/voxperms apply <skupina>")); return true; }
                PermBackend b = active(s);
                if (b == null) return true;
                if (!(s instanceof Player p)) { s.sendMessage(Txt.c("&cSpust ve hre.")); return true; }
                plugin.gui().applyRolePreset(p, b, a[1]);
            }
            case "grant", "unset" -> {
                if (a.length < 3) { s.sendMessage(Txt.c("&c/voxperms " + sub + " <skupina> <permission>")); return true; }
                PermBackend b = active(s);
                if (b == null) return true;
                int n = sub.equals("grant")
                        ? plugin.applier().grant(b, a[1], List.of(a[2]), true, s)
                        : plugin.applier().unset(b, a[1], List.of(a[2]), s);
                s.sendMessage(Txt.c("&aHotovo (" + n + ") &7" + a[2] + " -> " + a[1]));
            }
            case "guide" -> {
                Guide.write(plugin.getDataFolder());
                s.sendMessage(Txt.c("&6Navody: &fplugins/VoxarioPerms/GUIDE/"));
                s.sendMessage(Txt.c(" &7- 1-ZACINAME.md, 2-SKUPINY-A-ROLE.md, 3-DETEKCE-PERMISSIONS.md, 4-PRIKAZY.md"));
            }
            case "reload" -> {
                plugin.reloadConfig();
                plugin.roles().load();
                s.sendMessage(Txt.c("&aConfig nacten znovu."));
            }
            default -> {
                s.sendMessage(Txt.c("&6VoxarioPerms &7- sprava permissions"));
                s.sendMessage(Txt.c(" &f/voxperms &7- GUI"));
                s.sendMessage(Txt.c(" &f/voxperms backends &7- detekovane permission pluginy"));
                s.sendMessage(Txt.c(" &f/voxperms scan &7- prohledat pluginy"));
                s.sendMessage(Txt.c(" &f/voxperms groups &7- skupiny a jejich role"));
                s.sendMessage(Txt.c(" &f/voxperms role <skupina> <role>"));
                s.sendMessage(Txt.c(" &f/voxperms apply <skupina> &7- preset role"));
                s.sendMessage(Txt.c(" &f/voxperms grant|unset <skupina> <permission>"));
                s.sendMessage(Txt.c(" &f/voxperms guide &7| &f/voxperms reload"));
            }
        }
        return true;
    }

    @Override
    public List<String> onTabComplete(@NotNull CommandSender s, @NotNull Command c, @NotNull String l, String[] a) {
        List<String> out = new ArrayList<>();
        if (a.length == 1) {
            for (String x : List.of("gui", "backends", "scan", "groups", "role", "apply", "grant", "unset", "guide", "reload"))
                if (x.startsWith(a[0].toLowerCase(Locale.ROOT))) out.add(x);
        } else if (a.length == 2 && List.of("role", "apply", "grant", "unset").contains(a[0].toLowerCase(Locale.ROOT))) {
            PermBackend b = plugin.backends().best();
            if (b != null) for (String g : b.groups()) if (g.toLowerCase(Locale.ROOT).startsWith(a[1].toLowerCase(Locale.ROOT))) out.add(g);
        } else if (a.length == 3 && a[0].equalsIgnoreCase("role")) {
            for (Role r : Role.values()) out.add(r.name().toLowerCase(Locale.ROOT));
        }
        return out;
    }
}
