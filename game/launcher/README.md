# Game Launcher / Installer

The game launcher is a separate product surface from the current StudioVoxario desktop launcher and from the existing website `/launcher` route.

## Planned responsibilities

- first-time installation
- update/repair
- version/channel handling
- sign-in through the existing StudioVoxario web account
- news/server status
- launching the game

## Important route boundary

The existing website already uses `/launcher` for StudioVoxario Hub. The game's browser authentication handoff will use a separate route namespace rather than replacing that route.

Proposed namespace for future implementation:

```
/game/auth/launcher
/game/auth/launcher/complete
```

These routes are only reserved by the specification for now; they are not implemented in Foundation v0.1.

## Design rule

Implementation starts only after a reference design is frozen. Layout, typography, spacing, states and assets must be specified explicitly and later checked with screenshot comparison.

Codex is an implementer of the approved design, not the designer of last resort.

## Early distribution

During development the launcher/game will be distributed through dedicated GitHub `game-v*` releases.

Foundation v0.1 does not publish or attach a `GameSetup.exe`.

## Specifications

- `spec/LAUNCHER_FOUNDATION.md`
- `spec/AUTH_HANDOFF.md`
- `spec/UPDATE_PROTOCOL.md`
- `spec/INSTALLER_CONTRACT.md`
- `spec/ui-contract.json`
- `spec/launcher-state.example.json`
