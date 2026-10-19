# Ashes of Eryon – 1. akt (alfa)

První hratelná verze hry. Běží jako 3D hra v prohlížeči na `/hra` a launcher Ashes ji otevírá ve vlastním okně.

## Rozhodnutí

| Otázka | Rozhodnutí |
| --- | --- |
| Engine | Three.js (WebGL) uvnitř webu StudioVoxario, načítá se zvlášť (lazy chunk) |
| Herní smyčka | Ve stylu Shakes & Fidget: výpravy na čas, souboje počítané serverem, výbava, výcvik, aréna |
| Multiplayer | Společná obrana hradeb, aréna proti jiným hráčům, kronika, hráči na břehu přes realtime presence |
| Eryon | Legendární NPC. Správce si může svou postavu proměnit v Eryona, promlouvat ke všem a nechat se vyzvat v aréně |
| Hudba | Album „Eryon“ v soukromém bucketu `ashes-music`, čtení jen pro hráče (`ashes_can_play()`) |
| Přístup | Zatím správci a editoři. Správce může hru otevřít všem v panelu Hradby → Správce |

## Strany konfliktu

Při tvorbě postavy si hráč vybírá stranu:

| Strana | Hrdina | Kdo ho může převzít |
| --- | --- | --- |
| Obránci Kalidry | Eryon, poslední štít | správce |
| Legie Rudého slunce | Azkar, Syn Rudého slunce | správce nebo editor |

- Hradby Kalidry jsou přetahovaná: vítězství obránců je zpevňují, vítězství Legie je boří.
- V aréně se mohou utkat hráči obou stran; souboj s nepřítelem z druhé strany dává 1,5× víc cti a pohne hradbami.
- Každá strana má vlastní tábor (presence kanál `ashes:camp:<strana>`), vlastní kapitoly a hrdinu u brány.
- Kapitoly Legie: Vylodění, Strážní ohně, Tisíc kopí, Poslední štít (boss Eryon, Azkar po boku), Ohně na horách, Pochod k moři (Azkar po boku). Obsah je ve funkci `ashes_chapter_legie()`.
- Obráncům se ve 4. kapitole u brány postaví sám Azkar.

## Kapitoly a písně

| # | Kapitola | Píseň | Boss |
| --- | --- | --- | --- |
| 1 | Bezejmenný břeh | Poslední štít | Kapitán Dorkas |
| 2 | Strážní ohně | Poslední štít | Arhat, velitel zvědů |
| 3 | Tisíc kopí | Poslední štít | Praporečník Rudého slunce |
| 4 | Poslední štít (Eryon po boku, +25 %) | Poslední štít | Azkar, Syn Rudého slunce |
| 5 | Oheň Kalidry | Oheň Kalidry | Pán horských ohňů |
| 6 | Pochod bronzu (Eryon po boku, +25 %) | Pochod bronzu | Kapitán černé flotily |

Obsah kapitol je ve funkci `ashes_chapter()` v migraci `supabase/migrations/20261019180000_ashes_act1.sql`.


## Server

Všechny tabulky (`ashes_characters`, `ashes_items`, `ashes_quests`, `ashes_world`, `ashes_chronicle`) mají RLS jen pro čtení vlastních řádků; zapisují výhradně funkce `SECURITY DEFINER`:

- `ashes_state`, `ashes_create_character`
- `ashes_start_quest`, `ashes_finish_quest`, `ashes_fight_boss` – souboj počítá `ashes_simulate`
- `ashes_train`, `ashes_equip`, `ashes_sell`, `ashes_shop`, `ashes_buy`
- `ashes_arena_opponents`, `ashes_arena_fight`, `ashes_hall_of_fame`
- `ashes_claim_hero`, `ashes_hero_say` (Eryon – správce, Azkar – správce/editor), `ashes_admin_world` (jen správce)

Pomocné funkce (`ashes_simulate`, `ashes_make_item`, `ashes_grant`, …) nejsou klientovi dostupné.

## Klient

- `src/game/ashes/AshesGame.tsx` – obrazovky, souboje, presence, hudba
- `src/game/ashes/three/world.ts` – scéna Bezejmenného břehu (malba v pozadí + 3D popředí), kamery, přehrávání soubojů
- `src/game/ashes/three/figure.ts` – procedurální bronzoví válečníci (štítonoš, lučištník, věštec, Eryon, nepřátelé)
- `src/game/ashes/ui/panels.tsx` – Krčma, Hrdina, Kovárna, Aréna, Hradby, Bard, Kronika, tvorba postavy

## Další kroky

- 2. akt podle dalších písní alba
- cechy a společné výpravy
- vlastní 3D modely (glTF) místo procedurálních postav
