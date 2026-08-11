package com.studiovoxario.voxarioforge;

import org.bukkit.Material;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Sprava zdrojovych slozek obsahu.
 *
 * plugins/VoxarioForge/
 *   sources/
 *     voxario/    (vlastni format)
 *     itemsadder/ (.iaentitymodel + ItemsAdder config)
 *     oraxen/     (Oraxen config)
 *     nexo/       (Nexo config)
 *       ├─ items/     .yml konfigurace itemu v danem formatu
 *       ├─ models/    .bbmodel / .iaentitymodel / .json modely
 *       ├─ textures/  .png textury
 *       ├─ gui/       GUI temata (gui.yml)
 *       └─ source.yml nastaveni zdroje
 *   imports/   sem hod ZIP -> automaticky se rozbali do zdroje
 *   output/    hotove resource packy
 */
public final class SourceManager {

    /** Jeden zdroj obsahu (plugin format). */
    public record Source(String id, String display, String format, Material icon,
                         boolean enabled, File dir) {

        public File items() {
            return new File(dir, "items");
        }

        public File models() {
            return new File(dir, "models");
        }

        public File textures() {
            return new File(dir, "textures");
        }

        public File gui() {
            return new File(dir, "gui");
        }
    }

    private static final Map<String, String[]> DEFAULTS = new LinkedHashMap<>();

    static {
        // id -> {display, format, icon}
        DEFAULTS.put("voxario", new String[]{"&b&lVoxario", "voxario", "NETHER_STAR"});
        DEFAULTS.put("itemsadder", new String[]{"&d&lItemsAdder", "itemsadder", "AMETHYST_SHARD"});
        DEFAULTS.put("oraxen", new String[]{"&6&lOraxen", "oraxen", "GOLD_INGOT"});
        DEFAULTS.put("nexo", new String[]{"&a&lNexo", "nexo", "EMERALD"});
    }

    private final VoxarioForge plugin;
    private final Map<String, Source> sources = new LinkedHashMap<>();

    public SourceManager(VoxarioForge plugin) {
        this.plugin = plugin;
    }

    public Map<String, Source> sources() {
        return sources;
    }

    public Source get(String id) {
        return id == null ? null : sources.get(id.toLowerCase(Locale.ROOT));
    }

    public List<Source> enabled() {
        List<Source> out = new ArrayList<>();
        for (Source s : sources.values()) if (s.enabled()) out.add(s);
        return out;
    }

    public File root() {
        return new File(plugin.getDataFolder(), "sources");
    }

    public File imports() {
        return new File(plugin.getDataFolder(), "imports");
    }

    public File output() {
        return new File(plugin.getDataFolder(), "output");
    }

    /** Vytvori celou strukturu slozek + defaultni configy, pokud chybi. */
    public void setup() {
        root().mkdirs();
        imports().mkdirs();
        output().mkdirs();

        for (Map.Entry<String, String[]> e : DEFAULTS.entrySet()) {
            File dir = new File(root(), e.getKey());
            boolean fresh = !dir.isDirectory();
            new File(dir, "items").mkdirs();
            new File(dir, "models").mkdirs();
            new File(dir, "textures").mkdirs();
            new File(dir, "gui").mkdirs();

            File cfg = new File(dir, "source.yml");
            if (!cfg.isFile()) writeSourceConfig(cfg, e.getKey(), e.getValue());

            File guiCfg = new File(dir, "gui/gui.yml");
            if (!guiCfg.isFile()) writeGuiConfig(guiCfg, e.getValue()[0]);

            File readme = new File(dir, "README.txt");
            if (!readme.isFile()) writeReadme(readme, e.getKey(), e.getValue()[1]);

            if (fresh && !"voxario".equals(e.getKey())) writeExampleItems(dir, e.getValue()[1]);
        }
        writeImportsReadme();
        reload();
    }

    public void reload() {
        sources.clear();
        File[] dirs = root().listFiles(File::isDirectory);
        if (dirs == null) return;
        for (File dir : dirs) {
            File cfg = new File(dir, "source.yml");
            YamlConfiguration yml = cfg.isFile() ? YamlConfiguration.loadConfiguration(cfg)
                    : new YamlConfiguration();
            String id = dir.getName().toLowerCase(Locale.ROOT);
            String[] def = DEFAULTS.getOrDefault(id, new String[]{"&f" + id, "voxario", "CHEST"});
            Material icon = Material.matchMaterial(yml.getString("icon", def[2]));
            sources.put(id, new Source(
                    id,
                    yml.getString("display", def[0]),
                    yml.getString("format", def[1]).toLowerCase(Locale.ROOT),
                    icon == null ? Material.CHEST : icon,
                    yml.getBoolean("enabled", true),
                    dir
            ));
        }
    }

    private void writeSourceConfig(File file, String id, String[] def) {
        write(file, """
                # Zdroj obsahu: %s
                # format: voxario | itemsadder | oraxen | nexo
                enabled: true
                display: "%s"
                format: "%s"
                icon: "%s"
                # Automaticky prestavet pack pri zmene souboru v teto slozce
                auto-build: true
                """.formatted(id, def[0], def[1], def[2]));
    }

    private void writeGuiConfig(File file, String display) {
        write(file, """
                # RPG tema GUI pro tento zdroj
                title: "%s &8| &7Forge"
                rows: 6
                # ramecek okolo obsahu
                frame:
                  enabled: true
                  material: "BLACK_STAINED_GLASS_PANE"
                  name: "&8|"
                # ikony ovladani
                buttons:
                  back: "ARROW"
                  next: "ARROW"
                  info: "NETHER_STAR"
                  build: "ANVIL"
                  reload: "BOOK"
                  home: "COMPASS"
                """.formatted(display));
    }

    private void writeReadme(File file, String id, String format) {
        String hint = switch (format) {
            case "itemsadder" -> """
                    - items/    : ItemsAdder konfigurace (info: / items: ...)
                    - models/   : .iaentitymodel nebo .bbmodel soubory
                    - textures/ : .png textury (nazev = nazev modelu, napr. ruby_sword.png)
                    """;
            case "oraxen" -> """
                    - items/    : Oraxen konfigurace (<id>: displayname/material/Pack.model)
                    - models/   : .json nebo .bbmodel modely
                    - textures/ : .png textury
                    """;
            case "nexo" -> """
                    - items/    : Nexo konfigurace (stejny format jako Oraxen)
                    - models/   : .json nebo .bbmodel modely
                    - textures/ : .png textury
                    """;
            default -> """
                    - items/    : vlastni format (constructs: ...)
                    - models/   : .bbmodel / .iaentitymodel modely
                    - textures/ : .png textury
                    """;
        };
        write(file, """
                VoxarioForge - zdroj '%s' (format %s)

                %s
                - gui/gui.yml : vzhled GUI pro tento zdroj
                - source.yml  : zapnuti/vypnuti zdroje

                Po pridani souboru staci pockat (auto-build) nebo pouzit /voxforge pack.
                """.formatted(id, format, hint));
    }

    private void writeExampleItems(File dir, String format) {
        File file = new File(dir, "items/example.yml.disabled");
        String content = switch (format) {
            case "itemsadder" -> """
                    info:
                      namespace: example
                    items:
                      ruby_sword:
                        display_name: "&cRuby Sword"
                        resource:
                          material: DIAMOND_SWORD
                          model_path: "item/ruby_sword"
                        durability:
                          max_custom_durability: 500
                    """;
            default -> """
                    ruby_sword:
                      displayname: "&cRuby Sword"
                      material: DIAMOND_SWORD
                      Pack:
                        model: item/ruby_sword
                      Mechanics:
                        durability:
                          value: 500
                    """;
        };
        write(file, content);
    }

    private void writeImportsReadme() {
        File file = new File(imports(), "README.txt");
        if (file.isFile()) return;
        write(file, """
                Sem nahraj ZIP z Oraxenu / ItemsAdderu / Nexa nebo vlastni.

                Pojmenovani ZIPu urcuje cilovou slozku:
                  itemsadder-mujpack.zip -> sources/itemsadder/
                  oraxen-xxx.zip         -> sources/oraxen/
                  nexo-xxx.zip           -> sources/nexo/
                  cokoliv jineho         -> sources/voxario/

                ZIP se automaticky rozbali (modely do models/, textury do textures/,
                configy do items/) a pak se prestavi resource pack.
                Zpracovane ZIPy se presunou do imports/done/.
                """);
    }

    private void write(File file, String content) {
        try {
            File parent = file.getParentFile();
            if (parent != null) parent.mkdirs();
            Files.writeString(file.toPath(), content, StandardCharsets.UTF_8);
        } catch (Exception e) {
            plugin.getLogger().warning("Nelze zapsat " + file.getName() + ": " + e.getMessage());
        }
    }
}
