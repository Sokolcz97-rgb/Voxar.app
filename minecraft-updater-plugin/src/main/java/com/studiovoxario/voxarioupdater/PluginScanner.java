package com.studiovoxario.voxarioupdater;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Projde plugins/ a z kazdeho jaru zjisti nazev, verzi a zdroj aktualizaci.
 * Zdroj hleda v: overrides v configu -> plugin.yml (website/url) -> config pluginu -> nazev souboru.
 */
public final class PluginScanner {

    private static final Pattern P_GITHUB = Pattern.compile("github\\.com/([\\w.-]+/[\\w.-]+)");
    private static final Pattern P_SPIGOT = Pattern.compile("spigotmc\\.org/resources/(?:[\\w%.-]*\\.)?(\\d+)");
    private static final Pattern P_MODRINTH = Pattern.compile("modrinth\\.com/(?:plugin|mod|project)/([\\w-]+)");
    private static final Pattern P_HANGAR = Pattern.compile("hangar\\.papermc\\.io/([\\w-]+/[\\w-]+)");
    private static final Pattern P_POLYMART = Pattern.compile("polymart\\.org/resource/(?:[\\w%.-]*\\.)?(\\d+)");
    private static final Pattern P_BBB = Pattern.compile("builtbybit\\.com/resources/(?:[\\w%.-]*\\.)?(\\d+)");
    private static final Pattern P_MCMARKET = Pattern.compile("mc-market\\.org/resources/(?:[\\w%.-]*\\.)?(\\d+)");

    private final VoxarioUpdater plugin;

    public PluginScanner(VoxarioUpdater plugin) { this.plugin = plugin; }

    public List<PluginEntry> scan() {
        List<PluginEntry> out = new ArrayList<>();
        File dir = plugin.getDataFolder().getParentFile();
        File[] jars = dir.listFiles(f -> f.isFile() && f.getName().toLowerCase(Locale.ROOT).endsWith(".jar"));
        if (jars == null) return out;

        List<String> ignore = plugin.getConfig().getStringList("ignore");
        for (File jar : jars) {
            PluginEntry e = read(jar);
            if (e == null) continue;
            if (ignore.contains(e.name)) continue;
            detect(e);
            out.add(e);
        }
        out.sort((a, b) -> a.name.compareToIgnoreCase(b.name));
        return out;
    }

    private PluginEntry read(File jar) {
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
            PluginEntry e = new PluginEntry(name, String.valueOf(y.get("version", "0")), jar);
            e.website = y.getString("website", "");
            Object authors = y.get("authors");
            e.author = authors != null ? String.valueOf(authors) : y.getString("author", "");
            return e;
        } catch (Exception ex) {
            return null;
        }
    }

    private void detect(PluginEntry e) {
        // 1) rucni override
        ConfigurationSection ov = plugin.getConfig().getConfigurationSection("overrides");
        if (ov != null && ov.isConfigurationSection(e.name)) {
            ConfigurationSection s = ov.getConfigurationSection(e.name);
            e.provider = String.valueOf(s.getString("provider", "unknown")).toLowerCase(Locale.ROOT);
            e.resourceId = String.valueOf(s.get("id", ""));
            e.detectedFrom = "config overrides";
            return;
        }

        // 2) website z plugin.yml
        if (match(e, e.website, "plugin.yml website")) return;

        // 3) cely text plugin.yml + description
        String raw = rawEntry(e.jar, "plugin.yml");
        if (raw == null) raw = rawEntry(e.jar, "paper-plugin.yml");
        if (match(e, raw, "plugin.yml")) return;

        // 4) config daneho pluginu
        File cfg = new File(plugin.getDataFolder().getParentFile(), e.name + "/config.yml");
        if (cfg.isFile()) {
            try {
                String txt = Files.readString(cfg.toPath(), StandardCharsets.UTF_8);
                if (match(e, txt, "config.yml pluginu")) return;
            } catch (Exception ignored) {}
        }

        e.provider = "unknown";
        e.detectedFrom = "nenalezeno";
    }

    private String rawEntry(File jar, String name) {
        try (ZipFile zf = new ZipFile(jar)) {
            ZipEntry ze = zf.getEntry(name);
            if (ze == null) return null;
            try (var in = zf.getInputStream(ze)) {
                return new String(in.readAllBytes(), StandardCharsets.UTF_8);
            }
        } catch (Exception ex) {
            return null;
        }
    }

    private boolean match(PluginEntry e, String text, String from) {
        if (text == null || text.isBlank()) return false;
        if (set(e, P_GITHUB, text, "github", from)) return true;
        if (set(e, P_MODRINTH, text, "modrinth", from)) return true;
        if (set(e, P_HANGAR, text, "hangar", from)) return true;
        if (set(e, P_POLYMART, text, "polymart", from)) return true;
        if (set(e, P_BBB, text, "builtbybit", from)) return true;
        if (set(e, P_MCMARKET, text, "builtbybit", from)) return true;
        return set(e, P_SPIGOT, text, "spigot", from);
    }

    private boolean set(PluginEntry e, Pattern p, String text, String provider, String from) {
        Matcher m = p.matcher(text);
        if (!m.find()) return false;
        e.provider = provider;
        e.resourceId = m.group(1).replaceAll("\\.git$", "");
        e.detectedFrom = from;
        if (e.website == null || e.website.isBlank()) e.website = m.group(0);
        return true;
    }
}
