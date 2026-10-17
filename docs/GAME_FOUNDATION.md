# Game Foundation v0.1

This document defines the initial technical boundaries for the new multiplayer fantasy game inside the existing Voxar.app repository.

## Goals

- Keep the game isolated under `game/`.
- Keep existing Voxar.app desktop/browser release behavior unchanged.
- Build multiplayer into the architecture from the beginning.
- Use a local AI Story Director without requiring a paid inference API.
- Keep authoritative game state on the server.
- Reuse the existing StudioVoxario web account system later for launcher/game authentication.
- Design the future game installer/launcher from scratch rather than reusing the current Voxar.app installer UI.
- Publish game releases separately using `game-v*` tags.
- Do not publish a game installer yet.

## Architecture boundary

### Client
Responsible for 3D rendering, input, UI, presentation, animation, audio and local interaction flow.

### Multiplayer server
Authoritative source for:
- player progression
- inventory
- combat results
- economy
- faction reputation
- world state
- shared quests and multiplayer events

The client and local AI are never trusted to directly mutate authoritative state.

### Local AI Story Director
Runs on the player's hardware. Its responsibilities may include:
- dialogue generation
- personal story interpretation
- quest/event proposals
- NPC reactions
- local narrative memory

Any proposal that changes authoritative multiplayer state must be validated by the server.

### Launcher
Future launcher responsibilities:
- web-account sign-in
- install/update/repair
- game version selection
- news/status
- game start
- future GitHub Release based bootstrap during early development

The launcher visual design must be frozen before implementation and checked against reference screenshots.

## Release policy

Existing Voxar.app releases remain separate.

Game releases use the tag format:

```
game-v0.1.0-alpha
game-v0.1.1-alpha
game-v0.2.0-alpha
```

The initial game workflow creates a prerelease only. It intentionally does not build or attach `GameSetup.exe`.

## Authentication direction

The game must not create a second unrelated account database.

Target flow:

```
StudioVoxario web account
        ↓
browser-based sign-in
        ↓
one-time authorization handoff
        ↓
launcher session
        ↓
multiplayer game session
```

The current website authentication implementation must be inspected before this integration is implemented. Passwords must not be stored directly by the launcher.

## Current scope

Game Foundation v0.1 establishes repository structure and contracts only. It intentionally does not choose a final game engine, ship a playable client, publish an installer, or modify the current Voxar.app release pipeline.
