# Ashes of Eryon – verze pro Voxario Studio Engine

Projekt hry pro **Voxario Studio Engine** (fáze 8 převodu z Unity, viz
`docs/ASHES_OF_ERYON_PORT.md` v repozitáři enginu). Herní logika je v Lua a server se nemění
(Supabase RPC `ashes_*`, realtime kanál `ashes:world:all`).

## Spuštění

```bash
tools/sync-assets.sh                 # modely, písma a obrázky z Unity verze (Windows: tools\sync-assets.ps1)
VoxarioPlayer .                      # hra
VoxarioPlayer . --selftest selftest  # samotest: záběry jako Unity selftest, pak konec
VoxarioEditor .                      # úpravy v editoru (Play = hra)
VoxarioEditor --build-game . build --name AshesOfEryon   # export hry (potřebuje licenci)
```

Z launcheru se hra přihlásí sama, ticketem v proměnné `ASHES_LAUNCHER_TICKET`. Bez ticketu
zkusí uložené přihlášení a když ani to nevyjde, ukáže přihlašovací formulář (e-mail a heslo účtu
StudioVoxario).

## Struktura

| Soubor | Převod z Unity |
| --- | --- |
| `Assets/Scripts/main.lua` | `GameBootstrap.cs` – přihlášení, stav postavy, vstup do světa, samotest |
| `ashes/worldmap.lua` | `WorldMap.cs` 1:1 – výšková funkce včetně jihu (Solný průsmyk, Rudé písky), cesty, budovy, NPC |
| `ashes/world.lua` | `WorldBuilder.cs`, `TerrainBuilder.cs`, `Scenery.cs`, `DesertScenery.cs`, `Wanderer.cs` |
| `ashes/player.lua` | `PlayerController.cs`, `CameraRig.cs` (kapsle po terénu, kamera ve 3. osobě) |
| `ashes/keybinds.lua` | `KeyBinds.cs` – přenastavitelné klávesy |
| `ashes/hud.lua` | HUD, jmenovky (`NameTag.cs`), rozhovory a úkoly (`NpcDialog.cs`, `content.json`) |
| `ashes/screens.lua` | přihlášení a tvorba postavy (`GameUI.cs`), výběr existující postavy (`CharacterSlots.cs`) |
| `ashes/presence.lua` | `WorldPresence.cs` – ostatní hráči (stejný formát zpráv jako Unity a web) |
| `ashes/sound.lua` | `Music.cs` (album z úložiště `ashes-music`), `Sfx.cs` (zvuky generované v kódu) |
| `ashes/minimap.lua` | `Minimap.cs` – minimapa, velká mapa (M), názvy oblastí a verše při vstupu |
| `ashes/chat.lua` | `Social/Chat.cs` – chat frakce a oddílu (`ashes_chat_send` / `ashes_chat_recent`) |
| `ashes/combat.lua` | `Encounters.cs`, `EncountersLive.cs` – nepřátelé, aktivní boj (`ashes_live_*`), vatry, památník, okno výsledku |
| `ashes/activities.lua` | `WorldBoss.cs`, `Arena.cs`, `Race.cs` |
| `ashes/charwindow.lua` | `CharacterWindow.cs` – postava a trénink, výbava a batoh, kovář |
| `ashes/chronicle.lua` | `Chronicle.cs` – výpravy, strážce kapitoly, denní dar, válka o Kalidru |
| `ashes/guide.lua` | `Guide.cs`, `Waypoint.cs`, `StoryCards.cs` |
| `ashes/feedback.lua` | `Feedback.cs` – hlášení chyb (F1) |
| `ashes/oddil.lua` | `Social/Oddil.cs` |
| `ashes/modhost.lua` | `Mods/*` – módy v sandboxu enginu, stejné `eryon.*` a `ui.*` jako v Unity verzi |
| `ashes/pose.lua` | bojové pózy z `CharacterView.cs` (výpad, zásah, pád) |
| `tools/package-game.sh` | složení hry z VoxarioPlayeru (jako `--build-game`, bez licence editoru – pro CI) |
| `ashes/options.lua` | nastavení: zobrazení, grafika, zvuk, ovládání, účet |
| `ashes/skin.lua` | `EryonSkin.cs` – barvy, písma Cinzel / Cormorant, panely |
| `tools/make_scenery_models.py` | modely krajiny (cypřiš, olivovník, kámen, tráva, palma) jako `MeshKit` |
| `tools/make_ui_textures.py` | textury rámů a tlačítek jako `EryonSkin.Frame` |

Souřadnice jsou webové (x, z) a engine je kreslí bez převrácení, protože je pravotočivý jako Three.js.
Poloha posílaná ostatním hráčům je proto stejná jako u webu i Unity.

## Stav převodu (fáze 8)

- [x] Krok 1: přihlášení (ticket z launcheru, uložená relace, formulář), `ashes_state`, tvorba postavy,
  přepnutí na existující postavu, novinky a stav serveru na přihlašovací obrazovce.
- [x] Krok 2: celý svět 1. aktu (terén severu i jihu, moře, oáza, Kalidra, NPC, zvířata, krajina,
  akvadukt, lodě, tábor Legie, ruiny). Den a noc podle pražského času.
- [x] Krok 3: hráč, kamera (neprochází kmeny, budovy ani koruny stromů), klávesy, návrat do bezpečí (T),
  uložení polohy, ukazatel cíle.
- [x] Krok 4: rozhovory s NPC, úkoly, značky `!` a `?`, Rádce, příběhové karty.
- [x] Krok 5: boj – nepřátelé v oblastech, aktivní boj (útok, dovednost, úhyb, blok), vatry, památník,
  světový boss Thalassos, aréna (soupeři, síň slávy, cvičný zápas), běh kolem mét.
- [x] Krok 6: okna postavy, batohu a kováře, kronika, minimapa a mapa, hlášení chyb (F1).
- [x] Krok 7: ostatní hráči, chat Svět / Oddíl, oddíl.
- [x] Krok 8: hudba a zvuky.
- [x] Krok 9: módy (`Dokumenty/Ashes of Eryon/Mods`, ukázka Deník poutníka, nastavení → Módy, F8).
- [x] Procedurální chůze nohou (`LegRig.cs`): kroky počítá vertex shader enginu (`entity.set_gait`) – nohy
  v kyčlích s pokrčením kolene, paže proti nohám (ruka se štítem, lukem nebo holí zůstává), u sukní jen
  lem, čtyřnožci diagonální páry.

## Grafika a výkon (beta 0.11.0-beta.4, engine 1.6.0)

- **VSync** používá MAILBOX (trojité bufferování), takže se FPS nepůlí; v nastavení je limit FPS 30/60/120/144.
- **Nastavení** jako v Unity verzi (Grafika, Zobrazení, Zvuk, Ovládání, Módy, Postavy): předvolby Nízká–Ultra,
  DLSS / AMD FSR 1 / vlastní měřítko, stíny, dohled, hustota trávy, mraky, kvalita vody, ray tracing (jen na kartách
  s Vulkan ray query), režim okna, V-Sync, limit FPS, přepínání postav a nová postava.
- **Obloha**: dvě vrstvy animovaných mraků ve dne i v noci, stín mraků na zemi.
- **Voda**: až 12 vln a hustší síť, drobné vlnky, pěna u břehu a na hřebenech, průhledná mělčina s kaustikami.
- **Krajina**: prolínání povrchů podle výšky, detailní normála, víc trávy, keře, vítr, LOD s plynulým prolnutím.
- **Noc**: modré měsíční světlo, noční ambient a světlo u hráče.
- **Měření výkonu**: `VoxarioPlayer . --benchmark 20 --benchmark-out vysledek.json` obíhá svět se zkušební postavou
  a zapíše FPS i časy CPU; `ASHES_PROFILE=1` vypíše, kolik stojí jednotlivé části skriptu.

## Sestavení a testy (fáze 9)

Workflow `.github/workflows/voxario-game.yml` (při změně `game/voxario/**` nebo ručně):

1. stáhne Voxario Studio z release enginu (secret `VOXARIO_ENGINE_TOKEN`, čtení repozitáře enginu),
2. složí hru `tools/package-game.sh` pro Linux i Windows,
3. pustí samotest na softwarovém Vulkanu ve dne (`--time 13`) – shodí ho chyba skriptu, chybějící
   `SELFTEST hotovo` nebo málo záběrů; artefakt `AshesOfEryon-selftest` má všechny záběry a log,
3b. hotovou hru pro Windows spustí na Windows runneru (Mesa lavapipe) a vyfotí (`AshesOfEryon-windows-test`),
4. artefakty `AshesOfEryon-Windows` (hotová hra) a `AshesOfEryon-beta-upload` (soubory a
   `latest-beta.json` pro launcher),
5. ruční spuštění s `publish_beta` je nahraje do `game-updates/unity/` (secret
   `SUPABASE_SERVICE_ROLE_KEY`). Hráči s launcherem přepnutým na **testovací kanál** dostanou
   tuto verzi, ostatní dál Unity verzi z `latest.json`.
