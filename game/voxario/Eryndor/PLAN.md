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
- [ ] A3 Částice (kouzla, jiskry krystalů, světlušky, prach) – `world.particles`
- [ ] A4 Vydání enginu (1.9.0)

### B. Assety (generátor `tools/eryndor_assets.py`, vlastní tvorba)
- [ ] B1 Postavy: Ozvěna (muž / žena), zbroj Sylvarie a Aethelgardu – kostra od začátku (tuhé díly = bez natažení)
- [ ] B2 Nepřátelé: Zkažený vlk (krystaly Umbria), Kultista Prázdnoty, Drtič popela
- [x] B3 Krajina: obří živý strom, bioluminiscenční houby a kapradí, krystaly Aetheria, skály, bílý mramor
- [x] B4 Stavby: sylvarská mramorová svatyně, aethelgardská železná strážní věž s ozubenými koly, Stínová trhlina

### C. Hra `game/voxario/Eryndor`
- [x] C1 Kostra projektu (game.vgame, main.lua, balení, samotest)
- [~] C2 Počáteční lokace „Hraniční údolí Zlomu“: terén, křišťálové jezero, les Sylvarie, tábor Aethelgardu, trhlina
- [ ] C3 Obloha, den a noc, cyklus počasí
- [ ] C4 Boj (4Story styl): zaměření cíle (Tab / klik), automatický útok, lišta dovedností 1–0 s cooldowny a globálním
      cooldownem, mana, sesílání s ukazatelem, agro a návrat nepřítele, čísla poškození, zkušenosti a úrovně, respawn
- [ ] C5 HUD: rámeček hráče a cíle, lišta dovedností, ukazatel sesílání, minimapa, chat/log boje
- [ ] C6 NPC z lore (Archivářka Lyrise jako průvodce), první úkol
- [ ] C7 Snímky

### D. Launcher a vydání
- [ ] D1 Kanál „fantasy“ v launcheru (vlastní složka `…-fantasy`, manifest `unity/latest-fantasy.json`)
- [ ] D2 Workflow pro sestavení a nahrání Eryndoru do kanálu
- [ ] D3 Vydání launcheru s novým kanálem

## Poznámky
- Assety: `python3 tools/eryndor_nature.py` (krajina, stavby). Knihovna tvarů a zápisu GLB: `tools/meshkit.py`.
- Samotest: `tools/package-game.sh <engine/bin> <výstup>` a `Eryndor --selftest <složka>` (záběry lokace a počasí).
- Engine: `world.weather{rain, snow, storm, wind, wind_direction, instant}` (docs/LUA_API.md).
