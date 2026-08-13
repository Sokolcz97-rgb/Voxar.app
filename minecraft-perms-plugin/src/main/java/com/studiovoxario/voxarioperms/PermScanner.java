package com.studiovoxario.voxarioperms;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Precte vsechny .jar v plugins/ a z kazdeho vytahne seznam permissions.
 * Zdroje: plugin.yml (permissions + children + command permission) a volitelne
 * hluboky sken retezcu v .class souborech (najde i nedeklarovane permise).
 */
public final class PermScanner {

    /** Jeden plugin a jeho permissions. */
    public static final class ScannedPlugin {
        public final String name;
        public String version = "";
        public final Map<String, String> perms = new LinkedHashMap<>(); // node -> popis

        ScannedPlugin(String name) { this.name = name; }

        public List<String> nodes() {
            List<String> l = new ArrayList<>(perms.keySet());
            l.sort(String.CASE_INSENSITIVE_ORDER);
            return l;
        }
    }

    private static final Pattern NODE = Pattern.compile("[a-zA-Z][a-zA-Z0-9_-]{2,}(?:\\.[a-zA-Z0-9_*-]+){1,6}");
    private static final Set<String> BAD_PREFIX = Set.of(
            "java", "javax", "sun", "com.google", "org.bukkit", "org.spigotmc", "io.papermc",
            "net.kyori", "org.yaml", "org.apache", "kotlin", "net.minecraft", "org.slf4j",
            "com.mojang", "org.jetbrains", "org.intellij", "META-INF", "http", "https", "www");

    private final VoxarioPerms plugin;

    public PermScanner(VoxarioPerms plugin) { this.plugin = plugin; }

    public List<ScannedPlugin> scan(boolean deep) {
        List<ScannedPlugin> out = new ArrayList<>();
        File dir = plugin.getDataFolder().getParentFile();
        File[] jars = dir.listFiles(f -> f.isFile() && f.getName().toLowerCase(Locale.ROOT).endsWith(".jar"));
        if (jars == null) return out;

        List<String> ignore = plugin.getConfig().getStringList("ignore-plugins");
        for (File jar : jars) {
            ScannedPlugin sp = read(jar, deep);
            if (sp == null) continue;
            if (ignore.contains(sp.name)) continue;
            out.add(sp);
        }
        out.sort(Comparator.comparing(a -> a.name.toLowerCase(Locale.ROOT)));
        return out;
    }

    private ScannedPlugin read(File jar, boolean deep) {
        try (ZipFile zf = new ZipFile(jar)) {
            ZipEntry ze = zf.getEntry("plugin.yml");
            if (ze == null) ze = zf.getEntry("paper-plugin.yml");
            if (ze == null) return null;
            YamlConfiguration y;
            try (var in = zf.getInputStream(ze)) {
                y = YamlConfiguration.loadConfiguration(new InputStreamReader(in, StandardCharsets.UTF_8));
            }
            String name = y.getString("name");
            if (name == null || name.isBlank()) return null;

            ScannedPlugin sp = new ScannedPlugin(name);
            sp.version = String.valueOf(y.get("version", ""));

            ConfigurationSection ps = y.getConfigurationSection("permissions");
            if (ps != null) collect(sp, ps, "");

            ConfigurationSection cs = y.getConfigurationSection("commands");
            if (cs != null) {
                for (String cmd : cs.getKeys(false)) {
                    String p = cs.getString(cmd + ".permission");
                    if (p != null && !p.isBlank()) sp.perms.putIfAbsent(p, "prikaz /" + cmd);
                }
            }

            if (deep) deepScan(zf, sp);
            return sp;
        } catch (Exception ex) {
            return null;
        }
    }

    private void collect(ScannedPlugin sp, ConfigurationSection sec, String parent) {
        for (String key : sec.getKeys(false)) {
            String node = parent.isEmpty() ? key : key;
            Object val = sec.get(key);
            String desc = "";
            if (val instanceof ConfigurationSection s) {
                desc = String.valueOf(s.getString("description", ""));
                sp.perms.putIfAbsent(node, desc);
                ConfigurationSection ch = s.getConfigurationSection("children");
                if (ch != null) {
                    for (String c : ch.getKeys(false)) sp.perms.putIfAbsent(c, "child of " + node);
                }
            } else if (val instanceof Map<?, ?> m) {
                Object d = m.get("description");
                sp.perms.putIfAbsent(node, d == null ? "" : String.valueOf(d));
                Object ch = m.get("children");
                if (ch instanceof Map<?, ?> cm) {
                    for (Object c : cm.keySet()) sp.perms.putIfAbsent(String.valueOf(c), "child of " + node);
                }
            } else {
                sp.perms.putIfAbsent(node, desc);
            }
        }
    }

    /** Najde permission-like retezce primo v bytecode (konstanty). */
    private void deepScan(ZipFile zf, ScannedPlugin sp) {
        String base = sp.name.toLowerCase(Locale.ROOT);
        Set<String> found = new LinkedHashSet<>();
        int scanned = 0;
        var it = zf.entries();
        while (it.hasMoreElements()) {
            ZipEntry e = it.nextElement();
            if (!e.getName().endsWith(".class")) continue;
            if (scanned++ > 4000) break;
            try (var in = zf.getInputStream(e)) {
                String s = new String(in.readAllBytes(), StandardCharsets.ISO_8859_1);
                Matcher m = NODE.matcher(s);
                while (m.find()) {
                    String node = m.group();
                    if (!accept(node, base)) continue;
                    found.add(node);
                    if (found.size() > 400) break;
                }
            } catch (Exception ignored) {}
            if (found.size() > 400) break;
        }
        for (String n : found) sp.perms.putIfAbsent(n, "detekovano ze zdrojoveho kodu");
    }

    private boolean accept(String node, String base) {
        String low = node.toLowerCase(Locale.ROOT);
        for (String b : BAD_PREFIX) if (low.startsWith(b.toLowerCase(Locale.ROOT) + ".")) return false;
        if (low.endsWith(".class") || low.endsWith(".java") || low.endsWith(".yml")
                || low.endsWith(".json") || low.endsWith(".png") || low.endsWith(".txt")) return false;
        if (low.contains("()") || low.contains("/")) return false;
        return low.startsWith(base + ".") || low.startsWith(base.replace("-", "") + ".");
    }
}
