package com.studiovoxario.voxariobridge;

import org.bukkit.ChatColor;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class VoxarioBridge extends JavaPlugin {

    private BridgeClient client;
    private BukkitTask pullTask;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        setup();
        getServer().getPluginManager().registerEvents(new EventsListener(this), this);
        sendStatus("start");
        getLogger().info("VoxarioBridge zapnut.");
    }

    @Override
    public void onDisable() {
        sendStatusSync("stop");
        if (pullTask != null) pullTask.cancel();
        getLogger().info("VoxarioBridge vypnut.");
    }

    private void setup() {
        reloadConfig();
        String url = getConfig().getString("bridge-url", "");
        String token = getConfig().getString("token", "");
        client = new BridgeClient(this, url, token);
        if (token == null || token.isEmpty() || token.startsWith("SEM-VLOZ")) {
            getLogger().warning("Neni nastaven plugin token! Vloz ho do plugins/VoxarioBridge/config.yml");
        }
        if (pullTask != null) pullTask.cancel();
        int interval = getConfig().getInt("pull-interval", 3);
        if (interval > 0) {
            pullTask = Bukkit.getScheduler().runTaskTimerAsynchronously(this, this::pullDiscord, 100L, interval * 20L);
        }
    }

    public BridgeClient client() {
        return client;
    }

    public boolean eventEnabled(String key) {
        return getConfig().getBoolean("events." + key, true);
    }

    public void send(Map<String, String> body) {
        client.postAsync(body);
    }

    private void sendStatus(String status) {
        if (!eventEnabled("server-status")) return;
        Map<String, String> b = new HashMap<>();
        b.put("action", "server_status");
        b.put("status", status);
        client.postAsync(b);
    }

    private void sendStatusSync(String status) {
        if (!eventEnabled("server-status")) return;
        Map<String, String> b = new HashMap<>();
        b.put("action", "server_status");
        b.put("status", status);
        client.postSync(Json.object(b));
    }

    /** Poll: stahne zpravy z Discordu a vypise je do herniho chatu. */
    private void pullDiscord() {
        Map<String, String> b = new HashMap<>();
        b.put("action", "pull_discord_to_mc");
        String res = client.postSync(Json.object(b));
        if (res == null) return;
        List<String> msgs = Json.getObjectArray(res, "messages");
        if (msgs.isEmpty()) return;
        String fmt = getConfig().getString("discord-to-mc-format", "&9[Discord] &b{name}&f: {message}");
        for (String m : msgs) {
            String name = String.valueOf(Json.getString(m, "name"));
            String msg = String.valueOf(Json.getString(m, "message"));
            String line = ChatColor.translateAlternateColorCodes('&',
                    fmt.replace("{name}", name == null ? "?" : name)
                       .replace("{message}", msg == null ? "" : msg));
            Bukkit.getScheduler().runTask(this, () -> Bukkit.broadcastMessage(line));
        }
    }

    @Override
    public boolean onCommand(CommandSender sender, Command cmd, String label, String[] args) {
        if (cmd.getName().equalsIgnoreCase("voxario")) {
            if (!sender.hasPermission("voxario.admin")) {
                sender.sendMessage(ChatColor.RED + "Nemas opravneni.");
                return true;
            }
            if (args.length > 0 && args[0].equalsIgnoreCase("reload")) {
                setup();
                sender.sendMessage(ChatColor.GREEN + "VoxarioBridge: konfigurace nactena.");
                return true;
            }
            if (args.length > 0 && args[0].equalsIgnoreCase("test")) {
                Map<String, String> b = new HashMap<>();
                b.put("action", "chat");
                b.put("name", sender.getName());
                b.put("uuid", sender instanceof Player ? ((Player) sender).getUniqueId().toString() : "console");
                b.put("message", "Testovaci zprava z VoxarioBridge");
                client.postAsync(b, res -> sender.sendMessage(res == null
                        ? ChatColor.RED + "Test selhal – zkontroluj token a URL."
                        : ChatColor.GREEN + "Test odeslan."));
                return true;
            }
            sender.sendMessage(ChatColor.AQUA + "/voxario reload | test");
            return true;
        }

        if (cmd.getName().equalsIgnoreCase("discord")) {
            if (!(sender instanceof Player)) {
                sender.sendMessage("Pouze pro hrace.");
                return true;
            }
            Player p = (Player) sender;
            if (args.length < 2 || !args[0].equalsIgnoreCase("link")) {
                p.sendMessage(ChatColor.AQUA + "Pouziti: /discord link <KOD>");
                p.sendMessage(ChatColor.GRAY + "Kod ziskas na webu v sekci Minecraft.");
                return true;
            }
            Map<String, String> b = new HashMap<>();
            b.put("action", "verify_link");
            b.put("name", p.getName());
            b.put("uuid", p.getUniqueId().toString());
            b.put("code", args[1].toUpperCase());
            client.postAsync(b, res -> {
                if (res != null && res.contains("\"ok\"")) {
                    p.sendMessage(ChatColor.GREEN + "Ucet byl uspesne propojen s Discordem!");
                } else {
                    p.sendMessage(ChatColor.RED + "Kod je neplatny nebo vyprsel.");
                }
            });
            return true;
        }
        return false;
    }
}
