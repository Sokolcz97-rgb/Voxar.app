package com.studiovoxario.voxarioforge;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.HexFormat;
import java.util.Properties;
import java.util.stream.Stream;

/**
 * MySQL synchronizace obsahu a resource packu mezi vice servery.
 *
 * Tabulky:
 *  - voxforge_files : soubory packu (items.yml, blueprints, stations.yml)
 *  - voxforge_pack  : hotovy resource pack ZIP + sha1 + url
 */
public final class MySqlSync {

    private final VoxarioForge plugin;
    private boolean enabled;
    private String url;
    private Properties props;
    private long lastSeen;

    public MySqlSync(VoxarioForge plugin) {
        this.plugin = plugin;
    }

    public boolean enabled() {
        return enabled;
    }

    public void init() {
        this.enabled = plugin.getConfig().getBoolean("mysql.enabled", false);
        if (!enabled) return;

        String host = plugin.getConfig().getString("mysql.host", "127.0.0.1");
        int port = plugin.getConfig().getInt("mysql.port", 3306);
        String db = plugin.getConfig().getString("mysql.database", "voxarioforge");
        String extra = plugin.getConfig().getString("mysql.params",
                "useSSL=false&allowPublicKeyRetrieval=true&characterEncoding=utf8&serverTimezone=UTC");
        this.url = "jdbc:mysql://" + host + ":" + port + "/" + db + "?" + extra;

        this.props = new Properties();
        props.setProperty("user", plugin.getConfig().getString("mysql.user", "root"));
        props.setProperty("password", plugin.getConfig().getString("mysql.password", ""));

        try (Connection conn = connect(); Statement st = conn.createStatement()) {
            st.executeUpdate("""
                    CREATE TABLE IF NOT EXISTS voxforge_files (
                      path VARCHAR(191) NOT NULL PRIMARY KEY,
                      content LONGBLOB NOT NULL,
                      sha1 VARCHAR(64) NOT NULL,
                      updated BIGINT NOT NULL
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""");
            st.executeUpdate("""
                    CREATE TABLE IF NOT EXISTS voxforge_pack (
                      id INT NOT NULL PRIMARY KEY,
                      sha1 VARCHAR(64) NOT NULL,
                      url VARCHAR(512) NULL,
                      data LONGBLOB NULL,
                      updated BIGINT NOT NULL
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""");
            plugin.getLogger().info("MySQL pripojeno (" + host + ":" + port + "/" + db + ").");
        } catch (Exception e) {
            enabled = false;
            plugin.getLogger().warning("MySQL nedostupne, sync vypnut: " + e.getMessage());
        }
    }

    private Connection connect() throws Exception {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
        } catch (ClassNotFoundException ignored) {
            // driver muze byt registrovan servisou
        }
        return DriverManager.getConnection(url, props);
    }

    /** Nahraje lokalni obsah (packs/, stations.yml) do databaze. */
    public int push() throws Exception {
        int count = 0;
        try (Connection conn = connect();
             PreparedStatement ps = conn.prepareStatement("""
                     INSERT INTO voxforge_files(path, content, sha1, updated)
                     VALUES(?,?,?,?)
                     ON DUPLICATE KEY UPDATE content=VALUES(content), sha1=VALUES(sha1), updated=VALUES(updated)""")) {
            for (Path p : localFiles()) {
                byte[] data = Files.readAllBytes(p);
                String rel = relative(p);
                ps.setString(1, rel);
                ps.setBytes(2, data);
                ps.setString(3, sha1(data));
                ps.setLong(4, System.currentTimeMillis());
                ps.addBatch();
                count++;
            }
            ps.executeBatch();
        }
        lastSeen = System.currentTimeMillis();
        return count;
    }

    /** Stahne obsah z databaze na disk. Vraci pocet zmenenych souboru. */
    public int pull() throws Exception {
        int changed = 0;
        try (Connection conn = connect();
             PreparedStatement ps = conn.prepareStatement("SELECT path, content, sha1, updated FROM voxforge_files");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                String rel = rs.getString("path");
                if (rel.contains("..")) continue;
                byte[] data = rs.getBytes("content");
                long updated = rs.getLong("updated");
                lastSeen = Math.max(lastSeen, updated);

                File target = new File(plugin.getDataFolder(), rel);
                if (target.isFile() && sha1(Files.readAllBytes(target.toPath())).equals(rs.getString("sha1"))) continue;

                File parent = target.getParentFile();
                if (parent != null) parent.mkdirs();
                try (FileOutputStream fos = new FileOutputStream(target)) {
                    fos.write(data);
                }
                changed++;
            }
        }
        return changed;
    }

    /** Ulozi hotovy pack (ZIP + sha1 + url) do databaze. */
    public void publishPack(File zip, String sha1, String packUrl) throws Exception {
        byte[] data = Files.readAllBytes(zip.toPath());
        boolean storeBlob = plugin.getConfig().getBoolean("mysql.store-pack-blob", true);
        try (Connection conn = connect();
             PreparedStatement ps = conn.prepareStatement("""
                     INSERT INTO voxforge_pack(id, sha1, url, data, updated)
                     VALUES(1,?,?,?,?)
                     ON DUPLICATE KEY UPDATE sha1=VALUES(sha1), url=VALUES(url), data=VALUES(data), updated=VALUES(updated)""")) {
            ps.setString(1, sha1);
            ps.setString(2, packUrl);
            if (storeBlob) ps.setBytes(3, data);
            else ps.setNull(3, java.sql.Types.BLOB);
            ps.setLong(4, System.currentTimeMillis());
            ps.executeUpdate();
        }
    }

    /** Stahne pack z databaze na disk (pokud je v DB novejsi). Vraci sha1 nebo null. */
    public String fetchPack(File target) throws Exception {
        try (Connection conn = connect();
             PreparedStatement ps = conn.prepareStatement("SELECT sha1, data FROM voxforge_pack WHERE id=1");
             ResultSet rs = ps.executeQuery()) {
            if (!rs.next()) return null;
            byte[] data = rs.getBytes("data");
            if (data == null) return rs.getString("sha1");
            if (target.isFile() && sha1(Files.readAllBytes(target.toPath())).equals(rs.getString("sha1"))) {
                return rs.getString("sha1");
            }
            File parent = target.getParentFile();
            if (parent != null) parent.mkdirs();
            try (FileOutputStream fos = new FileOutputStream(target)) {
                fos.write(data);
            }
            return rs.getString("sha1");
        }
    }

    /** Je v databazi novejsi obsah, nez jaky jsme naposledy videli? */
    public boolean hasRemoteChanges() {
        if (!enabled) return false;
        try (Connection conn = connect();
             PreparedStatement ps = conn.prepareStatement("SELECT MAX(updated) AS m FROM voxforge_files");
             ResultSet rs = ps.executeQuery()) {
            if (rs.next()) {
                long max = rs.getLong("m");
                if (max > lastSeen) {
                    lastSeen = max;
                    return true;
                }
            }
        } catch (Exception e) {
            plugin.getLogger().warning("MySQL kontrola zmen selhala: " + e.getMessage());
        }
        return false;
    }

    private java.util.List<Path> localFiles() throws Exception {
        java.util.List<Path> out = new java.util.ArrayList<>();
        Path root = plugin.getDataFolder().toPath();
        Path packs = root.resolve("packs");
        if (Files.isDirectory(packs)) {
            try (Stream<Path> stream = Files.walk(packs)) {
                stream.filter(Files::isRegularFile).forEach(out::add);
            }
        }
        Path stations = root.resolve("stations.yml");
        if (Files.isRegularFile(stations)) out.add(stations);
        return out;
    }

    private String relative(Path p) {
        return plugin.getDataFolder().toPath().relativize(p).toString().replace('\\', '/');
    }

    private String sha1(byte[] data) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-1");
        return HexFormat.of().formatHex(md.digest(data));
    }

    @SuppressWarnings("unused")
    private static byte[] utf8(String s) {
        return s.getBytes(StandardCharsets.UTF_8);
    }
}
