# Modely pro Ashes of Eryon

Sem patří glTF/GLB modely, které nahradí procedurální grafiku. Stačí přidat soubor
a záznam do `manifest.json`; kód hry se měnit nemusí.

Sloty: `figure.hoplit`, `figure.lucistnik`, `figure.vestec`, `figure.eryon`, `figure.azkar`,
`building.house`, `building.tavern`, `building.smithy`, `building.temple`, `building.tent`, `building.hut`.

```json
{
  "figure.hoplit": {
    "url": "/game/models/hoplit.glb",
    "scale": 1,
    "rotationY": 0,
    "clips": { "idle": "Idle", "walk": "Walk", "attack": "Attack", "hit": "Hit", "death": "Death", "block": "Block" }
  }
}
```

Postava má mít výšku přibližně 1,8 jednotky, nohy v počátku a dívat se po ose +Z.
Viz `docs/ASHES_GRAPHICS.md`.
