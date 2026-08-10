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
                plugin.gui().open(player, 0, args.length > 1 ? args[1] : null);
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
            case "reload" -> {
                if (!sender.hasPermission("voxarioforge.admin")) return deny(sender);
                plugin.reloadConfig();
                plugin.reloadContent();
                sender.sendMessage(Component.text("VoxarioForge nacten znovu ("
                        + plugin.registry().constructs().size() + " constructs).", NamedTextColor.AQUA));
            }
            case "list" -> {
                sender.sendMessage(Component.text("Constructs:", NamedTextColor.AQUA));
                for (Construct c : plugin.registry().constructs().values()) {
                    sender.sendMessage(Component.text(" - " + c.id() + " [" + c.category() + "] "
                            + (c.fixture() ? "(fixture)" : ""), NamedTextColor.GRAY));
                }
            }
            case "blueprints" -> {
                sender.sendMessage(Component.text("Blueprints (.bbmodel):", NamedTextColor.AQUA));
                plugin.registry().blueprints().keySet()
                        .forEach(b -> sender.sendMessage(Component.text(" - " + b, NamedTextColor.GRAY)));
            }
            default -> help(sender);
        }
        return true;
    }

    private void help(CommandSender sender) {
        sender.sendMessage(Component.text("=== VoxarioForge ===", NamedTextColor.AQUA));
        sender.sendMessage(Component.text("/voxforge gui [kategorie] - otevre Forge Terminal", NamedTextColor.GRAY));
        sender.sendMessage(Component.text("/voxforge give <id> [hrac] [pocet]", NamedTextColor.GRAY));
        sender.sendMessage(Component.text("/voxforge pack - sestavi resource pack", NamedTextColor.GRAY));
        sender.sendMessage(Component.text("/voxforge reload - znovu nacte packy", NamedTextColor.GRAY));
        sender.sendMessage(Component.text("/voxforge list | blueprints", NamedTextColor.GRAY));
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
            for (String s : List.of("gui", "give", "pack", "reload", "list", "blueprints", "help")) {
                if (s.startsWith(args[0].toLowerCase(Locale.ROOT))) out.add(s);
            }
        } else if (args.length == 2 && args[0].equalsIgnoreCase("give")) {
            out.addAll(plugin.registry().constructs().keySet());
        } else if (args.length == 2 && args[0].equalsIgnoreCase("gui")) {
            out.addAll(plugin.registry().categories());
        }
        return out;
    }
}
