package com.studiovoxario.voxarioupdater;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/** Vygeneruje navod do plugins/VoxarioUpdater/GUIDE/. */
public final class Guide {

    private Guide() {}

    public static void write(File dataFolder) {
        File dir = new File(dataFolder, "GUIDE");
        dir.mkdirs();
        put(new File(dir, "1-ZACINAME.md"), START);
        put(new File(dir, "2-PLATFORMY.md"), PLATFORMS);
        put(new File(dir, "3-PLACENE-PLUGINY.md"), PAID);
        put(new File(dir, "4-BEZPECNOST.md"), SECURITY);
    }

    private static void put(File f, String content) {
        try { Files.writeString(f.toPath(), content, StandardCharsets.UTF_8); } catch (Exception ignored) {}
    }

    private static final String START = """
        # VoxarioUpdater - zaciname

        Plugin projde vsechny .jar v `plugins/`, zjisti odkud pochazi a hlida nove verze.

        ## Prikazy
        - `/voxupdate check` - zkontroluje vsechny pluginy (asynchronne)
        - `/voxupdate list` - vypise posledni vysledek kontroly
        - `/voxupdate status` - stav platforem a prihlaseni
        - `/voxupdate update <plugin|all>` - stahne aktualizaci do `plugins/update/`
        - `/voxupdate auth <platforma>` - prihlaseni pres prohlizec
        - `/voxupdate auth <platforma> <token>` - dokonceni prihlaseni
        - `/voxupdate logout <platforma>` - smaze ulozeny token
        - `/voxupdate pending` - co ceka na nasazeni
        - `/voxupdate reload` - znovu nacte config
        - `/voxupdate guide` - prehled navodu

        ## Kdy se aktualizace nasadi
        Nove jary se ukladaji do `plugins/update/`. Paper je automaticky nasadi
        **pri dalsim startu serveru** - to je bezpecne a nerozbije bezici server.
        Vymena jaru za behu (`/reload`) neni podporovana zamerne.

        ## Kdyz plugin nema zjisteny zdroj
        Doplnit do `config.yml`:
        ```yaml
        overrides:
          NazevPluginu:
            provider: github     # github|modrinth|hangar|spigot|polymart|builtbybit
            id: "owner/repo"     # nebo slug / resource ID
        ```
        """;

    private static final String PLATFORMS = """
        # Podporovane platformy

        | Platforma  | Zdarma | Placene | Overeni vlastnictvi | Auto-download |
        |-----------|--------|---------|---------------------|---------------|
        | GitHub     | ano    | -       | neni potreba        | ano |
        | Modrinth   | ano    | -       | neni potreba        | ano |
        | Hangar     | ano    | -       | neni potreba        | ano |
        | SpigotMC   | ano    | ano     | NEDOSTUPNE (nema API) | jen free |
        | Polymart   | ano    | ano     | API klic uctu       | ano po overeni |
        | BuiltByBit | -      | ano     | Private API token   | ano po overeni |

        Detekce zdroje probiha z: `overrides` v configu -> `website` v plugin.yml ->
        text plugin.yml -> `config.yml` daneho pluginu.
        """;

    private static final String PAID = """
        # Placene pluginy

        1. `/voxupdate auth polymart` (nebo `builtbybit`) vypise odkaz.
        2. Odkaz otevres **v prohlizeci** - prihlasis se tak, jak jsi zvykly
           (Google, Discord, GitHub nebo e-mail + heslo primo na dane strance).
           Do hry ani na server nikdy nezadavas heslo.
        3. Na strance vygenerujes API token a vlozis ho:
           `/voxupdate auth polymart <TOKEN>`
        4. Plugin overi vlastnictvi:
           - vlastnis -> "Plugin vam aktualizujeme, protoze ho mate ve vlastnictvi"
           - nevlastnis -> "Nemate tento plugin ve vlastnictvi" a nic se nestahne.

        SpigotMC nema verejne API pro overeni nakupu, proto se placene resources
        ze Spigotu **nikdy nestahuji automaticky** - vypise se jen odkaz na produkt.
        """;

    private static final String SECURITY = """
        # Bezpecnost a soukromi

        - Hesla se nikdy neukladaji ani neprenaseji pres server (`security.store-passwords: false`).
        - Ukladaji se pouze API tokeny, sifrovane AES-256-GCM klicem v `auth.key` (prava 600).
        - Token smazes prikazem `/voxupdate logout <platforma>`.
        - Placeny obsah se stahne pouze po uspesnem overeni vlastnictvi
          (`security.require-ownership: true`). Plugin neobchazi DRM, licence ani
          podminky uziti jednotlivych trzist - pouziva vyhradne oficialni API
          se tvymi vlastnimi pristupovymi udaji.
        - Kazdy stazeny soubor se overi (velikost, ZIP, pritomnost plugin.yml)
          a puvodni jar se zazalohuje do `plugins/VoxarioUpdater/backups/`.
        - Prikazy jsou dostupne jen s opravnenim `voxarioupdater.admin`.
        """;
}
