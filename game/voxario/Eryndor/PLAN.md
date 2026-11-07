# Eryndor – testovací fantasy kanál (plán a stav)

Zadání (vlastník, 2026-11-04): nový kanál launcheru „Fantasy“, nová hra od základu podle lore
„Svět Eryndor a Velký Rozkol“ (Sylvaria vs. Aethelgard, Ozvěna, Aetherium, Umbra). Jen testovací
počáteční lokace, ať je vidět, jak by hra mohla vypadat. Styl jako stylizovaná MMO (4Story, World of
Warcraft) – **ale vše vlastní** (žádné převzaté modely, textury, postavy ani hudba z cizích her; assety
se generují kódem v `tools/`). Bojový systém podle principů 4Story (tab-target). Vítr, počasí, obloha,
voda. Vše přes Voxario Studio Engine.

## Postup (zaškrtnuté = hotovo; při přerušení pokračovat od prvního nezaškrtnutého)

### A. Engine (Voxario-Studio-Engine)
- [x] A1 Počasí: déšť, sníh, bouřka s blesky, mokré povrchy, sněhová pokrývka (`world.weather`)
- [x] A2 Globální vítr (směr, síla, nárazy): tráva, stromy, mraky, vlny vody
- [x] A2b Oblékání: `entity.show_part`, `entity.parts`, `entity.equip` (díly z jiného modelu na kostře nositele)
- [ ] A3 Částice (kouzla, jiskry krystalů, světlušky, prach) – `world.particles`
- [x] A4 Vydání enginu (1.9.0)

### B. Assety (generátor `tools/eryndor_assets.py`, vlastní tvorba)
- [x] B1 Postavy: Ozvěna (muž / žena), zbroj Sylvarie a Aethelgardu – kostra od začátku (tuhé díly = bez natažení)
- [x] B2 Nepřátelé: Zkažený vlk (krystaly Umbria), Kultista Prázdnoty, Drtič popela
- [x] B3 Krajina: obří živý strom, bioluminiscenční houby a kapradí, krystaly Aetheria, skály, bílý mramor
- [x] B4 Stavby: sylvarská mramorová svatyně, aethelgardská železná strážní věž s ozubenými koly, Stínová trhlina
- [x] B5 Lávový pavouk (Creature Forge enginu): `tools/creatures/lavovy_pavouk.creature.json` →
      `VoxarioCreatureForge … Assets/Models/chars/lavovy_pavouk.glb --lod …_lo.glb` (kostra, klipy Idle/Walk/Run/Attack/Hit/Death,
      lávové praskliny a žhnoucí klouby jako emise). Ve hře `spider` v `eryndor/combat.lua`: úroveň 4, hnízdo na popelavém
      návrší (78, 88), (92, 74), (66, 102), svítí kolem sebe. Samotest `VOXARIO_SELFTEST_ONLY=spider`, v `game` záběry g9–g12.

### C. Hra `game/voxario/Eryndor`
- [x] C1 Kostra projektu (game.vgame, main.lua, balení, samotest)
- [x] C2 Počáteční lokace „Hraniční údolí Zlomu“: terén, křišťálové jezero, les Sylvarie, tábor Aethelgardu, trhlina
- [x] C3 Obloha, den a noc, cyklus počasí
- [x] C4 Boj (4Story styl): zaměření cíle (Tab / klik), automatický útok, lišta dovedností 1–0 s cooldowny a globálním
      cooldownem, mana, sesílání s ukazatelem, agro a návrat nepřítele, čísla poškození, zkušenosti a úrovně, respawn
- [x] C5 HUD: rámeček hráče a cíle, lišta dovedností, ukazatel sesílání, minimapa, chat/log boje
- [x] C6 NPC z lore (Archivářka Lyrise jako průvodce), první úkol
- [x] C7 Snímky

### D. Launcher a vydání
- [x] D1 Kanál „fantasy“ v launcheru (vlastní složka `…-fantasy`, manifest `unity/latest-fantasy.json`)
- [x] D2 Workflow pro sestavení a nahrání Eryndoru do kanálu
- [x] D3 Vydání launcheru s novým kanálem

## Poznámky
- Assety: `python3 tools/eryndor_nature.py` (krajina, stavby). Knihovna tvarů a zápisu GLB: `tools/meshkit.py`.
- Samotest: `tools/package-game.sh <engine/bin> <výstup>` a `Eryndor --selftest <složka>` (záběry lokace a počasí).
- Engine: `world.weather{rain, snow, storm, wind, wind_direction, instant}` (docs/LUA_API.md).
- Postavy: KayKit Adventurers (CC0, Kay Lousberg) – `Assets/Models/kaykit`, frakční varianty `python3 tools/kaykit_variants.py`.
- Boj: `eryndor/combat.lua` (povolání, dovednosti, nepřátelé), HUD `eryndor/hud.lua`, výprava `eryndor/quest.lua`, efekty `eryndor/fx.lua`.
- Samotesty: `VOXARIO_SELFTEST_ONLY=game` (výběr, boj, Lyrise), `=chars` (postavy), `=weather`, bez proměnné = lokace a počasí.
- Ovládání: WASD, Shift chůze, Space skok, pravé tlačítko kamera / klik na nepřítele = útok, levé = cíl, Tab cíl,
  R automatický útok, 1–5 dovednosti, F mluvit, Esc zrušit cíl.
- Realistické postavy: `ERYNDOR_MH_DIR=<složka s mpfb2 a mhsys> python3 tools/mh_build.py` (MakeHuman CC0: MPFB2 data
  `src/mpfb/data` z github.com/makehumancommunity/mpfb2 a `makehuman_system_assets_cc0.zip` z files.makehumancommunity.org).
  Tělo + morfy + kůže + oči/obočí/řasy/vlasy, kostra game_engine, brnění a oděvy na míru tělu (skořepiny z oblastí těla, panely
  sukní, plášť, tuhé nárameníky a helmy), animace přenesené z KayKit Knight.glb (76 klipů), úchyty zbraní handslot.r/l.
  Výstup `Assets/Models/humans/*.glb`. Test: `VOXARIO_SELFTEST_ONLY=humans VOXARIO_HUMANS=syl_knight_m,...`.
- Vydáno (2026-11-05): engine v1.9.0, Eryndor 0.1.0 v kanálu Fantasy (unity/latest-fantasy.json), launcher 0.7.0.
  Vydání: workflow `eryndor-game.yml` (engine_tag, version, publish, publish_launcher).
- Další kroky (návrhy): částice (A3), více lokací a výprav, ladění 4Story mechanik podle podkladů vlastníka.
