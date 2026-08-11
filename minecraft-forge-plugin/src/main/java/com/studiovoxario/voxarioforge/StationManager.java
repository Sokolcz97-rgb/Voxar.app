package com.studiovoxario.voxarioforge;

import org.bukkit.Material;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.inventory.ItemStack;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Nacita stanice z plugins/VoxarioForge/stations.yml.
 */
public final class StationManager {

    private final VoxarioForge plugin;
    private final Map<String, Station> stations = new LinkedHashMap<>();
    private final Map<Material, Station> byVanilla = new HashMap<>();

    public StationManager(VoxarioForge plugin) {
        this.plugin = plugin;
    }

    public Map<String, Station> stations() {
        return stations;
    }

    public Station get(String id) {
        return id == null ? null : stations.get(id.toLowerCase(Locale.ROOT));
    }

    public Station byVanilla(Material material) {
        return byVanilla.get(material);
    }

    public void reload() {
        stations.clear();
        byVanilla.clear();

        File file = new File(plugin.getDataFolder(), "stations.yml");
        if (!file.isFile()) plugin.saveResource("stations.yml", false);
        if (!file.isFile()) return;

        YamlConfiguration yml = YamlConfiguration.loadConfiguration(file);
        ConfigurationSection root = yml.getConfigurationSection("stations");
        if (root == null) return;

        for (String id : root.getKeys(false)) {
            ConfigurationSection s = root.getConfigurationSection(id);
            if (s == null) continue;

            String type = s.getString("type", "craft").toLowerCase(Locale.ROOT);
            Material icon = Material.matchMaterial(s.getString("icon", "CRAFTING_TABLE"));
            if (icon == null) icon = Material.CRAFTING_TABLE;
            Material vanilla = s.getString("vanilla") == null
                    ? null : Material.matchMaterial(s.getString("vanilla"));

            List<Station.Recipe> recipes = new ArrayList<>();
            List<Map<?, ?>> raw = s.getMapList("recipes");
            for (Map<?, ?> m : raw) {
                Station.Recipe r = parseRecipe(type, m);
                if (r != null) recipes.add(r);
            }

            Station station = new Station(id.toLowerCase(Locale.ROOT), type,
                    s.getString("title", "&b" + id), icon, vanilla, recipes);
            stations.put(station.id(), station);
            if (vanilla != null && plugin.getConfig().getBoolean("stations.replace-vanilla", true)) {
                byVanilla.put(vanilla, station);
            }
        }
        plugin.getLogger().info("Nacteno " + stations.size() + " stanic.");
    }

    @SuppressWarnings("unchecked")
    private Station.Recipe parseRecipe(String stationType, Map<?, ?> m) {
        try {
            List<String> shape = m.get("shape") instanceof List<?> l
                    ? l.stream().map(String::valueOf).toList() : List.of();

            Map<Character, String> ing = new HashMap<>();
            if (m.get("ingredients") instanceof Map<?, ?> im) {
                for (Map.Entry<?, ?> e : im.entrySet()) {
                    String k = String.valueOf(e.getKey());
                    if (!k.isEmpty()) ing.put(k.charAt(0), String.valueOf(e.getValue()));
                }
            }

            String result = m.get("result") == null ? null : String.valueOf(m.get("result"));
            if (result == null) return null;

            return new Station.Recipe(
                    stationType,
                    shape,
                    ing,
                    m.get("input") == null ? null : String.valueOf(m.get("input")),
                    m.get("material") == null ? null : String.valueOf(m.get("material")),
                    intOf(m.get("material-amount"), 1),
                    result,
                    intOf(m.get("amount"), 1),
                    intOf(m.get("cost"), 0)
            );
        } catch (Exception e) {
            plugin.getLogger().warning("Neplatny recept: " + e.getMessage());
            return null;
        }
    }

    private int intOf(Object o, int def) {
        if (o instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(o));
        } catch (Exception e) {
            return def;
        }
    }

    /** Prevede token ("vox:ruby_blade" nebo "IRON_INGOT") na ItemStack. */
    public ItemStack token(String token, int amount) {
        if (token == null || token.isBlank()) return null;
        if (token.toLowerCase(Locale.ROOT).startsWith("vox:")) {
            Construct c = plugin.registry().get(token.substring(4).toLowerCase(Locale.ROOT));
            return c == null ? null : plugin.registry().build(c, amount);
        }
        Material mat = Material.matchMaterial(token);
        return mat == null ? null : new ItemStack(mat, amount);
    }

    /** Odpovida stack tokenu? */
    public boolean matches(String token, ItemStack stack) {
        if (token == null || token.isBlank() || token.equals(" ")) return stack == null || stack.getType().isAir();
        if (stack == null || stack.getType().isAir()) return false;
        if (token.toLowerCase(Locale.ROOT).startsWith("vox:")) {
            Construct c = plugin.constructOf(stack);
            return c != null && c.id().equalsIgnoreCase(token.substring(4));
        }
        Material mat = Material.matchMaterial(token);
        return mat != null && stack.getType() == mat && plugin.constructOf(stack) == null;
    }
}
