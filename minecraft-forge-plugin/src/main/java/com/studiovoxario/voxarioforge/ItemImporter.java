package com.studiovoxario.voxarioforge;

import org.bukkit.Material;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Prevadi konfigurace itemu z ruznych pluginu (ItemsAdder / Oraxen / Nexo)
 * do interniho formatu Construct.
 */
public final class ItemImporter {

    private ItemImporter() {
    }

    public static List<Construct> parse(SourceManager.Source source, File file) {
        YamlConfiguration yml = YamlConfiguration.loadConfiguration(file);
        return switch (source.format()) {
            case "itemsadder" -> parseItemsAdder(source, yml);
            case "oraxen", "nexo" -> parseOraxen(source, yml);
            default -> parseVoxario(source, yml);
        };
    }

    // ---------------------------------------------------------------- voxario

    private static List<Construct> parseVoxario(SourceManager.Source source, YamlConfiguration yml) {
        List<Construct> out = new ArrayList<>();
        ConfigurationSection root = yml.getConfigurationSection("constructs");
        if (root == null) return out;
        for (String id : root.getKeys(false)) {
            ConfigurationSection s = root.getConfigurationSection(id);
            if (s == null) continue;
            Material mat = material(s.getString("material", "PAPER"));
            if (mat == null) continue;

            Map<String, Double> attrs = new HashMap<>();
            ConfigurationSection as = s.getConfigurationSection("attributes");
            if (as != null) for (String k : as.getKeys(false)) attrs.put(k, as.getDouble(k));

            Map<String, Integer> ench = new HashMap<>();
            ConfigurationSection es = s.getConfigurationSection("enchants");
            if (es != null) for (String k : es.getKeys(false)) ench.put(k, es.getInt(k));

            List<Double> hb = s.getDoubleList("fixture-hitbox");
            float w = !hb.isEmpty() ? hb.get(0).floatValue() : 1.0f;
            float h = hb.size() > 1 ? hb.get(1).floatValue() : 1.0f;

            out.add(new Construct(
                    source.id(), id.toLowerCase(Locale.ROOT), s.getString("display", id), mat,
                    s.getString("blueprint"), s.getString("category", "misc"), s.getStringList("lore"),
                    s.getBoolean("unbreakable", false), s.getBoolean("hide-flags", false),
                    s.getBoolean("fixture", false), (float) s.getDouble("fixture-scale", 1.0),
                    w, h, attrs, ench,
                    textureMap(s, "textures"),
                    s.getString("texture-path", s.getString("texture_path", ""))));

        }
        return out;
    }

    // ------------------------------------------------------------ itemsadder

    private static List<Construct> parseItemsAdder(SourceManager.Source source, YamlConfiguration yml) {
        List<Construct> out = new ArrayList<>();
        ConfigurationSection items = yml.getConfigurationSection("items");
        if (items == null) items = yml.getConfigurationSection("blocks");
        if (items == null) return out;

        for (String id : items.getKeys(false)) {
            ConfigurationSection s = items.getConfigurationSection(id);
            if (s == null) continue;
            ConfigurationSection res = s.getConfigurationSection("resource");

            String matName = s.getString("material",
                    res != null ? res.getString("material", "PAPER") : "PAPER");
            Material mat = material(matName);
            if (mat == null) mat = Material.PAPER;

            String model = null;
            Map<String, String> tex = new LinkedHashMap<>();
            String texPath = "";
            if (res != null) {
                model = res.getString("model_path");
                tex = textureMap(res, "textures");
                if (tex.isEmpty()) tex = textureMap(res, "texture");
                texPath = res.getString("texture_path", res.getString("textures_path", ""));
                if (model == null && !tex.isEmpty()) model = tex.values().iterator().next();
            }

            out.add(new Construct(
                    source.id(), id.toLowerCase(Locale.ROOT),
                    s.getString("display_name", s.getString("displayname", id)),
                    mat, lastSegment(model),
                    s.getString("category", section(s, "specific_properties") ? "blocks" : "misc"),
                    s.getStringList("lore"),
                    s.getBoolean("unbreakable", false), true,
                    s.getBoolean("fixture", false), 1.0f, 1.0f, 1.0f,
                    new HashMap<>(), new HashMap<>(), tex, texPath));
        }
        return out;
    }


    private static boolean section(ConfigurationSection s, String key) {
        return s.getConfigurationSection(key) != null;
    }

    // ----------------------------------------------------------- oraxen/nexo

    private static List<Construct> parseOraxen(SourceManager.Source source, YamlConfiguration yml) {
        List<Construct> out = new ArrayList<>();
        for (String id : yml.getKeys(false)) {
            ConfigurationSection s = yml.getConfigurationSection(id);
            if (s == null) continue;
            if (!s.contains("material") && s.getConfigurationSection("Pack") == null) continue;

            Material mat = material(s.getString("material", "PAPER"));
            if (mat == null) mat = Material.PAPER;

            ConfigurationSection pack = s.getConfigurationSection("Pack");
            String model = pack != null ? pack.getString("model", pack.getString("parent_model")) : null;
            Map<String, String> tex = pack != null ? textureMap(pack, "textures") : new LinkedHashMap<>();
            if (pack != null && tex.isEmpty()) tex = textureMap(pack, "texture");
            String texPath = pack != null ? pack.getString("texture_path", "") : "";
            if (model == null && !tex.isEmpty()) model = tex.values().iterator().next();

            Map<String, Integer> ench = new HashMap<>();
            ConfigurationSection es = s.getConfigurationSection("Enchantments");
            if (es != null) for (String k : es.getKeys(false)) ench.put(k, es.getInt(k));

            Map<String, Double> attrs = new HashMap<>();

            out.add(new Construct(
                    source.id(), id.toLowerCase(Locale.ROOT),
                    s.getString("displayname", s.getString("itemname", id)),
                    mat, lastSegment(model),
                    s.getString("category", "misc"), s.getStringList("lore"),
                    s.getBoolean("unbreakable", false), s.getBoolean("injectId", false),
                    false, 1.0f, 1.0f, 1.0f, attrs, ench, tex, texPath));
        }
        return out;
    }

    // ---------------------------------------------------------------- helper

    /**
     * Nacte mapovani textur. Podporuje:
     *   textures: {0: "a/b", 1: "c", particle: "a/b"}
     *   textures: ["a/b", "c"]   -> sloty 0, 1
     *   textures: "a/b"          -> slot 0
     */
    static Map<String, String> textureMap(ConfigurationSection s, String key) {
        Map<String, String> out = new LinkedHashMap<>();
        if (s == null || !s.contains(key)) return out;
        ConfigurationSection sec = s.getConfigurationSection(key);
        if (sec != null) {
            for (String k : sec.getKeys(false)) {
                String v = sec.getString(k);
                if (v != null && !v.isBlank()) out.put(k.toLowerCase(Locale.ROOT), v);
            }
            return out;
        }
        Object raw = s.get(key);
        if (raw instanceof List<?> list) {
            for (int i = 0; i < list.size(); i++) {
                Object v = list.get(i);
                if (v != null) out.put(String.valueOf(i), String.valueOf(v));
            }
        } else if (raw instanceof String str && !str.isBlank()) {
            out.put("0", str);
        }
        return out;
    }

    private static String lastSegment(String path) {
        if (path == null || path.isBlank()) return null;
        String p = path.replace('\\', '/');
        int slash = p.lastIndexOf('/');
        if (slash >= 0) p = p.substring(slash + 1);
        int dot = p.lastIndexOf('.');
        if (dot > 0) p = p.substring(0, dot);
        return p.toLowerCase(Locale.ROOT);
    }


    private static Material material(String name) {
        if (name == null) return null;
        return Material.matchMaterial(name.toUpperCase(Locale.ROOT));
    }
}
