package com.studiovoxario.voxarioupdater;

import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class UpdateCommand implements CommandExecutor, TabCompleter {

    private final VoxarioUpdater plugin;

    public UpdateCommand(VoxarioUpdater plugin) { this.plugin = plugin; }

    @Override
    public boolean onCommand(CommandSender s, Command cmd, String label, String[] a) {
        if (!s.hasPermission("voxarioupdater.admin")) {
            s.sendMessage(Msg.color("&cNemas opravneni."));
            return true;
        }
        String sub = a.length == 0 ? "help" : a[0].toLowerCase(Locale.ROOT);

        switch (sub) {
            case "check" -> {
                s.sendMessage(Msg.color("&eKontroluji aktualizace..."));
                async(() -> {
                    plugin.runCheck(false);
                    printList(s);
                });
            }
            case "list" -> printList(s);
            case "status" -> status(s);
            case "pending" -> pending(s);
            case "update" -> {
                if (a.length < 2) { s.sendMessage(Msg.color("&7/voxupdate update <plugin|all>")); return true; }
                String target = a[1];
                s.sendMessage(Msg.color("&ePracuji..."));
                async(() -> doUpdate(s, target));
            }
            case "auth" -> auth(s, a);
            case "logout" -> {
                if (a.length < 2) { s.sendMessage(Msg.color("&7/voxupdate logout <platforma>")); return true; }
                plugin.auth().clear(a[1].toLowerCase(Locale.ROOT));
                s.sendMessage(Msg.color("&aToken pro " + a[1] + " byl smazan."));
            }
            case "reload" -> {
                plugin.reloadConfig();
                plugin.manager().reloadProviders();
                Guide.write(plugin.getDataFolder());
                s.sendMessage(Msg.color("&aConfig nacten."));
            }
            case "guide" -> {
                s.sendMessage(Msg.color("&6Navody: &fplugins/VoxarioUpdater/GUIDE/"));
                s.sendMessage(Msg.color("&7 1-ZACINAME.md &8| &72-PLATFORMY.md &8| &73-PLACENE-PLUGINY.md &8| &74-BEZPECNOST.md"));
            }
            default -> help(s);
        }
        return true;
    }

    private void async(Runnable r) {
        Bukkit.getAsyncScheduler().runNow(plugin, t -> r.run());
    }

    private void help(CommandSender s) {
        s.sendMessage(Msg.color("&8&m                    &r &6&lVoxarioUpdater &8&m                    "));
        s.sendMessage(Msg.color("&e/voxupdate check &8- &7zkontroluje vsechny pluginy"));
        s.sendMessage(Msg.color("&e/voxupdate list &8- &7vypise posledni vysledky"));
        s.sendMessage(Msg.color("&e/voxupdate update <plugin|all> &8- &7stahne aktualizaci"));
        s.sendMessage(Msg.color("&e/voxupdate pending &8- &7co ceka na nasazeni"));
        s.sendMessage(Msg.color("&e/voxupdate status &8- &7platformy a prihlaseni"));
        s.sendMessage(Msg.color("&e/voxupdate auth <platforma> [token] &8- &7prihlaseni pres prohlizec"));
        s.sendMessage(Msg.color("&e/voxupdate logout <platforma> &8- &7smaze ulozeny token"));
        s.sendMessage(Msg.color("&e/voxupdate reload &8| &e/voxupdate guide"));
        s.sendMessage(Msg.color("&7Aktualizace se nasazuji pri restartu serveru."));
    }

    private void printList(CommandSender s) {
        List<UpdateInfo> res = plugin.manager().lastResults();
        if (res.isEmpty()) {
            s.sendMessage(Msg.color("&7Zadna data - spust &e/voxupdate check&7."));
            return;
        }
        s.sendMessage(Msg.color("&6Pluginy (" + res.size() + "):"));
        for (UpdateInfo u : res) {
            PluginEntry e = u.entry;
            String head = "&8- &f" + e.name + " &7v" + e.version;
            if (u.available) {
                String state = !u.paid ? "&a" + u.latestVersion + " k dispozici"
                        : (u.ownershipVerified ? "&a" + u.latestVersion + " (placeny, vlastnite)"
                                               : "&c" + u.latestVersion + " (placeny, neoverene)");
                s.sendMessage(Msg.color(head + " &8-> " + state + " &8[" + e.provider + "]"));
            } else if (u.latestVersion != null) {
                s.sendMessage(Msg.color(head + " &8- &7aktualni &8[" + e.provider + "]"));
            } else {
                s.sendMessage(Msg.color(head + " &8- &8" + u.note));
            }
            if (u.paid && !u.ownershipVerified && u.pageUrl != null && !u.pageUrl.isBlank()) {
                s.sendMessage(Component.text("   ").append(Msg.link("> Stranka pluginu", u.pageUrl)));
            }
        }
    }

    private void status(CommandSender s) {
        s.sendMessage(Msg.color("&6Platformy:"));
        for (UpdateProvider p : plugin.manager().providers().values()) {
            String state;
            if (!p.supportsAuth()) state = "&7bez prihlaseni (verejne)";
            else if (p.authenticated()) state = "&aPRIHLASEN - overovani vlastnictvi aktivni";
            else state = "&cNEPRIHLASEN - placene pluginy se nestahnou";
            s.sendMessage(Msg.color("&8- &f" + p.displayName() + " &8(" + p.id() + ") &8: " + state));
        }
        s.sendMessage(Msg.color("&7Hesla se nikdy neukladaji. Ulozene jsou pouze sifrovane API tokeny."));
    }

    private void pending(CommandSender s) {
        File stage = new File(plugin.getDataFolder().getParentFile(),
                plugin.getConfig().getString("staging-folder", "update"));
        File[] f = stage.listFiles(x -> x.getName().toLowerCase().endsWith(".jar"));
        if (f == null || f.length == 0) {
            s.sendMessage(Msg.color("&7Nic neceka na nasazeni."));
            return;
        }
        s.sendMessage(Msg.color("&6Ceka na restart (" + f.length + "):"));
        for (File x : f) s.sendMessage(Msg.color("&8- &f" + x.getName()));
    }

    private void doUpdate(CommandSender s, String target) {
        List<UpdateInfo> res = plugin.manager().lastResults();
        if (res.isEmpty()) res = plugin.manager().checkAll();

        boolean all = target.equalsIgnoreCase("all");
        int done = 0;
        for (UpdateInfo u : res) {
            if (!all && !u.entry.name.equalsIgnoreCase(target)) continue;
            if (!u.available) {
                if (!all) s.sendMessage(Msg.color("&7" + u.entry.name + " je aktualni."));
                continue;
            }
            UpdateManager.Result r = plugin.manager().download(u);
            s.sendMessage(Msg.color((r.ok() ? "&a[OK] " : "&c[--] ") + r.message()));
            if (!r.ok() && u.paid && !u.ownershipVerified) {
                UpdateProvider p = plugin.manager().provider(u.entry.provider);
                if (p != null && p.supportsAuth() && !p.authenticated()) {
                    s.sendMessage(Msg.color("&ePrihlas se: &7/voxupdate auth " + p.id()));
                }
            }
            if (r.ok()) done++;
            if (!all) return;
        }
        if (all) s.sendMessage(Msg.color("&aHotovo: " + done + " aktualizaci pripraveno na restart."));
        else if (done == 0) s.sendMessage(Msg.color("&7Plugin '" + target + "' nenalezen ve vysledcich."));
    }

    private void auth(CommandSender s, String[] a) {
        if (a.length < 2) {
            s.sendMessage(Msg.color("&7/voxupdate auth <platforma> [token]"));
            for (UpdateProvider p : plugin.manager().providers().values())
                if (p.supportsAuth()) s.sendMessage(Msg.color("&8- &f" + p.id()));
            return;
        }
        UpdateProvider p = plugin.manager().provider(a[1]);
        if (p == null) { s.sendMessage(Msg.color("&cNeznama platforma.")); return; }
        if (!p.supportsAuth()) { s.sendMessage(Msg.color("&7" + p.displayName() + " prihlaseni nepotrebuje.")); return; }

        if (a.length == 2) {
            s.sendMessage(Msg.color("&6" + p.displayName() + " &7- prihlaseni probiha v prohlizeci."));
            s.sendMessage(Component.text("   ").append(Msg.link("> Otevrit prihlaseni", p.authUrl())));
            if (!p.ssoOptions().isEmpty())
                s.sendMessage(Msg.color("&7Moznosti prihlaseni: &f" + String.join(", ", p.ssoOptions())));
            s.sendMessage(Msg.color("&7Na strance vygeneruj API token a vloz ho:"));
            s.sendMessage(Msg.color("&e/voxupdate auth " + p.id() + " <TOKEN>"));
            s.sendMessage(Msg.color("&8Heslo do hry ani na server nikdy nezadavej."));
            return;
        }

        String token = a[2];
        if (s instanceof Player pl) {
            pl.sendMessage(Msg.color("&7Overuji token... (nikam se nevypisuje)"));
        }
        async(() -> {
            String err = p.finishAuth(token);
            if (err == null) {
                s.sendMessage(Msg.color("&aPrihlaseni k " + p.displayName() + " probehlo uspesne."));
                s.sendMessage(Msg.color("&7Token je ulozen sifrovane (AES-256-GCM). Zrusit: /voxupdate logout " + p.id()));
            } else {
                s.sendMessage(Msg.color("&c" + err));
            }
        });
    }

    @Override
    public List<String> onTabComplete(CommandSender s, Command c, String label, String[] a) {
        List<String> out = new ArrayList<>();
        if (a.length == 1) {
            for (String x : List.of("check", "list", "update", "pending", "status", "auth", "logout", "reload", "guide", "help"))
                if (x.startsWith(a[0].toLowerCase(Locale.ROOT))) out.add(x);
        } else if (a.length == 2) {
            switch (a[0].toLowerCase(Locale.ROOT)) {
                case "update" -> {
                    out.add("all");
                    for (UpdateInfo u : plugin.manager().lastResults()) out.add(u.entry.name);
                }
                case "auth", "logout" -> {
                    for (UpdateProvider p : plugin.manager().providers().values())
                        if (p.supportsAuth()) out.add(p.id());
                }
                default -> {}
            }
            out.removeIf(x -> !x.toLowerCase(Locale.ROOT).startsWith(a[1].toLowerCase(Locale.ROOT)));
        }
        return out;
    }
}
