# Ashes of Eryon – 1. akt „Poslední štít“ (alfa)

První hratelná verze hry. Sága má 6 aktů: Poslední štít, Oheň Kalidry, Pochod bronzu, Moře krve, Koruna popela, Poslední pochod. Hratelný je 1. akt; kapitoly 5 a 6 jsou ukázkou 2. a 3. aktu. Běží jako 3D hra v prohlížeči na `/hra` a launcher Ashes ji otevírá ve vlastním okně.

## Rozhodnutí

| Otázka | Rozhodnutí |
| --- | --- |
| Engine | Three.js (WebGL) uvnitř webu StudioVoxario, načítá se zvlášť (lazy chunk) |
| Herní smyčka | Otevřený 3D svět ve stylu Vampire's Fall 2 (chůze po mapě, NPC s úkoly, nepřátelé v krajině) + prvky Shakes & Fidget (výpravy na čas, výbava, výcvik, aréna) |
| Jazyk | Primárně čeština, celá hra i v angličtině (přepínač CZ/EN, `src/game/ashes/i18n.ts`, `content-en.ts`) |
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
- Každá strana má vlastní část světa a realtime kanál `ashes:world:<strana>` (presence + pozice hráčů), vlastní kapitoly a hrdinu.
- Kapitoly Legie: Vylodění, Strážní ohně, Tisíc kopí, Poslední štít (boss Eryon, Azkar po boku), Ohně na horách, Pochod k moři (Azkar po boku). Obsah je ve funkci `ashes_chapter_legie()`.
- Obráncům se ve 4. kapitole u brány postaví sám Azkar.

## Otevřený svět

Mapa pobřeží Kalidry (250 × 250 m): Bezejmenný břeh, Akvadukt, Kopce strážních ohňů, Pláň před branou, Kalidra, Zátoka černých plachet a Tábor Legie.

- Ovládání: WASD/šipky nebo klik/dotyk, **E** mluvit/použít, **Q** nebo pravé tlačítko otáčí kamerou, kolečko přibližuje.
- Nepřátelé se toulají svými oblastmi; když hráče dostihnou, začne souboj na místě (`ashes_world_fight`, 3 s odpočinek). Po porážce se hráč probudí v bezpečí u svých.
- NPC (9 za obránce, 7 za Legii) mají rozhovory, otázky na svět a úkoly; obchodník, hostinský, bard, mistr arény a hrdina otevírají příslušné panely.
- Úkoly od NPC: obránci k1–k8, Legie l1–l7 (typy rozhovor, porážka nepřátel, vatry, návštěva místa). Pravidla jsou na serveru (`ashes_wq_catalog`, `ashes_wq_accept`, `ashes_wq_event`, `ashes_wq_turnin`), texty v `src/game/ashes/world/npcContent.ts`. Každý odevzdaný úkol posouvá kapitolu.
- Minimapa, deník úkolů, značky ! a ? nad postavami, poloha se pamatuje v prohlížeči.
- Grafika je připravená na vylepšení – viz `docs/ASHES_GRAPHICS.md`.

## Kapitoly a písně

| # | Kapitola | Píseň | Boss |
| --- | --- | --- | --- |
| 1 | Bezejmenný břeh | Poslední štít | Kapitán Dorkas |
| 2 | Strážní ohně | Poslední štít | Arhat, velitel zvědů |
| 3 | Tisíc kopí | Poslední štít | Praporečník Rudého slunce |
| 4 | Poslední štít (Eryon po boku, +25 %) – konec 1. aktu | Poslední štít | Azkar, Syn Rudého slunce |
| 5 | Oheň Kalidry (ukázka 2. aktu) | Oheň Kalidry | Pán horských ohňů |
| 6 | Pochod bronzu (ukázka 3. aktu, Eryon po boku, +25 %) | Pochod bronzu | Kapitán černé flotily |

Obsah kapitol je ve funkci `ashes_chapter()` v migraci `supabase/migrations/20261019180000_ashes_act1.sql`.


## Server

Všechny tabulky (`ashes_characters`, `ashes_items`, `ashes_quests`, `ashes_world`, `ashes_chronicle`) mají RLS jen pro čtení vlastních řádků; zapisují výhradně funkce `SECURITY DEFINER`:

- `ashes_state`, `ashes_create_character`
- `ashes_start_quest`, `ashes_finish_quest`, `ashes_fight_boss` – souboj počítá `ashes_simulate`
- `ashes_train`, `ashes_equip`, `ashes_sell`, `ashes_shop`, `ashes_buy`
- `ashes_arena_opponents`, `ashes_arena_fight`, `ashes_hall_of_fame`
- `ashes_wq_accept`, `ashes_wq_event`, `ashes_wq_turnin`, `ashes_world_fight` – otevřený svět (migrace `20261019210000_ashes_open_world.sql`)
- `ashes_claim_hero`, `ashes_hero_say` (Eryon – správce, Azkar – správce/editor), `ashes_admin_world` (jen správce)

Pomocné funkce (`ashes_simulate`, `ashes_make_item`, `ashes_grant`, …) nejsou klientovi dostupné.

## Klient

- `src/game/ashes/AshesGame.tsx` – obrazovky, rozhovory, souboje, presence, hudba
- `src/game/ashes/world/` – otevřený svět (`openWorld.ts`), mapa, NPC a úkoly, kvalita a modely
- `src/game/ashes/ui/worldPanels.tsx`, `ui/Minimap.tsx` – rozhovor, deník, nastavení, minimapa
- `src/game/ashes/i18n.ts`, `content-en.ts` – čeština a angličtina
- `src/game/ashes/three/figure.ts` – procedurální bronzoví válečníci (štítonoš, lučištník, věštec, Eryon, nepřátelé)
- `src/game/ashes/ui/panels.tsx` – Krčma, Hrdina, Kovárna, Aréna, Hradby, Bard, Kronika, tvorba postavy

## Další kroky

- 2. akt „Oheň Kalidry“ jako další část otevřeného světa
- cechy a společné výpravy
- vlastní 3D modely (glTF) místo procedurálních postav
