import { useState } from "react";
import { BookOpen, Check, Coins, Hammer, Beer, Music, Swords, Castle, X } from "lucide-react";
import type { Faction, GameState } from "../types";
import { L, getLang, setLang, useLang } from "../i18n";
import { NPCS, REGION_NAME, type NpcId, type RegionId } from "../world/map";
import { NPC_TALK, WQUESTS, type WQuestDef } from "../world/npcContent";
import { availableQuests, questMap, turnInNpc } from "../world/quests";
import { getQuality, type Quality } from "../world/assets";
import { PanelShell } from "./panels";

const t = (x: { cs: string; en: string }) => (getLang() === "en" ? x.en : x.cs);

export type NpcOpens = "krcma" | "kovarna" | "bard" | "arena" | "hradby";

const OPEN_LABEL: Record<NpcOpens, { icon: typeof Beer; cs: string; en: string; csL?: string; enL?: string }> = {
  krcma: { icon: Beer, cs: "Ukaž mi práci na výpravy", en: "Show me expedition work" },
  kovarna: { icon: Hammer, cs: "Ukaž mi zboží", en: "Show me your wares" },
  bard: { icon: Music, cs: "Zahraj mi", en: "Play for me" },
  arena: { icon: Swords, cs: "Chci do arény", en: "I want to fight in the arena" },
  hradby: { icon: Castle, cs: "Jak stojí válka?", en: "How goes the war?" },
};

type View =
  | { kind: "root" }
  | { kind: "offer"; quest: WQuestDef }
  | { kind: "done"; quest: WQuestDef }
  | { kind: "progress"; quest: WQuestDef }
  | { kind: "lore"; index: number };

/** Rozhovor s NPC – nabídka úkolů, odevzdání, otázky na svět a služby (obchod, krčma…). */
export function Dialogue({
  npc, state, busy, onAccept, onTurnIn, onOpen, onClose,
}: {
  npc: NpcId;
  state: GameState;
  busy: boolean;
  onAccept: (quest: string) => void;
  onTurnIn: (quest: string) => void;
  onOpen: (panel: NpcOpens) => void;
  onClose: () => void;
}) {
  useLang();
  const [view, setView] = useState<View>({ kind: "root" });
  const def = NPCS.find((n) => n.id === npc);
  const talk = NPC_TALK[npc];
  if (!def || !talk) return null;
  const faction = (state.character?.faction ?? "kalidra") as Faction;
  const map = questMap(state.wquests);
  const offers = availableQuests(faction, state.wquests).filter((q) => q.giver === npc);
  const ready = WQUESTS.filter((q) => q.faction === faction && map.get(q.id)?.state === "ready" && turnInNpc(q) === npc);
  const active = WQUESTS.filter((q) => q.faction === faction && q.giver === npc && map.get(q.id)?.state === "active");

  let line = t(talk.greet);
  if (view.kind === "offer") line = t(view.quest.offer);
  if (view.kind === "done") line = t(view.quest.done);
  if (view.kind === "progress") {
    const q = map.get(view.quest.id);
    line = `${t(view.quest.objective)}${view.quest.count > 1 ? ` (${q?.progress ?? 0}/${view.quest.count})` : ""}. ${L("Vrať se, až to bude hotové.", "Come back when it's done.")}`;
  }
  if (view.kind === "lore") line = t(talk.lore[view.index].a);

  return (
    <section className="ash-dialogue ash-frame" aria-label={t(def.name)}>
      <header>
        <div>
          <div className="ash-kicker">{t(def.role)}</div>
          <h2 className="ash-title">{t(def.name)}</h2>
        </div>
        <button className="ash-icon-btn" onClick={onClose} aria-label={L("Zavřít", "Close")}><X className="h-4 w-4" /></button>
      </header>
      {(view.kind === "offer" || view.kind === "done" || view.kind === "progress") && <div className="ash-kicker quest-name">{t(view.quest.title)}</div>}
      <p className="line">„{line}“</p>
      <div className="options">
        {view.kind === "root" && (
          <>
            {ready.map((q) => (
              <button key={q.id} className="opt ready" onClick={() => setView({ kind: "done", quest: q })}><b>?</b> {t(q.title)}</button>
            ))}
            {offers.map((q) => (
              <button key={q.id} className="opt offer" onClick={() => setView({ kind: "offer", quest: q })}><b>!</b> {t(q.title)}</button>
            ))}
            {active.map((q) => (
              <button key={q.id} className="opt" onClick={() => setView({ kind: "progress", quest: q })}><BookOpen /> {t(q.title)}</button>
            ))}
            {talk.lore.map((x, i) => (
              <button key={i} className="opt" onClick={() => setView({ kind: "lore", index: i })}>{t(x.q)}</button>
            ))}
            {def.opens && (() => {
              const o = OPEN_LABEL[def.opens];
              return <button className="opt service" onClick={() => onOpen(def.opens!)}><o.icon /> {getLang() === "en" ? o.en : o.cs}</button>;
            })()}
            <button className="opt muted" onClick={onClose}>{L("Sbohem.", "Farewell.")}</button>
          </>
        )}
        {view.kind === "offer" && (
          <>
            <div className="objective"><Check /> {t(view.quest.objective)}{view.quest.count > 1 ? ` · 0/${view.quest.count}` : ""}</div>
            <button className="ash-btn" disabled={busy} onClick={() => { onAccept(view.quest.id); setView({ kind: "root" }); }}>{L("Přijmout úkol", "Accept quest")}</button>
            <button className="opt muted" onClick={() => setView({ kind: "root" })}>{L("Teď ne.", "Not now.")}</button>
          </>
        )}
        {view.kind === "done" && (
          <button className="ash-btn" disabled={busy} onClick={() => { onTurnIn(view.quest.id); setView({ kind: "root" }); }}><Coins className="h-4 w-4" /> {L("Převzít odměnu", "Claim reward")}</button>
        )}
        {(view.kind === "progress" || view.kind === "lore") && (
          <button className="opt muted" onClick={() => setView({ kind: "root" })}>{L("Zpět", "Back")}</button>
        )}
      </div>
    </section>
  );
}

/** Deník úkolů. */
export function JournalPanel({ state, onClose }: { state: GameState; onClose: () => void }) {
  useLang();
  const faction = (state.character?.faction ?? "kalidra") as Faction;
  const map = questMap(state.wquests);
  const mine = WQUESTS.filter((q) => q.faction === faction);
  const open = mine.filter((q) => map.get(q.id) && map.get(q.id)!.state !== "done");
  const done = mine.filter((q) => map.get(q.id)?.state === "done");
  const offers = availableQuests(faction, state.wquests);
  const npcName = (id: NpcId) => {
    const n = NPCS.find((x) => x.id === id);
    return n ? t(n.name) : id;
  };
  const where = (q: WQuestDef) => {
    const w = map.get(q.id);
    if (w?.state === "ready") return `${L("Odevzdej", "Turn in to")}: ${npcName(turnInNpc(q))}`;
    if (q.type === "talk") return `${L("Najdi", "Find")}: ${npcName(q.target as NpcId)}`;
    if (q.type === "beacon") return REGION_NAME.hills[getLang()];
    if (q.type === "visit") return L("Památník padlých na pláni", "Memorial of the Fallen on the plain");
    if (q.goal?.region) return REGION_NAME[q.goal.region as RegionId]?.[getLang()] ?? "";
    return "";
  };
  return (
    <PanelShell title={L("Deník", "Journal")} kicker={L("Akt I · Poslední štít", "Act I · The Last Shield")} onClose={onClose}>
      <div className="ash-kicker mb-2">{L("Rozpracované úkoly", "Active quests")}</div>
      {open.length === 0 && <p className="text-sm text-[var(--ash-muted)]">{L("Žádný rozpracovaný úkol. Hledej postavy se znakem ! nad hlavou.", "No active quests. Look for characters with ! above their heads.")}</p>}
      {open.map((q) => {
        const w = map.get(q.id)!;
        return (
          <div key={q.id} className={`ash-card ${w.state === "ready" ? "hl" : ""}`}>
            <h3 className="ash-title m-0 text-base">{t(q.title)}</h3>
            <div className="ash-meta mt-1">
              <span>{t(q.objective)}</span>
              {q.count > 1 && <b>{w.progress}/{q.count}</b>}
              {w.state === "ready" && <b className="text-[var(--ash-good)]">{L("splněno", "complete")}</b>}
            </div>
            <div className="ash-meta mt-1"><span>◆ {where(q)}</span></div>
          </div>
        );
      })}
      {offers.length > 0 && (
        <>
          <div className="ash-kicker mb-2 mt-4">{L("Kdo pro tebe má práci", "Who has work for you")}</div>
          {offers.map((q) => (
            <div key={q.id} className="ash-card"><b className="text-[var(--ash-gold-2)]">!</b> {t(q.title)} <small className="text-[var(--ash-muted)]">· {npcName(q.giver)}</small></div>
          ))}
        </>
      )}
      {done.length > 0 && (
        <>
          <div className="ash-kicker mb-2 mt-4">{L("Splněno", "Completed")} ({done.length}/{mine.length})</div>
          {done.map((q) => <div key={q.id} className="text-sm text-[var(--ash-muted)]">✓ {t(q.title)}</div>)}
        </>
      )}
    </PanelShell>
  );
}

/** Nastavení: jazyk, kvalita grafiky, ovládání. */
export function SettingsPanel({ onQuality, onClose }: { onQuality: (q: Quality) => void; onClose: () => void }) {
  const lang = useLang();
  const [q, setQ] = useState<Quality>(getQuality());
  return (
    <PanelShell title={L("Nastavení", "Settings")} kicker="Ashes of Eryon" onClose={onClose}>
      <div className="ash-kicker mb-2">{L("Jazyk", "Language")}</div>
      <div className="ash-tabs">
        <button data-active={lang === "cs"} onClick={() => setLang("cs")}>Čeština</button>
        <button data-active={lang === "en"} onClick={() => setLang("en")}>English</button>
      </div>
      <div className="ash-kicker mb-2 mt-4">{L("Kvalita grafiky", "Graphics quality")}</div>
      <div className="ash-tabs">
        {(["low", "medium", "high"] as Quality[]).map((x) => (
          <button key={x} data-active={q === x} onClick={() => { setQ(x); onQuality(x); }}>
            {x === "low" ? L("Nízká", "Low") : x === "medium" ? L("Střední", "Medium") : L("Vysoká", "High")}
          </button>
        ))}
      </div>
      <p className="text-xs text-[var(--ash-muted)]">{L("Nízká kvalita vypne stíny a záři a zředí vegetaci – vhodné pro slabší počítače a mobily.", "Low quality disables shadows and bloom and thins vegetation – good for weaker computers and phones.")}</p>
      <div className="ash-kicker mb-2 mt-4">{L("Ovládání", "Controls")}</div>
      <div className="ash-card text-sm leading-7">
        <div><b>WASD / {L("šipky", "arrows")}</b> – {L("chůze", "walk")}</div>
        <div><b>{L("Klik / dotyk", "Click / tap")}</b> – {L("jdi na místo nebo k postavě", "walk to a spot or a character")}</div>
        <div><b>E</b> – {L("mluvit / použít", "talk / use")}</div>
        <div><b>Q · {L("pravé tlačítko + tah", "right-drag")}</b> – {L("otočit kameru", "rotate camera")}</div>
        <div><b>{L("Kolečko", "Wheel")}</b> – {L("přiblížení", "zoom")}</div>
        <div className="text-[var(--ash-muted)]">{L("Nepřítel, který tě dostihne, tě vyzve k souboji.", "An enemy that catches you starts a fight.")}</div>
      </div>
    </PanelShell>
  );
}
