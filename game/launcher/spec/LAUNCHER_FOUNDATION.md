# Launcher Foundation v0.1

The game launcher is a separate product surface from Voxar.app and VoxarioBrowser.

## Product goals

- One polished custom launcher for install, update, repair, sign-in and launch.
- No basic NSIS wizard exposed as the primary user experience.
- Reuse the existing StudioVoxario web account identity.
- Keep passwords out of the launcher.
- Early game builds are sourced from dedicated GitHub `game-v*` releases.
- Later distribution can move behind the StudioVoxario website without changing the launcher contract.
- The implementation must match an approved visual reference instead of improvising layout.

## Launcher states

1. BOOT
2. FIRST_RUN
3. SIGNED_OUT
4. AUTH_IN_PROGRESS
5. READY_TO_INSTALL
6. INSTALLING
7. READY_TO_PLAY
8. CHECKING_UPDATE
9. UPDATE_AVAILABLE
10. UPDATING
11. VERIFYING
12. REPAIR_REQUIRED
13. REPAIRING
14. OFFLINE
15. MAINTENANCE
16. ERROR

Every visible control must have a defined behavior in every relevant state.

## Required screens

### First run
- language
- install location
- disk-space summary
- terms/privacy links
- sign-in or continue to install when allowed
- no Windows-style Next/Next/Finish chrome

### Signed out
- primary action: Sign in with StudioVoxario
- registration opens the existing website account flow
- launcher never asks for or stores the website password directly

### Home
- current account/avatar
- news/world event area
- install/update state
- server status
- game version/channel
- primary Play/Install/Update action
- settings
- repair files
- logout

### Download/update
- total progress
- current file/package
- downloaded / total bytes
- transfer speed
- optional pause/cancel only when safe
- clear verification phase after download

### Error/recovery
- human-readable message
- diagnostic code
- retry
- repair when relevant
- link to support

## Visual implementation contract

The launcher must not be implemented from a screenshot alone.

Before production UI implementation, the approved reference must be accompanied by:

- canvas size
- component bounding boxes
- spacing tokens
- typography tokens
- color tokens
- corner radii
- opacity/blur values
- image assets
- icon assets
- hover/pressed/disabled states
- loading states
- logged-in/logged-out states
- install/update/repair states

A screenshot test must render the launcher at the reference viewport and compare it against the approved reference.

Codex is not allowed to redesign the UI while implementing it. Any deliberate visual deviation requires a spec change first.

## Security boundaries

The launcher may:
- hold a short-lived launcher/game session token
- read signed release manifests
- download and verify game content
- launch the local game

The launcher may not:
- store the user's website password
- mint authoritative game rewards/state
- trust unsigned update metadata
- accept arbitrary local AI output as multiplayer truth

## Release boundaries

The launcher belongs to the game release namespace.

- Voxar.app: existing release path
- VoxarioBrowser: existing release path
- Game: `game-v*`

Foundation v0.1 does not publish an installer.
