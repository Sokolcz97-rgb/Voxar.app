package com.studiovoxario.voxarioperms;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/** Vygeneruje navody do plugins/VoxarioPerms/GUIDE/. */
public final class Guide {

    private Guide() {}

    public static void write(File dataFolder) {
        File dir = new File(dataFolder, "GUIDE");
        dir.mkdirs();
        put(dir, "1-ZACINAME.md", """
                # VoxarioPerms - zaciname

                1. Napis ve hre `/voxperms` (nebo `/vp`). Otevre se hlavni GUI.
                2. **Permission plugin** - plugin sam detekuje LuckPerms, PermissionsEx,
                   GroupManager, zPermissions, UltraPermissions, PowerfulPerms a Vault.
                   Zeleny = nalezen. Klikni na ten, ktery chces pouzivat.
                3. **Pluginy & permissions** - seznam vsech .jar v `plugins/`.
                   U kazdeho vidis pocet nalezenych permissions.
                4. Klikni na plugin -> zobrazi se vsechny jeho permise jako zaskrtavatka.
                5. Dole jsou rychla tlacitka: Vybrat vse, Zrusit vyber a presety
                   Admin / Moderator / Builder / Helper.
                6. **Pokracovat -> skupina** -> klikni na skupinu:
                   - levy klik = udelit (true)
                   - pravy klik = zakazat (false)
                   - shift + klik = odebrat (unset)
                """);
        put(dir, "2-SKUPINY-A-ROLE.md", """
                # Skupiny a role

                V menu **Skupiny & role** ma kazda skupina prirazenou roli:
                `OWNER`, `ADMIN`, `MODERATOR`, `BUILDER`, `HELPER`, `DEFAULT`.

                - Klik = prepne na dalsi roli.
                - Shift + klik = aplikuje preset teto role na VSECHNY pluginy na serveru.
                - Tlacitko **Aplikovat vsechny presety** udela totez pro vsechny skupiny.

                Role `OWNER` dostane automaticky wildcard `*` (vsechna opravneni).
                Ostatni role dostavaji permissions podle klicovych slov, ktere se
                daji upravit v `config.yml`.

                Role se pri prvnim spusteni odhaduji z nazvu skupiny
                (owner/admin/mod/builder/helper). Ulozene mapovani je v `roles.yml`.
                """);
        put(dir, "3-DETEKCE-PERMISSIONS.md", """
                # Jak se hledaji permissions

                1. `plugin.yml` sekce `permissions` (vcetne `children`).
                2. `permission:` u kazdeho prikazu v sekci `commands`.
                3. Volitelny **deep scan** (`deep-scan: true` v configu) - plugin projde
                   bytecode jaru a najde i permise, ktere autor nedeklaroval.
                   Bere pouze uzly zacinajici nazvem daneho pluginu, aby nevznikal balast.

                Pokud ti nejaka permise chybi, muzes ji dopsat rucne do
                `config.yml` -> `extra-permissions`.
                """);
        put(dir, "4-PRIKAZY.md", """
                # Prikazy

                - `/voxperms` - otevre GUI
                - `/voxperms gui` - totez
                - `/voxperms backends` - vypis detekovanych permission pluginu
                - `/voxperms scan` - znovu naskenuje pluginy a vypise pocty permissions
                - `/voxperms groups` - vypis skupin aktivniho backendu
                - `/voxperms role <skupina> <owner|admin|moderator|builder|helper|default>`
                - `/voxperms apply <skupina>` - aplikuje preset role dane skupiny
                - `/voxperms grant <skupina> <permission>` - udeli jednu permission
                - `/voxperms unset <skupina> <permission>` - odebere jednu permission
                - `/voxperms guide` - vypise, kde najdes navody
                - `/voxperms reload` - znovu nacte config

                Opravneni: `voxarioperms.admin` (default: op)
                """);
    }

    private static void put(File dir, String name, String content) {
        try {
            File f = new File(dir, name);
            Files.writeString(f.toPath(), content, StandardCharsets.UTF_8);
        } catch (Exception ignored) {}
    }
}
