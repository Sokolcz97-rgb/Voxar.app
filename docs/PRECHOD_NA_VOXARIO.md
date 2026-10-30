# Přechod ostrého kanálu z Unity 0.10.0 na Voxario 0.11.0

Stav: **připraveno, nepřepnuto.** Ostrý kanál launcheru (`game-updates/unity/latest.json`) dál nabízí
Unity verzi 0.10.0. Přepnutí udělá Claude na webu až po výslovném souhlasu vlastníka.

## Co je připravené

| Část | Kde | Co dělá |
| --- | --- | --- |
| Hra 0.11.0 (Voxario) | workflow `voxario-game.yml`, `version=0.11.0`, `prepare_stable=true` | sestaví hru, projde samotest a test na Windows, nahraje soubory do `game-updates/unity/0.11.0/` a manifest jen jako `unity/latest-candidate.json` |
| Launcher 0.6.1 | `game/launcher/app` (`unityGame.cjs`) | bezpečný přechod mezi verzemi (níže), převzetí kláves z Unity |
| Manifest | `game/unity/make-manifest.cjs` | přidává `engine: "voxario"` (podle `game.vgame`) |

## Co se stane u hráče po přepnutí

1. Launcher při startu (nebo každých 30 min) stáhne `latest.json`, uvidí verzi 0.11.0 a stav „update“
   (s automatickými aktualizacemi rovnou začne stahovat).
2. Porovná SHA-256 souborů v instalaci. Stáhne jen to, co se liší, a nejdřív **do složky `.staging`**
   ve složce hry. Nainstalovaná Unity verze zatím zůstává netknutá a funkční. Když stahování selže
   (síť, plný disk), nic se nezmění.
3. Teprve po stažení a ověření všech souborů:
   * přepisované soubory (`AshesOfEryon.exe`) a soubory, které nová verze nemá (`AshesOfEryon_Data/…`,
     `UnityPlayer.dll`, `UnityCrashHandler64.exe`, `MonoBleedingEdge/…`, `D3D12/…`), se **přesunou do
     `.rollback`**, nic se nemaže,
   * nové soubory (`AshesOfEryon.exe` z Voxaria, `GameData/…`, `game.vgame`, DLL) se přesunou na místo,
   * prázdné složky po Unity se smažou,
   * `install.json` zapíše `version: 0.11.0`, `engine: voxario`, `verified: false` a údaje o předchozí
     verzi.
   Kdyby přesun selhal (soubor drží jiný program), vše se vrátí, jak bylo.
4. Při **prvním spuštění** nové verze:
   * hra dostane jako dřív jednorázový lístek přihlášení (`ASHES_LAUNCHER_TICKET`), takže **přihlášení
     zůstává**. Účet launcheru se nemění a hra si z lístku udělá vlastní relaci,
   * launcher jednou přečte klávesy z Unity verze (PlayerPrefs v registru
     `HKCU\Software\StudioVoxario\Ashes of Eryon`, hodnoty `ashes.key.<akce>_h…`). Převede názvy
     (`Mouse0` → `Mouse1`, `Alpha1` → `1`, `LeftShift` → `Shift`…) a předá je hře v `ASHES_IMPORT_KEYS`.
     Hra je uloží do svého nastavení (`ashes.key.*`) a poznamená si `ashes.keys_imported`,
   * když hra **do 20 s skončí s chybou** (nebo ji nejde spustit), launcher vrátí Unity 0.10.0
     z `.rollback`. Smaže nové soubory, zapíše do `install.json` `failedVersion: 0.11.0` a ukáže hráči
     hlášku „Nová verze 0.11.0 se nespustila – vrátil jsem verzi 0.10.0“. Tuto verzi pak sám znovu
     neinstaluje, další pokus přijde až s novější verzí v manifestu,
   * když hra běží aspoň 20 s (nebo skončí normálně), verze se označí jako ověřená a `.rollback`
     se smaže.
5. Testovací kanál (`latest-beta.json`, složka `Game-beta`) se přechodem nijak nemění.

## Pořadí kroků při přepnutí (až po souhlasu)

1. **Vydat launcher 0.6.1** do `game-updates/launcher/` (`make-update.cjs`, manifest `stable.json`).
   Starší launcher by novou verzi nainstaloval postaru, bez `.staging`, bez návratu a bez převzetí
   kláves. Počkat, až se launchery aktualizují (kontrola každých 30 min).
2. Spustit `voxario-game.yml` s `version=0.11.0`, `prepare_stable=true` (případně i `publish_beta=true`).
   Musí projít samotest, test na Windows a nahrání kandidáta.
3. Ověřit `unity/latest-candidate.json` (verze 0.11.0, `engine: voxario`, soubory dostupné
   v `unity/0.11.0/`).
4. **Přepnutí:** zkopírovat `unity/latest-candidate.json` na `unity/latest.json` (jeden upload s
   `x-upsert: true`, hlavička `apikey: <sb_secret_…>`).
5. Návrat celého kanálu: znovu nahrát původní `latest.json` s Unity 0.10.0. Soubory 0.10.0 v bucketu
   zůstávají, takže launcher je stáhne zpět.

## Ověřeno

* Logika launcheru v Node se simulovaným Electronem a místním serverem: instalace Unity 0.10.0 →
  přechod na 0.11.0 (staré soubory v `.rollback`) → pád nové verze → návrat 0.10.0 (soubory
  i `install.json`) → `check()` už 0.11.0 znovu nenabízí → verze 0.11.1 se nainstaluje a po spuštění
  ověří.
* Čtení registru (`reg.exe`) a převod kláves jde ověřit jen na Windows se skutečnou Unity instalací.
