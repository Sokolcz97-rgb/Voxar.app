# Multiplayer Server

The multiplayer server is the authoritative source of truth for shared game state.

Planned responsibilities include:
- authentication/session verification
- characters and progression
- inventory and equipment
- turn-based combat resolution
- factions and reputation
- shared world state
- parties/guilds
- event validation
- persistence

Early hosting may use Railway, but the service boundaries should remain portable.

## AI boundary

Local AI-generated story proposals must be validated here before they can change multiplayer state.
