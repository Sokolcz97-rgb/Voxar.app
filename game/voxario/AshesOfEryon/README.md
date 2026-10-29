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
- [x] Krok 3: hráč, kamera, klávesy, návrat do bezpečí (T), uložení polohy.
- [x] Krok 4 (část): rozhovory s NPC, úkoly (nabídka, přijetí, odevzdání, „promluv si“), značky `!` a `?`.
- [x] Krok 7 (část): ostatní hráči přes Realtime (presence a poloha).
- [x] Krok 8: hudba a zvuky.
- [ ] Krok 4: Rádce (`Guide.cs`), příběhové karty (`StoryCards.cs`).
- [ ] Krok 5: boj (`Encounters*.cs`, `WorldBoss.cs`, `Arena.cs`, `Race.cs`).
- [ ] Krok 6: okna postavy, batohu a kováře, kronika, minimapa, hlášení chyb.
- [ ] Krok 7: chat a oddíl (`Social/*`).
- [ ] Krok 9: módy (`Mods/*`, engine má `voxario.mods`).
- [ ] Procedurální chůze nohou (`LegRig.cs`). Zatím se postavy jen pohupují a naklánějí, protože modely
  hry nemají kostru.
