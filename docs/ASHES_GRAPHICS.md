# Ashes of Eryon – grafika a jak ji vylepšit

Svět 1. aktu je zatím celý **procedurální**: terén, město, stromy i postavy kreslí kód (Three.js).
Hra je ale postavená tak, aby šla grafika vylepšovat po kouscích, bez přepisování herní logiky.

## 1. Kvalita grafiky (už funguje)

Hráč volí v **Nastavení** nízkou, střední nebo vysokou kvalitu (`src/game/ashes/world/assets.ts`, `QUALITY`):

| | Nízká | Střední | Vysoká |
| --- | --- | --- | --- |
| Rozlišení (pixel ratio) | 1 | 1,25 | 1,75 |
| Stíny | ne | 1024 px | 2048 px |
| Stromy | 45 % | 75 % | 100 % |
| Tráva (trsů) | 0 | 1 800 | 4 000 |
| Záře (bloom) | ne | ne | ano |
| Dohled | 110 m | 150 m | 190 m |

Výchozí je vysoká na počítači a střední na dotykových zařízeních. Nová úroveň (např. „ultra“) = nový záznam v `QUALITY`.

## 2. Vlastní 3D modely (glTF / GLB)

Každá postava a budova má **slot**. Když je slot v `public/game/models/manifest.json`, hra místo
procedurální verze načte model. Bez záznamu se kreslí procedurálně – nic se nerozbije.

| Slot | Co nahrazuje |
| --- | --- |
| `figure.hoplit`, `figure.lucistnik`, `figure.vestec` | povolání hráčů, NPC a nepřátel |
| `figure.eryon`, `figure.azkar` | hrdinové stran |
| `building.house`, `building.tavern`, `building.smithy`, `building.temple`, `building.hut`, `building.tent` | stavby v Kalidře a v táborech |

Postup:

1. Model z Blenderu vyexportuj jako **GLB** (glTF binary), postava vysoká ~1,8 jednotky, nohy v počátku, pohled po ose +Z.
2. Ulož ho do `public/game/models/`.
3. Přidej záznam do `manifest.json`:

```json
{
  "figure.hoplit": {
    "url": "/game/models/hoplit.glb",
    "scale": 1,
    "rotationY": 0,
    "clips": { "idle": "Idle", "walk": "Walk", "attack": "Attack", "hit": "Hit", "death": "Death", "block": "Block" }
  },
  "building.tavern": { "url": "/game/models/tavern.glb", "scale": 1 }
}
```

Animace postav se pouští přes `AnimationMixer` (`GltfFigure` v `assets.ts`) – stačí, aby názvy klipů
odpovídaly mapě `clips`. Postava z modelu má stejné rozhraní (`HeroFigure`) jako procedurální,
takže chůze, souboje i rozhovory fungují beze změny.

Doporučené zdroje modelů s licencí pro hry: vlastní tvorba v Blenderu, Quaternius, Kenney (CC0),
Mixamo pro animace postav.

## 3. Procedurální textury (od 20. 10. 2026)

`src/game/ashes/three/textures.ts` vyrábí dlaždicové textury přímo v prohlížeči (bez souborů):
bronz s patinou, kůže, látka, pleť, svalový kyrys (reliéf), tráva, suchá tráva, písek, skála,
cesta, dlažba, omítka, kamenné kvádry, střešní tašky, dřevo a srst zvířat.

- Terén míchá 6 povrchů podle vah ve vrcholech (`splatA`, `splatB`) a vzorkuje je ve dvou měřítcích,
  aby se neopakoval vzor.
- Stavby používají `worldMapped()` – textura se nanáší podle světových souřadnic (triplanárně),
  takže nepotřebují UV a měřítko je všude stejné.
- Scéna má environment mapu z oblohy, kovy (bronz) proto odrážejí okolí.
- Postavy: tvarované hlavy (oči, obočí, nos, ústa, uši, vlasy, vousy), korintská přilba s hřebenem,
  svalový kyrys, pteryges, kolena, sandály, vypouklý štít aspis.

Textury lze kdykoli nahradit obrázky: stačí místo funkce vracet `TextureLoader().load(...)`.

## 4. Kde se kreslí co

| Soubor | Obsah |
| --- | --- |
| `src/game/ashes/world/map.ts` | výšková mapa, cesty, oblasti, rozmístění NPC, nepřátel, staveb |
| `src/game/ashes/world/openWorld.ts` | scéna: obloha, světla, terén, moře, město, vegetace, kamera, pohyb, souboje |
| `src/game/ashes/three/figure.ts` | procedurální válečníci |
| `src/game/ashes/three/fx.ts` | oheň, záře |
| `src/game/ashes/world/assets.ts` | kvalita a registr modelů |

## 5. Další možné kroky

- textury terénu (splat mapa: tráva / písek / skála / cesta) místo barev ve vrcholech
- voda se shaderem (odlesky, pěna u břehu)
- modely stromů a lodí (stromy jsou `InstancedMesh`, model stačí vyměnit za geometrii z GLB)
- denní doba a počasí (posun slunce v `buildLights` a `updateCamera`)
- LOD (méně detailů v dálce) pro slabší zařízení
