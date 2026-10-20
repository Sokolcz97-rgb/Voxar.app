# Modely pro Ashes of Eryon

Sem patří glTF/GLB modely, které nahradí procedurální grafiku. Stačí přidat soubor
a záznam do `manifest.json`; kód hry se měnit nemusí. Když model chybí, hra kreslí
postavu/zvíře procedurálně.

## Sloty

- Postavy: `figure.hoplit`, `figure.lucistnik`, `figure.vestec`, `figure.eryon`, `figure.azkar`,
  volitelně vojáci Legie `figure.legie.hoplit`, `figure.legie.lucistnik`, `figure.legie.vestec`
- Stavby: `building.house`, `building.tavern`, `building.smithy`, `building.temple`, `building.tent`, `building.hut`
- Zvířata: `animal.sheep`, `animal.goat`, `animal.cow`, `animal.pig`, `animal.dog`, `animal.chicken`,
  `animal.horse`, `animal.stag`, `animal.doe`, `animal.boar`, `animal.wolf`, `animal.bear`, `animal.squirrel`
- Ptáci: `animal.gull`, `animal.tit`, `animal.robin`, `animal.crow`

## Záznam v manifestu

```json
{
  "figure.hoplit": {
    "url": "/game/models/hoplit.glb",
    "scale": 1,
    "rotationY": 0,
    "clips": { "idle": "Idle", "walk": "Walk", "attack": "Attack", "hit": "Hit", "death": "Death", "block": "Block" }
  },
  "animal.cow": {
    "url": "/game/models/cow.glb",
    "scale": 0.8,
    "clips": { "idle": "Idle", "walk": "Walk", "run": "Run" }
  },
  "animal.gull": { "url": "/game/models/gull.glb", "clips": { "fly": "Fly" } }
}
```

## Požadavky na model

- formát **GLB** (glTF binary), textury vložené v souboru, ideálně do 5–10 MB
- nohy v počátku (0, 0, 0), pohled po ose **+Z**, výška postavy ~1,8 jednotky (zvířata v reálné velikosti v metrech)
- postavy s kostrou (rig) a animacemi; názvy klipů se zapisují do `clips`
- zvířatům stačí `idle` a `walk` (případně `run`), ptákům `fly`

Viz `docs/ASHES_GRAPHICS.md`.

## Hráčské postavy (muž / žena)

- `heroes/male.glb` (hoplita) a `heroes/female.glb` (hrdinka s vavřínem) – zjednodušené modely z Meshy,
  bez kostry. Chůzi (nohy / lem šatů) a útok, zásah, pád dělá `three/meshyFigure.ts`.
- `heroes/male.webp`, `heroes/female.webp` – portréty pro výběr postavy.
- Pohlaví je v `appearance.gender` ("m" / "f"); legendy (Eryon, Azkar), bossové a nepřátelé zůstávají procedurální.

## Zvířata z GLB

`animals/*.glb` se načítají přes `world/glbAnimals.ts` (tabulka `GLB_ANIMALS`: velikost, natočení, typ pohybu).
Velké modely se před vložením zmenšují (gltf-transform: simplify + webp textury; chlupaté modely s barvou ve vrcholech).
