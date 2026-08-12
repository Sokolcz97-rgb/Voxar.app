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
 *     voxario/ itemsadder/ oraxen/ nexo/
 *       ├─ items/     .yml konfigurace itemu v danem formatu
 *       ├─ models/    .bbmodel / .iaentitymodel / .json modely
 *       ├─ textures/  .png textury (klidne ve podslozkach)
 *       ├─ gui/       GUI temata (gui.yml)
 *       └─ source.yml nastaveni zdroje vcetne cest (paths:)
 *   imports/   sem hod ZIP -> automaticky se rozbali do zdroje
 *   output/    hotove resource packy
 *   GUIDE/     navody a ukazkove configy
 */
public final class SourceManager {

    /** Jeden zdroj obsahu (plugin format). */
    public record Source(String id, String display, String format, Material icon,
                         boolean enabled, File dir,
                         String itemsPath, String modelsPath, List<String> texturePaths,
                         String guiPath, String packTextureFolder) {

        private File resolve(String path) {
            if (path == null || path.isBlank()) return dir;
            File abs = new File(path);
            return abs.isAbsolute() ? abs : new File(dir, path);
        }

        public File items() {
            return resolve(itemsPath);
        }

        public File models() {
            return resolve(modelsPath);
        }

        /** Hlavni slozka textur. */
        public File textures() {
            return textureDirs().get(0);
        }

        /** Vsechny slozky, ve kterych se hledaji textury. */
        public List<File> textureDirs() {
            List<File> out = new ArrayList<>();
            for (String p : texturePaths) out.add(resolve(p));
            if (out.isEmpty()) out.add(resolve("textures"));
            return out;
        }

        public File gui() {
            return resolve(guiPath);
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
            else upgradeSourceConfig(cfg);

            File guiCfg = new File(dir, "gui/gui.yml");
            if (!guiCfg.isFile()) writeGuiConfig(guiCfg, e.getValue()[0]);

            File readme = new File(dir, "README.txt");
            writeReadme(readme, e.getKey(), e.getValue()[1]);

            // ukazkove configy (vzdy prepsat, jsou jen ke cteni jako navod)
            Examples.writeSourceExamples(dir, e.getValue()[1]);

            if (fresh && !"voxario".equals(e.getKey())) writeExampleItems(dir, e.getValue()[1]);
        }
        writeImportsReadme();
        Examples.writeGuide(plugin.getDataFolder());
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

            List<String> texPaths = new ArrayList<>();
            if (yml.isList("paths.textures")) texPaths.addAll(yml.getStringList("paths.textures"));
            else texPaths.add(yml.getString("paths.textures", "textures"));
            texPaths.addAll(yml.getStringList("paths.extra-textures"));
            texPaths.removeIf(p -> p == null || p.isBlank());
            if (texPaths.isEmpty()) texPaths.add("textures");

            sources.put(id, new Source(
                    id,
                    yml.getString("display", def[0]),
                    yml.getString("format", def[1]).toLowerCase(Locale.ROOT),
                    icon == null ? Material.CHEST : icon,
                    yml.getBoolean("enabled", true),
                    dir,
                    yml.getString("paths.items", "items"),
                    yml.getString("paths.models", "models"),
                    texPaths,
                    yml.getString("paths.gui", "gui"),
                    yml.getString("pack.texture-folder", "item/" + id)
            ));
        }
    }

    private void writeSourceConfig(File file, String id, String[] def) {
        write(file, """
                # ==========================================================
                #  Zdroj obsahu: %s
                #  format: voxario | itemsadder | oraxen | nexo
                # ==========================================================
                enabled: true
                display: "%s"
                format: "%s"
                icon: "%s"

                # Automaticky prestavet pack pri zmene souboru v teto slozce
                auto-build: true

                # Cesty ke slozkam (relativni k teto slozce, nebo absolutni cesta na disku).
                # Muzes si je prejmenovat nebo ukazat na slozku jineho pluginu.
                paths:
                  items: "items"
                  models: "models"
                  # textures muze byt jeden retezec NEBO seznam slozek
                  textures:
                    - "textures"
                    - "textures/blocks"
                    - "textures/gui"
                  # dalsi slozky navic (napr. sdilene textury mimo tento zdroj)
                  extra-textures: []
                  gui: "gui"

                pack:
                  # kam se textury tohoto zdroje ulozi v resource packu:
                  # assets/<namespace>/textures/<texture-folder>/<nazev>.png
                  texture-folder: "item/%s"
                """.formatted(id, def[0], def[1], def[2], id));
    }

    /** Doplni chybejici klice (paths / pack) do existujiciho source.yml. */
    private void upgradeSourceConfig(File file) {
        try {
            String raw = Files.readString(file.toPath(), StandardCharsets.UTF_8);
            if (raw.contains("paths:")) return;
            String id = file.getParentFile().getName().toLowerCase(Locale.ROOT);
            raw += """

                    # --- pridano automaticky (v1.3.0) ---
                    paths:
                      items: "items"
                      models: "models"
                      textures:
                        - "textures"
                      extra-textures: []
                      gui: "gui"

                    pack:
                      texture-folder: "item/%s"
                    """.formatted(id);
            Files.writeString(file.toPath(), raw, StandardCharsets.UTF_8);
        } catch (Exception ignored) {
        }
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
                    - textures/ : .png textury (i ve podslozkach)
                    """;
            case "oraxen" -> """
                    - items/    : Oraxen konfigurace (<id>: displayname/material/Pack.model)
                    - models/   : .json nebo .bbmodel modely
                    - textures/ : .png textury (i ve podslozkach)
                    """;
            case "nexo" -> """
                    - items/    : Nexo konfigurace (stejny format jako Oraxen)
                    - models/   : .json nebo .bbmodel modely
                    - textures/ : .png textury (i ve podslozkach)
                    """;
            default -> """
                    - items/    : vlastni format (constructs: ...)
                    - models/   : .bbmodel / .iaentitymodel modely
                    - textures/ : .png textury (i ve podslozkach)
                    """;
        };
        write(file, """
                VoxarioForge - zdroj '%s' (format %s)

                %s
                - gui/gui.yml : vzhled GUI pro tento zdroj
                - source.yml  : zapnuti/vypnuti zdroje + cesty (paths:) a pack.texture-folder

                VICE TEXTUR NA JEDEN MODEL
                --------------------------
                Blockbench model muze mit vic texturovych slotu (0, 1, 2 ...).
                V configu itemu staci napsat:

                  textures:
                    0: "sword/blade"     # -> textures/sword/blade.png
                    1: "sword/hilt"
                    particle: "sword/blade"

                Cestu lze zadat relativne ke slozce textur, nebo pouzit
                'texture-path: "sword"' a pak jen nazvy souboru.

                Ukazky najdes v souborech EXAMPLE-*.yml v teto slozce
                a kompletni navod v plugins/VoxarioForge/GUIDE/.

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
                          # vice textur -> sloty 0,1 modelu
                          textures:
                            - "sword/blade"
                            - "sword/hilt"
                        durability:
                          max_custom_durability: 500
                    """;
            default -> """
                    ruby_sword:
                      displayname: "&cRuby Sword"
                      material: DIAMOND_SWORD
                      Pack:
                        model: item/ruby_sword
                        # vice textur -> sloty 0,1 modelu
                        textures:
                          - "sword/blade"
                          - "sword/hilt"
                      Mechanics:
                        durability:
                          value: 500
                    """;
        };
        write(file, content);
    }

    private void writeImportsReadme() {
        File file = new File(imports(), "README.txt");
        write(file, """
                Sem nahraj ZIP z Oraxenu / ItemsAdderu / Nexa nebo vlastni.

                Pojmenovani ZIPu urcuje cilovou slozku:
                  itemsadder-mujpack.zip -> sources/itemsadder/
                  oraxen-xxx.zip         -> sources/oraxen/
                  nexo-xxx.zip           -> sources/nexo/
                  cokoliv jineho         -> sources/voxario/

                ZIP se automaticky rozbali (modely do models/, textury do textures/
                vcetne podslozek, configy do items/) a pak se prestavi resource pack.
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
