package com.studiovoxario.voxarioforge;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class ForgeCommand implements CommandExecutor, TabCompleter {

    private final VoxarioForge plugin;

    public ForgeCommand(VoxarioForge plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        String sub = args.length > 0 ? args[0].toLowerCase(Locale.ROOT) : "help";

        switch (sub) {
            case "gui" -> {
                if (!(sender instanceof Player player)) {
                    sender.sendMessage(Component.text("Jen pro hrace.", NamedTextColor.RED));
                    return true;
                }
                if (args.length > 1 && plugin.sources().get(args[1]) != null) {
                    plugin.gui().open(player, 0, args[1], args.length > 2 ? args[2] : null);
                } else if (args.length > 1) {
                    plugin.gui().open(player, 0, null, args[1]);
                } else {
                    plugin.gui().openMenu(player);
                }
            }
            case "station" -> {
                if (!(sender instanceof Player player)) {
                    sender.sendMessage(Component.text("Jen pro hrace.", NamedTextColor.RED));
                    return true;
                }
                if (args.length < 2) {
                    sender.sendMessage(Component.text("Stanice: "
                            + String.join(", ", plugin.stations().stations().keySet()), NamedTextColor.YELLOW));
                    return true;
                }
                Station station = plugin.stations().get(args[1]);
                if (station == null) {
                    sender.sendMessage(Component.text("Stanice nenalezena: " + args[1], NamedTextColor.RED));
                    return true;
                }
                plugin.stationGui().open(player, station);
            }
            case "give" -> {
                if (!sender.hasPermission("voxarioforge.admin")) return deny(sender);
                if (args.length < 2) {
                    sender.sendMessage(Component.text("/voxforge give <id> [hrac] [pocet]", NamedTextColor.YELLOW));
                    return true;
                }
                Construct c = plugin.registry().get(args[1].toLowerCase(Locale.ROOT));
                if (c == null) {
                    sender.sendMessage(Component.text("Construct nenalezen: " + args[1], NamedTextColor.RED));
                    return true;
                }
                Player target = args.length > 2 ? Bukkit.getPlayerExact(args[2])
                        : (sender instanceof Player p ? p : null);
                if (target == null) {
                    sender.sendMessage(Component.text("Hrac nenalezen.", NamedTextColor.RED));
                    return true;
                }
                int amount = args.length > 3 ? parseInt(args[3], 1) : 1;
                target.getInventory().addItem(plugin.registry().build(c, amount));
                sender.sendMessage(Component.text("Predano " + amount + "x " + c.id() + " -> "
                        + target.getName(), NamedTextColor.AQUA));
            }
            case "pack" -> {
                if (!sender.hasPermission("voxarioforge.admin")) return deny(sender);
                plugin.rebuildPack(sender);
            }
            case "sync" -> {
                if (!sender.hasPermission("voxarioforge.admin")) return deny(sender);
                if (!plugin.mysql().enabled()) {
                    sender.sendMessage(Component.text("MySQL sync je vypnuty (config.yml -> mysql.enabled).",
                            NamedTextColor.RED));
                    return true;
                }
                String mode = args.length > 1 ? args[1].toLowerCase(Locale.ROOT) : "status";
                Scheduling.async(plugin, () -> {
                    try {
                        switch (mode) {
                            case "push" -> sender.sendMessage(Component.text(
                                    "Nahrano " + plugin.mysql().push() + " souboru do MySQL.", NamedTextColor.AQUA));
                            case "pull" -> {
                                int changed = plugin.mysql().pull();
                                Scheduling.global(plugin, plugin::reloadContent);
                                plugin.rebuildPack(sender);
                                sender.sendMessage(Component.text("Staženo " + changed + " zmen z MySQL.",
                                        NamedTextColor.AQUA));
                            }
                            default -> sender.sendMessage(Component.text(
                                    "MySQL sync aktivni | pack URL: "
                                            + (plugin.packServer().publicUrl().isBlank()
                                            ? "nenastaveno" : plugin.packServer().publicUrl()),
                                    NamedTextColor.AQUA));
                        }
                    } catch (Exception e) {
                        sender.sendMessage(Component.text("Sync selhal: " + e.getMessage(), NamedTextColor.RED));
                    }
                });
            }
            case "reload" -> {
                if (!sender.hasPermission("voxarioforge.admin")) return deny(sender);
                plugin.reloadConfig();
                plugin.reloadContent();
                sender.sendMessage(Component.text("VoxarioForge nacten znovu ("
                        + plugin.registry().constructs().size() + " constructs, "
                        + plugin.stations().stations().size() + " stanic).", NamedTextColor.AQUA));
            }
            case "reset" -> {
                if (!sender.hasPermission("voxarioforge.admin")) return deny(sender);
                plugin.restoreDefaults();
                plugin.rebuildPack(sender);
                sender.sendMessage(Component.text("Vestaveny obsah obnoven a pack se prestavuje.",
                        NamedTextColor.AQUA));
            }
            case "list" -> {
                sender.sendMessage(Component.text("Constructs:", NamedTextColor.AQUA));
                for (Construct c : plugin.registry().constructs().values()) {
                    sender.sendMessage(Component.text(" - " + c.id() + " [" + c.category() + "] "
                            + (c.fixture() ? "(fixture)" : ""), NamedTextColor.GRAY));
                }
            }
            case "stations" -> {
                sender.sendMessage(Component.text("Stanice:", NamedTextColor.AQUA));
                for (Station s : plugin.stations().stations().values()) {
                    sender.sendMessage(Component.text(" - " + s.id() + " [" + s.type() + "] receptu: "
                            + s.recipes().size(), NamedTextColor.GRAY));
                }
            }
            case "sources" -> {
                sender.sendMessage(Component.text("Zdroje obsahu:", NamedTextColor.AQUA));
                for (SourceManager.Source s : plugin.sources().sources().values()) {
                    sender.sendMessage(Component.text(" - " + s.id() + " [" + s.format() + "] "
                            + (s.enabled() ? "on" : "off") + " | itemu: "
                            + plugin.registry().bySource(s.id()).size()
                            + " | sources/" + s.id() + "/", NamedTextColor.GRAY));
                }
            }
            case "import" -> {
                if (!sender.hasPermission("voxarioforge.admin")) return deny(sender);
                sender.sendMessage(Component.text("Kontroluji imports/ ...", NamedTextColor.YELLOW));
                plugin.importWatcher().tick();
                plugin.reloadContent();
                plugin.rebuildPack(sender);
            }
            case "blueprints" -> {
                sender.sendMessage(Component.text("Blueprints:", NamedTextColor.AQUA));
                plugin.registry().blueprints().keySet().forEach(b ->
                        sender.sendMessage(Component.text(" - " + b, NamedTextColor.GRAY)));
            }
            default -> {
                sender.sendMessage(Component.text("VoxarioForge", NamedTextColor.AQUA));
                sender.sendMessage(Component.text("/voxforge gui [zdroj] [kategorie] - RPG prohlizec obsahu", NamedTextColor.GRAY));
                sender.sendMessage(Component.text("/voxforge sources - seznam zdroju (oraxen/itemsadder/nexo/voxario)", NamedTextColor.GRAY));
                sender.sendMessage(Component.text("/voxforge import - zpracovat ZIPy z imports/ a prestavet pack", NamedTextColor.GRAY));
                sender.sendMessage(Component.text("/voxforge station <id> - otevrit RPG stanici", NamedTextColor.GRAY));
                sender.sendMessage(Component.text("/voxforge stations - seznam stanic", NamedTextColor.GRAY));
                sender.sendMessage(Component.text("/voxforge give <id> [hrac] [pocet]", NamedTextColor.GRAY));
                sender.sendMessage(Component.text("/voxforge pack - sestavit resource pack", NamedTextColor.GRAY));
                sender.sendMessage(Component.text("/voxforge sync push|pull|status - MySQL", NamedTextColor.GRAY));
                sender.sendMessage(Component.text("/voxforge reset - obnovit vestavene modely/stanice\n/voxforge reload | list | blueprints", NamedTextColor.GRAY));
            }
        }
        return true;
    }

    private boolean deny(CommandSender sender) {
        sender.sendMessage(Component.text("Nemas opravneni.", NamedTextColor.RED));
        return true;
    }

    private int parseInt(String raw, int def) {
        try {
            return Math.max(1, Math.min(2304, Integer.parseInt(raw)));
        } catch (NumberFormatException e) {
            return def;
        }
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        List<String> out = new ArrayList<>();
        if (args.length == 1) {
            for (String s : List.of("gui", "station", "stations", "give", "pack", "sync",
                    "reload", "reset", "list", "blueprints", "help")) {
                if (s.startsWith(args[0].toLowerCase(Locale.ROOT))) out.add(s);
            }
        } else if (args.length == 2 && args[0].equalsIgnoreCase("give")) {
            out.addAll(plugin.registry().constructs().keySet());
        } else if (args.length == 2 && args[0].equalsIgnoreCase("gui")) {
            out.addAll(plugin.sources().sources().keySet());
            out.addAll(plugin.registry().categories());
        } else if (args.length == 2 && args[0].equalsIgnoreCase("station")) {
            out.addAll(plugin.stations().stations().keySet());
        } else if (args.length == 2 && args[0].equalsIgnoreCase("sync")) {
            out.addAll(List.of("push", "pull", "status"));
        }
        return out;
    }
}
