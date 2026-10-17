# Local Story Director

The Story Director is intended to run locally on the player's hardware using a freely available local model/runtime rather than a paid inference API.

Planned responsibilities:
- dialogue
- narrative reactions
- personal quest/event proposals
- player-specific story memory
- interpretation of discovered lore

The AI is non-authoritative. It cannot directly grant rewards, alter shared world state, decide combat math or create trusted multiplayer facts.

A future runtime may use a GGUF-compatible backend such as llama.cpp, but Foundation v0.1 does not lock a model or inference engine.
