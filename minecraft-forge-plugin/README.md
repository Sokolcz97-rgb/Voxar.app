# VoxarioForge

Vlastní obsahový engine pro Minecraft (alternativa k ItemsAdder/Nexo, vlastní terminologie).
**Folia 1.21.11+**, kompilováno na **Java 21** (běží na JDK 21+ i 25), funguje i na čistém Paperu.

## Pojmy

| Pojem | Význam |
|---|---|
| **Construct** | vlastní item (zbraň, nástroj, dekorace) |
| **Blueprint** | `.bbmodel` model z Blockbenche |
| **Fixture** | 3D nábytek umístěný ve světě (ItemDisplay + Interaction hitbox) |
| **Forge Pack** | automaticky vygenerovaný resource pack (ZIP) |
| **Forge Terminal** | in-game GUI (`/voxforge gui`) |

## Instalace

1. `VoxarioForge.jar` → `plugins/`, restart serveru.
2. Vznikne `plugins/VoxarioForge/packs/default/` s `items.yml` a složkou `blueprints/`.
3. Modely nahraj do `blueprints/` — podporované formáty: `.bbmodel` (Blockbench), `.iaentitymodel` / `.json` (ItemsAdder / Bedrock geometry).
   U `.iaentitymodel` bez vložené textury přidej vedle stejně pojmenovaný `.png`.
4. V `items.yml` přiřaď `blueprint: <jmeno souboru bez pripony>`.
5. `/voxforge reload` a `/voxforge pack` — vznikne `VoxarioForge-Pack.zip`.
6. ZIP nahostuj a URL + SHA-1 vlož do `config.yml` (`pack.url`, `pack.sha1`).

## Příkazy (`/voxforge`, alias `/vf`)

- `gui [kategorie]` – Forge Terminal: procházení, klik = 1×, shift = 64×, tlačítka pack/reload
- `give <id> [hráč] [počet]`
- `pack` – sestaví resource pack (async)
- `reload` – znovu načte packy a blueprinty
- `list`, `blueprints`

## Co umí

- `.bbmodel` i `.iaentitymodel` (Bedrock geometry) → vanilla model JSON (elementy, UV přepočet, rotace, display)
- automatická extrakce PNG textur z base64 v `.bbmodel`
- `item_model` komponenta (1.21.4+ formát `assets/<ns>/items/<id>.json`) – žádná CustomModelData kolize
- atributy (damage, speed, armor, health…), enchanty, unbreakable, hide-flags, lore, kategorie
- Fixtures: umístění pravým klikem, snap na 0.25 mřížku, rotace po 45°, sneak + pravý klik = sebrání
- automatické odeslání resource packu při připojení
- plně Folia-safe (global/async/entity schedulery, žádný `Bukkit.getScheduler()`)

## Build

```bash
JAVA_HOME=<jdk21+> mvn -B package   # target/VoxarioForge.jar
```

## RPG stanice (Stations)

Konfigurace: `plugins/VoxarioForge/stations.yml`

- `anvil` (KOVADLINA) – item + surovina → vylepšený Construct, volitelně cena v levelech
- `workbench` (VERPÁNEK) – klasická 3×3 mřížka s vlastními surovinami
- `alchemy` (ALCHYMIE) – míchání lahviček

Stanice se otevírají pravým klikem na odpovídající vanilla blok (`stations.replace-vanilla: true`)
nebo příkazem `/voxforge station <id>`. Tokeny surovin: `IRON_INGOT` (vanilla) nebo `vox:ruby_blade` (Construct).

Ukázkové modely (`.bbmodel`) jsou přibalené: `ruby_blade`, `rune_hammer`, `mana_flask`, `arcane_lantern`.

## MySQL synchronizace a automatický pack

`config.yml`:

```yaml
mysql:
  enabled: true
  host: "127.0.0.1"
  port: 3306
  database: "voxarioforge"
  user: "voxario"
  password: "..."
  auto-sync: true
  interval-seconds: 60
pack:
  http:
    enabled: true
    port: 8123
    public-host: "mc.studiovoxario.com"
```

- Tabulky `voxforge_files` a `voxforge_pack` se vytvoří samy.
- Při startu se obsah stáhne z DB, sestaví se pack a nahraje zpět (`/voxforge sync push|pull|status`).
- Každých `interval-seconds` se kontrolují změny – při změně se obsah načte, pack přestaví
  a všem online hráčům se automaticky pošle nová verze (`pack.auto-resend`).
- Vestavěný pack server hostuje ZIP na `http://<public-host>:<port>/pack.zip`, takže klienti
  stahují pack automaticky bez externího hostingu.

Java: přeloženo na **Java 21** (class 65), běží na JDK 21 i vyšších (25 apod.).
MySQL driver se stahuje automaticky přes Paper `libraries` (nemusíš nic přidávat).
