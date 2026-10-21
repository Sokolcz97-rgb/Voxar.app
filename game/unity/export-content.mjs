// Převede texty NPC a úkolů z webové verze do JSON pro Unity:
//   node --experimental-strip-types game/unity/export-content.mjs
import { writeFileSync } from "node:fs";
const m = await import("../../src/game/ashes/world/npcContent.ts");
const quests = m.WQUESTS.map((q) => ({
  id: q.id, faction: q.faction, giver: q.giver, type: q.type, target: q.target, count: q.count, req: q.req,
  title: q.title.cs, offer: q.offer.cs, objective: q.objective.cs, done: q.done.cs, goalNpc: q.goal?.npc ?? "",
}));
const npcs = Object.entries(m.NPC_TALK).map(([id, t]) => ({ id, greet: t.greet.cs, lore: t.lore.map((l) => ({ q: l.q.cs, a: l.a.cs })) }));
writeFileSync(new URL("./AshesOfEryon/Assets/Voxario/Resources/content.json", import.meta.url), JSON.stringify({ quests, npcs }, null, 1));
console.log(`${quests.length} úkolů, ${npcs.length} NPC`);
