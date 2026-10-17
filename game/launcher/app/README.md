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
