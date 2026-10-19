import type { Faction, WQuest } from "../types";
import { BEACONS, ENEMY_CAMPS, MEMORIAL, NPCS, type NpcId } from "./map";
import { WQUESTS, type WQuestDef } from "./npcContent";

/** Pomocné funkce pro úkoly od NPC (pravidla drží server, tady jen zobrazení). */

export const questDef = (id: string) => WQUESTS.find((q) => q.id === id);

/** U koho se úkol odevzdává: u rozhovorových úkolů u cílového NPC, jinak u zadavatele. */
export const turnInNpc = (def: WQuestDef): NpcId => (def.type === "talk" ? (def.target as NpcId) : def.giver);

export function questMap(list: WQuest[] | undefined) {
  const map = new Map<string, WQuest>();
  for (const q of list ?? []) map.set(q.quest_id, q);
  return map;
}

/** Úkoly, které hráč může přijmout (splněné požadavky, ještě nepřijaté). */
export function availableQuests(faction: Faction, list: WQuest[] | undefined) {
  const map = questMap(list);
  return WQUESTS.filter((q) => q.faction === faction && !map.has(q.id) && q.req.every((r) => map.get(r)?.state === "done"));
}

export type NpcMark = "offer" | "ready" | "goal" | null;

/** Značka nad hlavou NPC: ! = nový úkol, ? = odevzdat, · = cíl rozhovoru. */
export function npcMark(npc: NpcId, faction: Faction, list: WQuest[] | undefined): NpcMark {
  const map = questMap(list);
  for (const def of WQUESTS) {
    if (def.faction !== faction) continue;
    const q = map.get(def.id);
    if (q?.state === "ready" && turnInNpc(def) === npc) return "ready";
  }
  for (const def of WQUESTS) {
    if (def.faction !== faction) continue;
    const q = map.get(def.id);
    if (q?.state === "active" && def.type === "talk" && def.target === npc) return "ready";
  }
  if (availableQuests(faction, list).some((q) => q.giver === npc)) return "offer";
  return null;
}

/** Body na mapě, kam má hráč jít. */
export function questTargets(faction: Faction, list: WQuest[] | undefined) {
  const out: { x: number; z: number; kind: "ready" | "goal" | "offer" }[] = [];
  const map = questMap(list);
  const npcPos = (id: NpcId) => NPCS.find((n) => n.id === id);
  for (const def of WQUESTS) {
    if (def.faction !== faction) continue;
    const q = map.get(def.id);
    if (!q || q.state === "done") continue;
    if (q.state === "ready") {
      const n = npcPos(turnInNpc(def));
      if (n) out.push({ x: n.x, z: n.z, kind: "ready" });
      continue;
    }
    if (def.type === "talk") {
      const n = npcPos(def.target as NpcId);
      if (n) out.push({ x: n.x, z: n.z, kind: "goal" });
    } else if (def.type === "beacon") {
      for (const b of BEACONS) if (!q.targets.includes(b.id)) out.push({ x: b.x, z: b.z, kind: "goal" });
    } else if (def.type === "visit") {
      out.push({ x: MEMORIAL.x, z: MEMORIAL.z, kind: "goal" });
    } else if (def.goal?.region) {
      const camp = ENEMY_CAMPS.find((c) => c.region === def.goal?.region);
      if (camp) out.push({ x: camp.x, z: camp.z, kind: "goal" });
    }
  }
  for (const def of availableQuests(faction, list)) {
    const n = npcPos(def.giver);
    if (n) out.push({ x: n.x, z: n.z, kind: "offer" });
  }
  return out;
}

/** Stav strážních vater: obránci je zapalují, Legie je hasí. */
export function beaconsLit(faction: Faction, list: WQuest[] | undefined) {
  const map = questMap(list);
  const q = map.get(faction === "legie" ? "l4" : "k4");
  const out: Record<string, boolean> = {};
  for (const b of BEACONS) {
    const touched = q?.state === "done" || q?.state === "ready" || !!q?.targets.includes(b.id);
    out[b.id] = faction === "legie" ? !touched : touched;
  }
  return out;
}
