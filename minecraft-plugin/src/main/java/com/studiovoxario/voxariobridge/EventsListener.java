package com.studiovoxario.voxariobridge;

import org.bukkit.ChatColor;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.player.AsyncPlayerChatEvent;
import org.bukkit.event.player.PlayerAdvancementDoneEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;

import java.util.HashMap;
import java.util.Map;

public class EventsListener implements Listener {

    private final VoxarioBridge plugin;

    public EventsListener(VoxarioBridge plugin) {
        this.plugin = plugin;
    }

    private Map<String, String> base(String action, Player p) {
        Map<String, String> b = new HashMap<>();
        b.put("action", action);
        if (p != null) {
            b.put("name", p.getName());
            b.put("uuid", p.getUniqueId().toString());
        }
        return b;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onChat(AsyncPlayerChatEvent e) {
        if (!plugin.eventEnabled("chat")) return;
        Map<String, String> b = base("chat", e.getPlayer());
        b.put("message", ChatColor.stripColor(e.getMessage()));
        plugin.send(b);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent e) {
        if (!plugin.eventEnabled("join")) return;
        plugin.send(base("join", e.getPlayer()));
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent e) {
        if (!plugin.eventEnabled("leave")) return;
        plugin.send(base("leave", e.getPlayer()));
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onDeath(PlayerDeathEvent e) {
        if (!plugin.eventEnabled("death")) return;
        Map<String, String> b = base("death", e.getEntity());
        String msg = e.getDeathMessage();
        b.put("message", msg == null ? e.getEntity().getName() + " zemrel" : ChatColor.stripColor(msg));
        plugin.send(b);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onAdvancement(PlayerAdvancementDoneEvent e) {
        if (!plugin.eventEnabled("achievement")) return;
        String key = e.getAdvancement().getKey().getKey();
        if (key.startsWith("recipes/")) return;
        Map<String, String> b = base("achievement", e.getPlayer());
        String pretty = key.contains("/") ? key.substring(key.lastIndexOf('/') + 1) : key;
        b.put("achievement", pretty.replace('_', ' '));
        plugin.send(b);
    }
}
