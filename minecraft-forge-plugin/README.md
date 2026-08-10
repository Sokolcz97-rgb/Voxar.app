# VoxarioForge

Vlastní obsahový engine pro Minecraft (alternativa k ItemsAdder/Nexo, vlastní terminologie).
**Folia 1.21.11+**, kompilováno na **JDK 25**, běží i na čistém Paperu.

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
3. Exportované `.bbmodel` soubory z Blockbenche nahraj do `blueprints/`.
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

- `.bbmodel` → vanilla model JSON (elementy, UV přepočet dle resolution, rotace, display)
- automatická extrakce PNG textur z base64 v `.bbmodel`
- `item_model` komponenta (1.21.4+ formát `assets/<ns>/items/<id>.json`) – žádná CustomModelData kolize
- atributy (damage, speed, armor, health…), enchanty, unbreakable, hide-flags, lore, kategorie
- Fixtures: umístění pravým klikem, snap na 0.25 mřížku, rotace po 45°, sneak + pravý klik = sebrání
- automatické odeslání resource packu při připojení
- plně Folia-safe (global/async/entity schedulery, žádný `Bukkit.getScheduler()`)

## Build

```bash
JAVA_HOME=<jdk25> mvn -B package   # target/VoxarioForge.jar
```
