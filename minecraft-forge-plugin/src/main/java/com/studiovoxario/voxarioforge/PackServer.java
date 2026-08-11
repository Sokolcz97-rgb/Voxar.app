package com.studiovoxario.voxarioforge;

import com.sun.net.httpserver.HttpServer;

import java.io.File;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.file.Files;

/**
 * Male vestavene HTTP hostovani resource packu, aby si ho klienti stahli automaticky.
 */
public final class PackServer {

    private final VoxarioForge plugin;
    private HttpServer server;

    public PackServer(VoxarioForge plugin) {
        this.plugin = plugin;
    }

    public boolean running() {
        return server != null;
    }

    public void start() {
        if (!plugin.getConfig().getBoolean("pack.http.enabled", false)) return;
        int port = plugin.getConfig().getInt("pack.http.port", 8123);
        try {
            server = HttpServer.create(new InetSocketAddress(port), 0);
            server.createContext("/pack.zip", exchange -> {
                File file = new File(plugin.getDataFolder(),
                        plugin.getConfig().getString("pack.file-name", "VoxarioForge-Pack.zip"));
                if (!file.isFile()) {
                    exchange.sendResponseHeaders(404, -1);
                    exchange.close();
                    return;
                }
                byte[] data = Files.readAllBytes(file.toPath());
                exchange.getResponseHeaders().add("Content-Type", "application/zip");
                exchange.sendResponseHeaders(200, data.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(data);
                }
            });
            server.setExecutor(null);
            server.start();
            plugin.getLogger().info("Pack server bezi na portu " + port + " (/pack.zip).");
        } catch (Exception e) {
            server = null;
            plugin.getLogger().warning("Pack server se nepodarilo spustit: " + e.getMessage());
        }
    }

    /** Zkusi zjistit verejnou adresu serveru (server.properties -> lokalni IP). */
    private String detectHost() {
        try {
            String ip = org.bukkit.Bukkit.getIp();
            if (ip != null && !ip.isBlank() && !ip.equals("0.0.0.0")) return ip;
        } catch (Exception ignored) {
        }
        try {
            return java.net.InetAddress.getLocalHost().getHostAddress();
        } catch (Exception ignored) {
        }
        return "";
    }

    public void stop() {
        if (server != null) {
            server.stop(0);
            server = null;
        }
    }

    /** Verejna URL packu podle konfigurace. */
    public String publicUrl() {
        String configured = plugin.getConfig().getString("pack.url", "");
        if (configured != null && !configured.isBlank()) return configured;
        if (!plugin.getConfig().getBoolean("pack.http.enabled", false)) return "";
        String host = plugin.getConfig().getString("pack.http.public-host", "");
        if (host == null || host.isBlank()) host = detectHost();
        if (host == null || host.isBlank()) return "";
        int port = plugin.getConfig().getInt("pack.http.port", 8123);
        String base = host.startsWith("http") ? host : "http://" + host + ":" + port;
        return base.endsWith("/") ? base + "pack.zip" : base + "/pack.zip";
    }
}
