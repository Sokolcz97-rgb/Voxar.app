package com.studiovoxario.voxariobridge;

import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitRunnable;

import java.io.OutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.function.Consumer;

/** Minimalisticky HTTP klient pro StudioVoxario bridge (bez externich zavislosti). */
public class BridgeClient {

    private final Plugin plugin;
    private final String url;
    private final String token;

    public BridgeClient(Plugin plugin, String url, String token) {
        this.plugin = plugin;
        this.url = url;
        this.token = token;
    }

    /** Odesle JSON asynchronne, vysledek (telo odpovedi nebo null) preda do callbacku na async vlakne. */
    public void postAsync(Map<String, String> body, Consumer<String> callback) {
        final String payload = Json.object(body);
        new BukkitRunnable() {
            @Override public void run() {
                String res = postSync(payload);
                if (callback != null) callback.accept(res);
            }
        }.runTaskAsynchronously(plugin);
    }

    public void postAsync(Map<String, String> body) {
        postAsync(body, null);
    }

    public String postSync(String payload) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(8000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("x-mc-token", token);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(payload.getBytes(StandardCharsets.UTF_8));
            }
            int code = conn.getResponseCode();
            InputStream is = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
            String text = read(is);
            if (code >= 400) {
                plugin.getLogger().warning("Bridge HTTP " + code + ": " + text);
                return null;
            }
            return text;
        } catch (Exception e) {
            plugin.getLogger().warning("Bridge chyba: " + e.getMessage());
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static String read(InputStream is) throws Exception {
        if (is == null) return "";
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        int n;
        while ((n = is.read(buf)) != -1) bos.write(buf, 0, n);
        return new String(bos.toByteArray(), StandardCharsets.UTF_8);
    }
}
