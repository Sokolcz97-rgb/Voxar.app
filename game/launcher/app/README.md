# Ashes of Eryon Launcher Runtime

This directory contains the first real desktop runtime for the approved Ashes of Eryon launcher UI.

## Current scope

Implemented:
- standalone Electron runtime
- frameless Windows window
- secure preload bridge
- context isolation
- Node.js disabled in renderer
- sandboxed renderer
- custom minimize / maximize / close bridge
- external HTTP(S) links open in the system browser
- approved launcher prototype loaded as the renderer
- development build can be packaged as an unpacked Windows application

Not implemented yet:
- StudioVoxario account handoff
- real game installer/downloader
- updater
- file repair
- real server status
- news backend
- Game.exe launch
- installer EXE
- GitHub release publishing

## Testovací kanál hry

Nastavení → **Kanál hry**: *Ostrý* čte `game-updates/unity/latest.json`, *Testovací* čte
`game-updates/unity/latest-beta.json` (verze Ashes of Eryon na Voxario Studio Engine, workflow
`.github/workflows/voxario-game.yml`). Testovací verze se instaluje do vlastní složky (`Game-beta`,
případně `%LOCALAPPDATA%\StudioVoxario\AshesOfEryon-beta`), takže ostrá instalace zůstane a přepnutí
zpět nic nestahuje. Spuštění, lístek přihlášení i aktualizace fungují stejně.

## Development

From `game/launcher/app`:

```bash
npm install
npm run check
npm start
```

## Build unpacked Windows runtime

```bash
npm run pack:win
```

This produces an unpacked test build under `dist/`.

It intentionally does **not** produce or publish `GameSetup.exe`.

## Renderer source

During development the runtime loads:

```
../prototype/index.html
```

Packaged builds include the same prototype directory as `launcher-ui` under Electron resources.

The visual source of truth remains:
- `../design/APPROVED_VISUAL_REFERENCE_V0.1.md`
- `../design/LAUNCHER_DESIGN_SPEC_V0.1.md`

## Automatické aktualizace (od 0.2.0)

Launcher si sám stahuje nové verze svých souborů (`resources/app.asar` a `resources/launcher-ui`)
z veřejného bucketu `game-updates/launcher/` – bez nové instalace. Logika je v `updater.cjs`.

Vydání aktualizace:
1. zvýšit `version` v `package.json`,
2. CI (Ashes of Eryon GameSetup Check) vytvoří artefakt `Ashes-of-Eryon-launcher-update`,
3. `node make-update.cjs <rozbalený artefakt> <výstup>` připraví soubory a `latest.json`,
4. nahrát `<verze>/…` a nakonec `latest.json` do `game-updates/launcher/`.

Hra samotná se nestahuje – herní okno vždy načítá aktuální studiovoxario.com/hra.
Když nová verze potřebuje jiný Electron, launcher nabídne stáhnout nový GameSetup.
