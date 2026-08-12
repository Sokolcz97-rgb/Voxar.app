package com.studiovoxario.voxarioforge;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/**
 * Generuje ukazkove configy (EXAMPLE-*.yml) do kazdeho zdroje
 * a kompletni navod do plugins/VoxarioForge/GUIDE/.
 */
public final class Examples {

    private Examples() {
    }

    // ------------------------------------------------------------- zdroje

    public static void writeSourceExamples(File sourceDir, String format) {
        write(new File(sourceDir, "EXAMPLE-items.yml"), switch (format) {
            case "itemsadder" -> ITEMSADDER_ITEMS;
            case "oraxen", "nexo" -> ORAXEN_ITEMS;
            default -> VOXARIO_ITEMS;
        });
        write(new File(sourceDir, "EXAMPLE-blocks-fixtures.yml"), VOXARIO_BLOCKS);
        write(new File(sourceDir, "EXAMPLE-gui.yml"), GUI_EXAMPLE);
        write(new File(sourceDir, "EXAMPLE-source.yml"), SOURCE_EXAMPLE);
        write(new File(sourceDir, "EXAMPLE-textures.txt"), TEXTURES_HOWTO);
    }

    // -------------------------------------------------------------- guide

    public static void writeGuide(File dataFolder) {
        File guide = new File(dataFolder, "GUIDE");
        guide.mkdirs();
        write(new File(guide, "00-START-TADY.md"), GUIDE_START);
        write(new File(guide, "01-slozky-a-cesty.md"), GUIDE_PATHS);
        write(new File(guide, "02-textury-a-vice-png.md"), GUIDE_TEXTURES);
        write(new File(guide, "03-itemy.md"), GUIDE_ITEMS);
        write(new File(guide, "04-bloky-a-fixtures.md"), GUIDE_BLOCKS);
        write(new File(guide, "05-gui.md"), GUIDE_GUI);
        write(new File(guide, "06-stanice.md"), GUIDE_STATIONS);
        write(new File(guide, "07-pack-a-mysql.md"), GUIDE_PACK);
    }

    private static void write(File file, String content) {
        try {
            File parent = file.getParentFile();
            if (parent != null) parent.mkdirs();
            Files.writeString(file.toPath(), content, StandardCharsets.UTF_8);
        } catch (Exception ignored) {
        }
    }

    // ------------------------------------------------------------ obsahy

    private static final String VOXARIO_ITEMS = """
            # ============================================================
            #  UKAZKA: itemy (format voxario)
            #  Zkopiruj do items/mujsoubor.yml a uprav.
            #  Vse s "#" je komentar = neni potreba.
            # ============================================================
            constructs:

              ruby_blade:
                display: "&cRubinova cepel"
                material: IRON_SWORD          # vanilla item, na kterem to bezi
                blueprint: ruby_blade         # nazev souboru v models/ (bez pripony)
                category: weapons

                # --- TEXTURY -------------------------------------------
                # texture-path = podslozka ve slozce textur (nepovinne)
                texture-path: "weapons/ruby"
                # cislo = slot textury v Blockbench modelu (0, 1, 2 ...)
                textures:
                  0: "blade"                  # -> textures/weapons/ruby/blade.png
                  1: "hilt"                   # -> textures/weapons/ruby/hilt.png
                  particle: "blade"           # castice pri rozbiti
                # Pozn.: muzes psat i plnou cestu bez texture-path:
                #   textures:
                #     0: "weapons/ruby/blade"
                #     1: "weapons/ruby/hilt"

                lore:
                  - "&7Vykovano v StudioVoxario"
                unbreakable: true
                hide-flags: true
                attributes:
                  attack-damage: 9.5
                  attack-speed: -2.4
                enchants:
                  SHARPNESS: 3

              # nejjednodussi item - jedna textura primo z .bbmodel
              mana_flask:
                display: "&dLahvicka many"
                material: PAPER
                blueprint: mana_flask
                category: consumables
            """;

    private static final String ITEMSADDER_ITEMS = """
            # ============================================================
            #  UKAZKA: itemy (format ItemsAdder)
            #  Zkopiruj do items/mujsoubor.yml
            # ============================================================
            info:
              namespace: mujpack

            items:
              ruby_sword:
                display_name: "&cRuby Sword"
                resource:
                  material: DIAMOND_SWORD
                  model_path: "item/ruby_sword"     # model v models/
                  # vice PNG = sloty 0,1,2 ... modelu
                  textures:
                    - "weapons/ruby/blade"
                    - "weapons/ruby/hilt"
                  # nepovinne: spolecna podslozka pro textury vyse
                  texture_path: ""
                lore:
                  - "&7Import z ItemsAdderu"
            """;

    private static final String ORAXEN_ITEMS = """
            # ============================================================
            #  UKAZKA: itemy (format Oraxen / Nexo)
            #  Zkopiruj do items/mujsoubor.yml
            # ============================================================
            ruby_sword:
              displayname: "&cRuby Sword"
              material: DIAMOND_SWORD
              Pack:
                model: item/ruby_sword          # model v models/
                # vice PNG = sloty 0,1,2 ... modelu
                textures:
                  - "weapons/ruby/blade"
                  - "weapons/ruby/hilt"
                texture_path: ""                # nepovinna spolecna podslozka
              lore:
                - "&7Import z Oraxenu"
              Enchantments:
                SHARPNESS: 2
            """;

    private static final String VOXARIO_BLOCKS = """
            # ============================================================
            #  UKAZKA: dekorace / nabytek (Fixture) a "bloky"
            #  Fixture = 3D model umisteny do sveta pravym klikem.
            # ============================================================
            constructs:

              arcane_lantern:
                display: "&bArkanni lucerna"
                material: PAPER
                blueprint: arcane_lantern
                category: fixtures
                fixture: true
                fixture-scale: 1.0
                fixture-hitbox: [0.8, 1.2]     # sirka, vyska
                texture-path: "fixtures/lantern"
                textures:
                  0: "frame"
                  1: "glass"
                  2: "glow"
                lore:
                  - "&7Poloz na zem pravym klikem"
                  - "&8Sneak + pravy klik = sebrat"
            """;

    private static final String GUI_EXAMPLE = """
            # ============================================================
            #  UKAZKA: vzhled GUI tohoto zdroje -> zkopiruj do gui/gui.yml
            # ============================================================
            title: "&6&l⚒ &e&lMUJ OBSAH &6&l⚒"
            rows: 6

            frame:
              enabled: true
              material: "BLACK_STAINED_GLASS_PANE"
              name: "&8|"

            buttons:
              back: "ARROW"
              next: "ARROW"
              info: "NETHER_STAR"
              build: "ANVIL"
              reload: "BOOK"
              home: "COMPASS"
            """;

    private static final String SOURCE_EXAMPLE = """
            # ============================================================
            #  UKAZKA: source.yml - cesty a nastaveni zdroje
            # ============================================================
            enabled: true
            display: "&b&lMuj zdroj"
            format: "voxario"        # voxario | itemsadder | oraxen | nexo
            icon: "NETHER_STAR"
            auto-build: true

            paths:
              items: "items"
              models: "models"
              textures:              # jeden retezec nebo seznam slozek
                - "textures"
                - "textures/blocks"
                - "textures/gui"
              extra-textures:        # klidne i absolutni cesta na disku
                - "/home/mc/sdilene-textury"
              gui: "gui"

            pack:
              # kam se textury dostanou v resource packu:
              # assets/voxforge/textures/<texture-folder>/<nazev>.png
              texture-folder: "item/muj_zdroj"
            """;

    private static final String TEXTURES_HOWTO = """
            VICE .PNG TEXTUR NA JEDEN MODEL
            ===============================

            Blockbench umi mit v jednom modelu vic textur (sloty 0, 1, 2 ...).
            Nemusis je slepovat do jednoho PNG.

            1) V Blockbenchi si u kazde casti nastav jinou texturu.
            2) Textury exportuj jako samostatne .png do slozky textures/
               (klidne do podslozek, napr. textures/weapons/ruby/blade.png).
            3) V configu itemu je namapuj na sloty:

               ruby_blade:
                 blueprint: ruby_blade
                 texture-path: "weapons/ruby"
                 textures:
                   0: "blade"
                   1: "hilt"
                   particle: "blade"

            Pravidla:
            - cislo klice = index textury v .bbmodel souboru
            - "particle" = textura casteti
            - texture-path je nepovinny prefix; bez nej piš celou cestu
            - pripona .png se doplni sama
            - kdyz slot nevyplnis, pouzije se textura vlozena primo v .bbmodel

            Kam se cesty ukladaji v packu urcuje source.yml -> pack.texture-folder.
            Slozky, kde plugin textury hleda, urcuje source.yml -> paths.textures.
            """;

    private static final String GUIDE_START = """
            # VoxarioForge - navod (start)

            Vse potrebne najdes v teto slozce `GUIDE/`:

            | Soubor | Obsah |
            |---|---|
            | 01-slozky-a-cesty.md | struktura slozek, nastaveni vlastnich cest |
            | 02-textury-a-vice-png.md | vice PNG textur na jeden model |
            | 03-itemy.md | konfigurace itemu (voxario / ItemsAdder / Oraxen / Nexo) |
            | 04-bloky-a-fixtures.md | dekorace a nabytek |
            | 05-gui.md | vzhled GUI |
            | 06-stanice.md | kovadlina, verpanek, alchymie |
            | 07-pack-a-mysql.md | resource pack, hosting, MySQL sync |

            Rychly start:
            1. Model (`.bbmodel` / `.iaentitymodel`) hod do `sources/voxario/models/`.
            2. Textury (`.png`) do `sources/voxario/textures/` (i podslozky).
            3. Item popis do `sources/voxario/items/items.yml`.
            4. `/voxforge pack` a `/voxforge give <id>`.

            V ceste kazdeho zdroje najdes soubory `EXAMPLE-*.yml` s hotovymi ukazkami.
            Ve hre: `/voxforge guide` vypise navod primo do chatu.
            """;

    private static final String GUIDE_PATHS = """
            # Slozky a vlastni cesty

            ```
            plugins/VoxarioForge/
              sources/
                voxario/ itemsadder/ oraxen/ nexo/
                  items/     configy itemu
                  models/    .bbmodel / .iaentitymodel / .json
                  textures/  .png (i podslozky)
                  gui/gui.yml
                  source.yml
                  EXAMPLE-*.yml
              imports/   sem ZIP -> rozbali se sam
              output/    hotovy resource pack
              GUIDE/     tento navod
            ```

            Cesty si muzes prejmenovat nebo ukazat jinam v `source.yml`:

            ```yaml
            paths:
              items: "configy"
              models: "modely"
              textures:
                - "textures"
                - "textures/blocks"
                - "/absolutni/cesta/ke/sdilenym/texturam"
              gui: "gui"

            pack:
              texture-folder: "item/muj_zdroj"
            ```

            - relativni cesta = vuci slozce zdroje
            - absolutni cesta = kdekoliv na disku
            - `pack.texture-folder` urcuje, kam textury spadnou v resource packu:
              `assets/<namespace>/textures/<texture-folder>/<nazev>.png`
            """;

    private static final String GUIDE_TEXTURES = TEXTURES_HOWTO;

    private static final String GUIDE_ITEMS = """
            # Itemy

            ## Format voxario (`sources/voxario/items/items.yml`)

            ```yaml
            constructs:
              ruby_blade:
                display: "&cRubinova cepel"
                material: IRON_SWORD
                blueprint: ruby_blade      # soubor v models/ bez pripony
                category: weapons
                texture-path: "weapons/ruby"
                textures:
                  0: "blade"
                  1: "hilt"
                lore: ["&7Vykovano v StudioVoxario"]
                unbreakable: true
                hide-flags: true
                attributes:
                  attack-damage: 9.5
                  attack-speed: -2.4
                enchants:
                  SHARPNESS: 3
            ```

            Podporovane atributy: `attack-damage`, `attack-speed`, `armor`,
            `armor-toughness`, `max-health`, `movement-speed`, `knockback-resistance`.

            ## ItemsAdder

            ```yaml
            items:
              ruby_sword:
                display_name: "&cRuby Sword"
                resource:
                  material: DIAMOND_SWORD
                  model_path: "item/ruby_sword"
                  textures: ["weapons/ruby/blade", "weapons/ruby/hilt"]
            ```

            ## Oraxen / Nexo

            ```yaml
            ruby_sword:
              displayname: "&cRuby Sword"
              material: DIAMOND_SWORD
              Pack:
                model: item/ruby_sword
                textures: ["weapons/ruby/blade", "weapons/ruby/hilt"]
            ```

            Prikazy: `/voxforge give <id> [hrac] [pocet]`, `/voxforge list`.
            """;

    private static final String GUIDE_BLOCKS = """
            # Bloky a Fixtures (nabytek / dekorace)

            ```yaml
            constructs:
              arcane_lantern:
                display: "&bArkanni lucerna"
                material: PAPER
                blueprint: arcane_lantern
                category: fixtures
                fixture: true
                fixture-scale: 1.0
                fixture-hitbox: [0.8, 1.2]   # sirka, vyska
                texture-path: "fixtures/lantern"
                textures:
                  0: "frame"
                  1: "glass"
            ```

            - pravy klik na zem = polozeni (snap na mrizku 0.25)
            - sneak + pravy klik = sebrani
            - rotace po 45 stupnich
            """;

    private static final String GUIDE_GUI = """
            # GUI

            Kazdy zdroj ma vlastni tema v `sources/<zdroj>/gui/gui.yml`:

            ```yaml
            title: "&6&l⚒ &e&lMUJ OBSAH &6&l⚒"
            rows: 6
            frame:
              enabled: true
              material: "BLACK_STAINED_GLASS_PANE"
              name: "&8|"
            buttons:
              back: "ARROW"
              next: "ARROW"
              info: "NETHER_STAR"
              build: "ANVIL"
              reload: "BOOK"
              home: "COMPASS"
            ```

            Hlavni menu (vyber pluginu) se nastavuje v `config.yml` -> `gui.title`, `gui.rows`.
            Otevreni: `/voxforge gui` nebo `/voxforge gui <zdroj> [kategorie]`.
            """;

    private static final String GUIDE_STATIONS = """
            # RPG stanice

            Konfigurace: `plugins/VoxarioForge/stations.yml`

            - `anvil` (kovadlina) - item + surovina -> vylepseny Construct, cena v levelech
            - `workbench` (verpanek) - 3x3 mrizka s vlastnimi surovinami
            - `alchemy` (alchymie) - michani lahvicek

            Tokeny surovin: `IRON_INGOT` (vanilla) nebo `vox:ruby_blade` (Construct).
            Otevreni: pravym klikem na vanilla blok nebo `/voxforge station <id>`.
            """;

    private static final String GUIDE_PACK = """
            # Resource pack a MySQL

            - `/voxforge pack` sestavi ZIP do `output/`
            - vestaveny HTTP server ho hostuje na `http://<host>:<port>/pack.zip`
              (`config.yml` -> `pack.http`)
            - `content.auto-build: true` hlida zmeny a stavi pack sam
            - ZIP z jineho pluginu hod do `imports/` (nazev urcuje cil, napr. `oraxen-*.zip`)
            - MySQL (`config.yml` -> `mysql`) synchronizuje obsah i hotovy pack mezi servery;
              `/voxforge sync push|pull|status`
            - `/voxforge reset` obnovi vestavene ukazky a navody
            """;
}
