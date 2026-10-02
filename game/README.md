# Ashes of Kalidra

This directory is the isolated home of **Ashes of Kalidra**, the new multiplayer dark-fantasy RPG project inside Voxar.app. The title is the approved creative working title pending formal name/trademark clearance.

## Planned structure

- `client/` — 3D game client and UI
- `server/` — authoritative multiplayer game services
- `ai/` — local Story Director runtime and narrative memory
- `launcher/` — dedicated game launcher/installer
- `world/` — world manifests, lore rules and future content modules
- `release/` — release metadata and version manifests

## Core principles

1. Multiplayer is a first-class requirement.
2. The server owns authoritative state.
3. Local AI may propose narrative events but cannot grant items, XP, currency or world-state changes by itself.
4. The game uses its own release namespace: `game-v*`.
5. No game installer is published in Foundation v0.1.
6. The launcher will later reuse the existing StudioVoxario website account system.
7. The game's lore is original and only inspired by broad fantasy traditions.

See `docs/GAME_FOUNDATION.md` for the current architecture contract.
