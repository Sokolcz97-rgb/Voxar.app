import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Coins, Crown, Flame, Hourglass, Pause, Play, Shield, Skull, Sparkles, Swords, Trophy, Volume2, VolumeX, X,
} from "lucide-react";
import { ashesApi } from "../api";
import { music, type Album, type Track } from "../audio";
import {
  CLASS_MAIN, FACTION, RARITY,
  type Appearance, type Faction, type Fighter, type GameState, type HeroClass, type Item, type PresenceHero, type Slot, type StatKey,
} from "../types";
import { L, classLabel, factionName, factionShort, locale, rarityLabel, slotLabel, statLabel, tr, trChronicle, trItem } from "../i18n";

export type Act = (fn: () => Promise<GameState>, success?: string) => Promise<unknown>;

const STATS: StatKey[] = ["sila", "obratnost", "intelekt", "vydrz", "stesti"];
const SLOTS: Slot[] = ["zbran", "stit", "helma", "zbroj", "rukavice", "boty", "amulet"];

export function fmtNum(n: number | undefined | null) {
  return typeof n === "number" ? Math.round(n).toLocaleString(locale()) : "—";
}

export function fmtTime(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function PanelShell({ title, kicker, onClose, children }: { title: string; kicker?: string; onClose: () => void; children: ReactNode }) {
  return (
    <section className="ash-panel ash-frame" aria-label={title}>
      <header>
        <div>
          {kicker && <div className="ash-kicker">{kicker}</div>}
          <h2 className="ash-title">{title}</h2>
        </div>
        <button className="ash-icon-btn close" onClick={onClose} aria-label={L("Zavřít", "Close")}><X className="h-4 w-4" /></button>
      </header>
      <div className="body">{children}</div>
    </section>
  );
}

function itemLines(item: Item) {
  const lines: { label: string; value: number; key: string }[] = [];
  if (item.slot === "zbran") lines.push({ key: "dmg", label: L("Poškození", "Damage"), value: (item.wmin + item.wmax) / 2 });
  if (item.armor) lines.push({ key: "armor", label: L("Zbroj", "Armor"), value: item.armor });
  for (const s of STATS) if (item[s]) lines.push({ key: s, label: statLabel(s), value: item[s] });
  return lines;
}

export function ItemCard({ item, compare, actions }: { item: Item; compare?: Item | null; actions?: ReactNode }) {
  const rarity = RARITY[item.rarity] ?? RARITY[0];
  const mine = itemLines(item);
  const theirs = compare ? itemLines(compare) : [];
  return (
    <div className="ash-card" style={{ borderColor: `${rarity.color}55` }}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="ash-item-name" style={{ color: rarity.color }}>{trItem(item.name)}</div>
          <div className="ash-meta mt-1">
            <span>{slotLabel(item.slot)}</span>
            <span>{rarityLabel(item.rarity)}</span>
            <span>{L("úroveň", "level")} {item.level}</span>
            {item.equipped && <b>{L("Nasazeno", "Equipped")}</b>}
          </div>
          <div className="ash-item-stats">
            {item.slot === "zbran" && <span>{item.wmin}–{item.wmax} {L("poškození", "damage")}</span>}
            {mine.filter((l) => l.key !== "dmg").map((l) => <span key={l.key}>+{l.value} {l.label}</span>)}
          </div>
          {compare && compare.id !== item.id && (
            <div className="ash-item-stats">
              {[...new Set([...mine, ...theirs].map((l) => l.key))].map((key) => {
                const a = mine.find((l) => l.key === key)?.value ?? 0;
                const b = theirs.find((l) => l.key === key)?.value ?? 0;
                const d = Math.round((a - b) * 10) / 10;
                if (!d) return null;
                const label = mine.find((l) => l.key === key)?.label ?? theirs.find((l) => l.key === key)?.label;
                return <span key={key} className={d > 0 ? "up" : "down"}>{d > 0 ? "▲" : "▼"} {Math.abs(d)} {label}</span>;
              })}
            </div>
          )}
        </div>
        {actions && <div className="flex flex-col items-end gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/* ------------------------------ KRČMA ------------------------------ */
export function TavernPanel({ state, now, act, onFinish, onClose, busy }: {
  state: GameState; now: number; act: Act; onFinish: (skip: boolean) => void; onClose: () => void; busy: boolean;
}) {
  const ch = state.character!;
  const quests = state.quests ?? [];
  const active = quests.find((q) => q.state === "active");
  return (
    <PanelShell
      title={ch.faction === "legie" ? L("Markytánka u černých plachet", "The Sutler by the Black Sails") : L("Krčma U Zlomeného vesla", "The Broken Oar Tavern")}
      kicker={L("Výpravy na čas", "Timed expeditions")}
      onClose={onClose}
    >
      <p className="ashes-prose mb-3">
        {ch.faction === "legie"
          ? L("Markytánka nalévá kyselé víno z měchu a ukáže na rozkazy přibité ke stěžni. „Azkar platí bronzem. Mrtví neplatí nic.“", "The sutler pours sour wine from a skin and points to the orders nailed to the mast. “Azkar pays in bronze. The dead pay nothing.”")
          : L("Hostinský utírá cínové poháry a kývne k tabuli. „Práce je dost. Lidí, co se vrátí, málo.“", "The innkeeper wipes pewter cups and nods at the board. “Plenty of work. Few who come back.”")}
      </p>
      <div className="mb-4">
        <div className="ash-meta mb-1"><span>{L("Odvaha na dnešek", "Courage today")}</span><b>{ch.courage} / 100</b>{state.admin && <span>{L("(správce bez omezení)", "(admin: unlimited)")}</span>}</div>
        <div className="ash-bar courage"><i style={{ width: `${ch.courage}%` }} /></div>
      </div>

      {active ? (() => {
        const end = active.ends_at ? new Date(active.ends_at).getTime() : now;
        const start = active.started_at ? new Date(active.started_at).getTime() : now;
        const left = end - now;
        const pct = Math.min(100, Math.max(0, ((now - start) / Math.max(1, end - start)) * 100));
        return (
          <div className="ash-card hl ash-quest">
            <div className="ash-kicker mb-1">{L("Na výpravě", "On an expedition")}</div>
            <h3 className="ash-title">{tr(active.title)}</h3>
            <p className="ashes-prose">{tr(active.story)}</p>
            <EnemyLine enemy={active.enemy} />
            <div className="ash-bar mt-3"><i style={{ width: `${pct}%` }} /></div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button className="ash-btn" disabled={left > 0 || busy} onClick={() => onFinish(false)}>
                {left > 0 ? <><Hourglass className="h-4 w-4" /> {L("Zbývá", "Left")} {fmtTime(left)}</> : <><Swords className="h-4 w-4" /> {L("Utkat se s nepřítelem", "Face the enemy")}</>}
              </button>
              {state.admin && left > 0 && (
                <button className="ash-btn ghost small" disabled={busy} onClick={() => onFinish(true)}>{L("Přeskočit čekání (správce)", "Skip wait (admin)")}</button>
              )}
            </div>
          </div>
        );
      })() : (
        quests.map((q) => {
          const cost = 8 + q.minutes * 2;
          return (
            <div key={q.id} className="ash-card ash-quest">
              <h3 className="ash-title">{tr(q.title)}</h3>
              <p className="ashes-prose">{tr(q.story)}</p>
              <EnemyLine enemy={q.enemy} />
              <div className="ash-meta">
                <span><Hourglass className="mr-1 inline h-3.5 w-3.5" /><b>{q.minutes} min</b></span>
                <span><Sparkles className="mr-1 inline h-3.5 w-3.5" /><b>{fmtNum(q.xp)}</b> {L("zkušeností", "XP")}</span>
                <span><Coins className="mr-1 inline h-3.5 w-3.5" /><b>{fmtNum(q.gold)}</b> {L("zlata", "gold")}</span>
                <span>{L("kořist", "loot")} {q.item_chance} %</span>
                <span>{L("odvaha", "courage")} −{cost}</span>
              </div>
              <button
                className="ash-btn mt-3"
                disabled={busy || (!state.admin && ch.courage < cost)}
                onClick={() => act(() => ashesApi.startQuest(q.id), `${L("Vydáváš se na výpravu", "You set out")}: ${tr(q.title)}`)}
              >
                {L("Vydat se na výpravu", "Set out")}
              </button>
            </div>
          );
        })
      )}
    </PanelShell>
  );
}

function EnemyLine({ enemy }: { enemy: Fighter }) {
  return (
    <div className="ash-enemy">
      <Skull className="h-4 w-4 text-[#d2492b]" />
      <span><b>{tr(enemy.name)}</b> · {classLabel(enemy.class)} · {L("úroveň", "level")} {enemy.level}</span>
    </div>
  );
}

/* ------------------------------ HRDINA ------------------------------ */
export function HeroPanel({ state, act, onClose, busy }: { state: GameState; act: Act; onClose: () => void; busy: boolean }) {
  const ch = state.character!;
  const f = state.fighter!;
  const items = state.items ?? [];
  const equipped = items.filter((i) => i.equipped);
  const bag = items.filter((i) => !i.equipped);
  const main = CLASS_MAIN[ch.class];
  const critPct = Math.min(50, (f.stesti * 5) / Math.max(1, ch.level * 2));
  const dmg = (k: number) => Math.round(k * (1 + f[main] / 10));
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <PanelShell title={ch.display_name} kicker={`${factionName(ch.faction ?? "kalidra")} · ${classLabel(ch.class)} · ${L("úroveň", "level")} ${ch.level}`} onClose={onClose}>
      <div className="mb-3">
        <div className="ash-meta mb-1"><span>{L("Zkušenosti", "Experience")}</span><b>{fmtNum(ch.xp)} / {fmtNum(ch.xp_need)}</b></div>
        <div className="ash-bar"><i style={{ width: `${(ch.xp / ch.xp_need) * 100}%` }} /></div>
      </div>
      <div className="ash-meta mb-3">
        <span>{L("Životy", "Health")} <b>{fmtNum(state.hp)}</b></span>
        <span>{L("Poškození", "Damage")} <b>{dmg(f.wmin)}–{dmg(f.wmax)}</b></span>
        <span>{L("Zbroj", "Armor")} <b>{f.armor}</b></span>
        <span>{L("Kritický zásah", "Critical hit")} <b>{critPct.toFixed(0)} %</b></span>
        <span>{L("Výhry", "Wins")} <b>{ch.wins}</b> / {L("prohry", "losses")} <b>{ch.losses}</b></span>
      </div>

      <div className="ash-kicker mb-1">{L("Vlastnosti a výcvik", "Attributes and training")}</div>
      <div className="mb-4">
        {STATS.map((s) => {
          const base = ch[s];
          const total = f[s];
          const cost = state.train_cost?.[s] ?? 0;
          return (
            <div key={s} className={`ash-stat ${s === main ? "main" : ""}`}>
              <span className="name">{statLabel(s)}{s === main ? " ★" : ""}</span>
              <span className="val">{total}{total > base && <small>(+{total - base})</small>}</span>
              <button className="ash-btn ghost small" disabled={busy || ch.gold < cost} onClick={() => act(() => ashesApi.train(s))} title={`${L("Výcvik za", "Train for")} ${cost} ${L("zlata", "gold")}`}>
                +1 · {fmtNum(cost)} <Coins className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="ash-kicker mb-2">{L("Výbava", "Equipment")}</div>
      <div className="ash-slots mb-4">
        {SLOTS.map((slot) => {
          const it = equipped.find((i) => i.slot === slot);
          return (
            <button key={slot} className={`ash-slot ${it ? "filled" : ""}`} onClick={() => it && setSelected(selected === it.id ? null : it.id)} style={it ? { borderColor: `${RARITY[it.rarity].color}66` } : undefined}>
              <span className="slot">{slotLabel(slot)}</span>
              {it ? <span className="ash-item-name" style={{ color: RARITY[it.rarity].color }}>{trItem(it.name)}</span> : <span className="text-[var(--ash-muted)]">{L("prázdné", "empty")}</span>}
            </button>
          );
        })}
      </div>
      {selected && equipped.find((i) => i.id === selected) && (
        <div className="mb-4">
          <ItemCard
            item={equipped.find((i) => i.id === selected)!}
            actions={<button className="ash-btn ghost small" disabled={busy} onClick={() => act(() => ashesApi.equip(selected, false)).then(() => setSelected(null))}>{L("Sundat", "Unequip")}</button>}
          />
        </div>
      )}

      <div className="ash-kicker mb-2">{L("Batoh", "Bag")} ({bag.length} / {state.bag_max ?? 12})</div>
      {bag.length === 0 && <p className="text-sm text-[var(--ash-muted)]">{L("Batoh je prázdný. Kořist najdeš na výpravách a u kováře.", "Your bag is empty. Find loot on expeditions and at the smith.")}</p>}
      {bag.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          compare={equipped.find((e) => e.slot === item.slot) ?? null}
          actions={
            <>
              <button className="ash-btn small" disabled={busy || item.level > ch.level + 2} onClick={() => act(() => ashesApi.equip(item.id, true))}>{L("Nasadit", "Equip")}</button>
              <button className="ash-btn ghost small" disabled={busy} onClick={() => act(() => ashesApi.sell(item.id), `${L("Prodáno za", "Sold for")} ${Math.max(1, Math.floor(item.price / 4))} ${L("zlata", "gold")}`)}>
                {L("Prodat", "Sell")} · {fmtNum(Math.max(1, Math.floor(item.price / 4)))}
              </button>
            </>
          }
        />
      ))}
    </PanelShell>
  );
}

/* ------------------------------ KOVÁRNA ------------------------------ */
export function SmithyPanel({ state, act, onClose, busy }: { state: GameState; act: Act; onClose: () => void; busy: boolean }) {
  const [stock, setStock] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ch = state.character!;
  const equipped = (state.items ?? []).filter((i) => i.equipped);
  const bagFull = (state.items ?? []).filter((i) => !i.equipped).length >= (state.bag_max ?? 12);

  useEffect(() => {
    ashesApi.shop().then(setStock).catch((e: Error) => setError(e.message));
  }, [state.character?.gold]);

  return (
    <PanelShell title={ch.faction === "legie" ? L("Polní kovárna Legie", "Legion Field Forge") : L("Kovárna u výhně", "The Forge")} kicker={L("Bronz, kůže a talismany", "Bronze, leather and talismans")} onClose={onClose}>
      <p className="ashes-prose mb-3">
        {ch.faction === "legie"
          ? L("Kovář Rukmar kalí čepele v moři. „Bronz Legie je černý od kouře. O to líp se v něm odráží oheň.“", "Rukmar the smith quenches blades in the sea. “Legion bronze is black with smoke. All the better to reflect the fire.”")
          : L("Kovář Tharos ani nezvedne hlavu od kovadliny. „Bronz se nevrací. Bronz jde jen vpřed. Vyber si.“", "Tharos the smith doesn't even look up from the anvil. “Bronze doesn't go back. Bronze only goes forward. Choose.”")}
      </p>
      <div className="ash-meta mb-3"><span>{L("Tvé zlato", "Your gold")} <b>{fmtNum(ch.gold)}</b></span><span>{L("Zboží se obměňuje každý den", "Stock changes daily")}</span>{bagFull && <b className="text-[#e07a5f]">{L("Batoh je plný", "Bag is full")}</b>}</div>
      {error && <p className="ash-toast-error text-sm">{error}</p>}
      {!stock && !error && <p className="text-sm text-[var(--ash-muted)]">{L("Kovář vykládá zboží…", "The smith lays out his wares…")}</p>}
      {stock?.length === 0 && <p className="text-sm text-[var(--ash-muted)]">{L("Dnes je vyprodáno. Zítra ráno přiveze nový bronz.", "Sold out today. New bronze arrives tomorrow.")}</p>}
      {stock?.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          compare={equipped.find((e) => e.slot === item.slot) ?? null}
          actions={
            <button className="ash-btn small" disabled={busy || ch.gold < item.price || bagFull} onClick={() => act(() => ashesApi.buy(item.id), `${L("Koupeno", "Bought")}: ${trItem(item.name)}`)}>
              {L("Koupit", "Buy")} · {fmtNum(item.price)}
            </button>
          }
        />
      ))}
    </PanelShell>
  );
}

/* ------------------------------ ARÉNA ------------------------------ */
export function ArenaPanel({ state, now, onFight, onClose, busy }: {
  state: GameState; now: number; onFight: (id: string) => void; onClose: () => void; busy: boolean;
}) {
  const [tab, setTab] = useState<"souperi" | "slava">("souperi");
  const [foes, setFoes] = useState<Fighter[] | null>(null);
  const [fame, setFame] = useState<Awaited<ReturnType<typeof ashesApi.hallOfFame>> | null>(null);
  const ch = state.character!;
  const ready = new Date(ch.arena_ready_at).getTime();
  const wait = ready - now;

  useEffect(() => {
    if (tab === "souperi") ashesApi.opponents().then(setFoes).catch(() => setFoes([]));
    else ashesApi.hallOfFame().then(setFame).catch(() => setFame([]));
  }, [tab, ch.honor]);

  return (
    <PanelShell title={L("Kruh kamenů", "The Stone Circle")} kicker={L("Aréna · souboje hráčů", "Arena · player duels")} onClose={onClose}>
      <p className="ashes-prose mb-3">{L("V kruhu menhirů se měří obránci Kalidry i vojáci Legie. Vítěz bere čest, poražený poučení. Souboj s nepřítelem z druhé strany dává o polovinu víc cti a pohne hradbami.", "Defenders of Kalidra and soldiers of the Legion test themselves in the stone circle. The winner takes honor, the loser a lesson. Fighting the other side gives half again as much honor and moves the walls.")}</p>
      <div className="ash-meta mb-3"><span>{L("Tvá čest", "Your honor")} <b>{fmtNum(ch.honor)}</b></span>{wait > 0 && !state.admin && <span>{L("Další souboj za", "Next fight in")} <b>{fmtTime(wait)}</b></span>}</div>
      <div className="ash-tabs">
        <button data-active={tab === "souperi"} onClick={() => setTab("souperi")}>{L("Soupeři", "Opponents")}</button>
        <button data-active={tab === "slava"} onClick={() => setTab("slava")}>{L("Síň slávy", "Hall of Fame")}</button>
      </div>
      {tab === "souperi" && (
        <>
          {!foes && <p className="text-sm text-[var(--ash-muted)]">{L("Hledám soupeře…", "Looking for opponents…")}</p>}
          {foes?.length === 0 && <p className="text-sm text-[var(--ash-muted)]">{L("Zatím tu nejsou jiní hrdinové. Až se probudí další, objeví se tady.", "No other heroes yet. They will appear here when they awaken.")}</p>}
          {foes?.map((foe) => (
            <div key={foe.id} className={`ash-card ${foe.eryon || foe.azkar ? "hl" : ""}`}>
              <div className="flex items-center gap-3">
                {foe.eryon || foe.azkar ? <Crown className="h-5 w-5 text-[#ffcf8a]" /> : <Shield className="h-5 w-5" style={{ color: FACTION[foe.faction ?? "kalidra"].color }} />}
                <div className="min-w-0 flex-1">
                  <div className="ash-title">{foe.name}{(foe.eryon || foe.azkar) && <span className="ml-2 text-xs text-[#ffb27a]">{L("legenda", "legend")}</span>}</div>
                  <div className="ash-meta"><span style={{ color: FACTION[foe.faction ?? "kalidra"].color }}>{factionShort(foe.faction ?? "kalidra")}{foe.faction !== ch.faction ? L(" · nepřítel", " · enemy") : ""}</span><span>{classLabel(foe.class)}</span><span>{L("úroveň", "level")} <b>{foe.level}</b></span><span>{L("čest", "honor")} <b>{fmtNum(foe.honor)}</b></span></div>
                </div>
                <button className="ash-btn blood small" disabled={busy || (wait > 0 && !state.admin)} onClick={() => foe.id && onFight(foe.id)}>
                  <Swords className="h-3.5 w-3.5" /> {L("Vyzvat", "Challenge")}
                </button>
              </div>
            </div>
          ))}
        </>
      )}
      {tab === "slava" && (
        <div>
          {fame?.map((row, i) => (
            <div key={`${row.name}-${i}`} className="ash-stat">
              <span className="name">{i + 1}. {row.eryon || row.azkar ? "👑 " : ""}{row.name} <small style={{ color: FACTION[row.faction ?? "kalidra"].color }}>{factionShort(row.faction ?? "kalidra")}</small> <small className="text-[var(--ash-muted)]">{classLabel(row.class)} · {L("úr.", "lvl")} {row.level}</small></span>
              <span className="val">{fmtNum(row.honor)}</span>
              <Trophy className="h-4 w-4 text-[var(--ash-gold)]" />
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

/* ------------------------------ HRADBY / TÁBOR ------------------------------ */
const CHAPTER_NAMES: Record<Faction, string[]> = {
  kalidra: ["Bezejmenný břeh", "Strážní ohně", "Tisíc kopí", "Poslední štít", "Oheň Kalidry", "Pochod bronzu"],
  legie: ["Vylodění", "Strážní ohně", "Tisíc kopí", "Poslední štít", "Ohně na horách", "Pochod k moři"],
};
/** Akty ságy: 1. akt = kapitoly 1–4 (Poslední štít), 5 = ukázka 2. aktu, 6 = ukázka 3. aktu. */
export function actOf(chapter: number) {
  return chapter <= 4 ? 1 : chapter === 5 ? 2 : 3;
}
export function actName(act: number) {
  return [L("Poslední štít", "The Last Shield"), L("Oheň Kalidry", "Fire of Kalidra"), L("Pochod bronzu", "March of Bronze")][act - 1];
}

export function WallsPanel({ state, now, act, onBoss, onClose, busy }: {
  state: GameState; now: number; act: Act; onBoss: () => void; onClose: () => void; busy: boolean;
}) {
  const ch = state.character!;
  const chapter = state.chapter!;
  const world = state.world!;
  const faction: Faction = ch.faction ?? "kalidra";
  const legion = faction === "legie";
  const [shout, setShout] = useState("");
  const actDone = ch.chapter > 6;
  const bossReady = new Date(ch.boss_ready_at).getTime() - now;
  const canBoss = !actDone && ch.chapter_progress >= chapter.need && (bossReady <= 0 || state.admin);
  const wallPct = (world.wall / world.wall_max) * 100;
  const ally = chapter.ally ?? (chapter.eryon ? "eryon" : null);
  const isHero = ch.is_eryon || ch.is_azkar;
  const canClaim = legion ? !!state.editor : !!state.admin;
  const heroShout = legion ? world.azkar_shout : world.eryon_shout;

  return (
    <PanelShell
      title={legion ? L("Tábor Legie", "Legion Camp") : L("Hradby Kalidry", "Walls of Kalidra")}
      kicker={actDone ? L("Ukázka 2. a 3. aktu dohrána", "Act II and III previews complete") : `${L("Akt", "Act")} ${actOf(ch.chapter)}: ${actName(actOf(ch.chapter))} · ${L("kapitola", "chapter")} ${ch.chapter} · ${tr(chapter.title)}`}
      onClose={onClose}
    >
      <div className="ash-chapters mb-4">
        {CHAPTER_NAMES[faction].map((name, i) => (
          <div key={name} data-state={i + 1 < ch.chapter ? "done" : i + 1 === ch.chapter ? "now" : "todo"}>{i + 1}. {tr(name)}{i === 3 ? ` · ${L("konec 1. aktu", "end of Act I")}` : i === 4 ? ` · ${L("2. akt", "Act II")}` : i === 5 ? ` · ${L("3. akt", "Act III")}` : ""}</div>
        ))}
      </div>

      {!actDone ? (
        <>
          <p className="ashes-prose">{tr(chapter.intro)}</p>
          <div className="mt-3">
            <div className="ash-meta mb-1"><span>{L("Splněné úkoly kapitoly", "Chapter quests completed")}</span><b>{Math.min(ch.chapter_progress, chapter.need)} / {chapter.need}</b></div>
            <div className="ash-bar"><i style={{ width: `${Math.min(100, (ch.chapter_progress / chapter.need) * 100)}%` }} /></div>
          </div>
          <div className="ash-card hl mt-4">
            <div className="ash-kicker mb-1">{L("Rozhodující bitva", "Decisive battle")}</div>
            <h3 className="ash-title text-lg">{tr(chapter.boss.t)}</h3>
            <p className="ashes-prose">{tr(chapter.boss.s)}</p>
            <div className="ash-enemy"><Skull className="h-4 w-4 text-[#d2492b]" /><span><b>{tr(chapter.boss.e)}</b> · {classLabel(chapter.boss.c)}</span></div>
            {ally && (
              <p className="text-sm text-[#ffcf8a]"><Crown className="mr-1 inline h-4 w-4" />{ally === "azkar" ? "Azkar" : "Eryon"} {L("bojuje po tvém boku: +25 % poškození.", "fights at your side: +25% damage.")}</p>
            )}
            <button className="ash-btn blood mt-3" disabled={busy || !canBoss} onClick={onBoss}>
              {ch.chapter_progress < chapter.need ? `${L("Nejdřív splň úkoly", "Complete quests first")} (${ch.chapter_progress}/${chapter.need})` : bossReady > 0 && !state.admin ? `${L("Odpočinek", "Resting")} ${fmtTime(bossReady)}` : <><Flame className="h-4 w-4" /> {L("Vyrazit do bitvy", "Into battle")}</>}
            </button>
          </div>
        </>
      ) : (
        <div className="ash-card hl">
          <p className="ashes-prose">{legion ? L("Moře je černé… zítra bude rudé.", "The sea is black… tomorrow it will be red.") : L("Došli jsme k moři. A moře… už čekalo.", "We reached the sea. And the sea… was already waiting.")}</p>
          <p className="text-sm text-[var(--ash-muted)]">{L("Ukázka 2. a 3. aktu je dohrána. Další akty se připravují – zatím můžeš sílit ve světě a v aréně.", "The Act II and III previews are complete. More acts are coming – until then grow stronger in the world and the arena.")}</p>
        </div>
      )}

      <div className="ash-rule my-5" />
      <div className="ash-kicker mb-1">{L("Válka o Kalidru · všichni hráči", "War for Kalidra · all players")}</div>
      <div className="ash-meta mb-1">
        <span>{L("Síla hradeb", "Wall strength")}</span><b>{wallPct.toFixed(1)} %</b>
        <span style={{ color: FACTION.kalidra.color }}>{L("Obránci", "Defenders")} {fmtNum(world.kalidra)}</span>
        <span style={{ color: FACTION.legie.color }}>{L("Legie", "Legion")} {fmtNum(world.legie)}</span>
      </div>
      <div className="ash-bar wall"><i style={{ width: `${wallPct}%` }} /></div>
      <p className="mt-2 text-xs text-[var(--ash-muted)]">
        {legion
          ? L("Každé vítězství Legie hradby oslabí, každé vítězství obránců je zpevní. Zbořte je dřív, než je Kalidra znovu postaví.", "Every Legion victory weakens the walls, every defender victory strengthens them. Tear them down before Kalidra rebuilds them.")
          : L("Každé vítězství obránců hradby zpevní, každé vítězství Legie je oslabí. Dokud stojí, stojí Kalidra.", "Every defender victory strengthens the walls, every Legion victory weakens them. While they stand, Kalidra stands.")}
      </p>

      <div className="ash-rule my-5" />
      <div className="ash-kicker mb-2">{legion ? L("Azkar, Syn Rudého slunce", "Azkar, Son of the Red Sun") : L("Eryon, poslední štít", "Eryon, the Last Shield")}</div>
      {heroShout ? (
        <blockquote className="ashes-prose border-l-2 border-[#b3160d] pl-3 italic">„{heroShout}“</blockquote>
      ) : (
        <p className="ashes-prose italic text-[var(--ash-muted)]">
          {legion ? L("Azkar stojí u ohně a mlčky brousí meč.", "Azkar stands by the fire, silently sharpening his sword.") : L("Eryon mlčí na hradbách a hledí k horám.", "Eryon stands silent on the walls, gazing at the mountains.")}
        </p>
      )}
      {(canClaim || state.admin) && (
        <div className="ash-card mt-3">
          <div className="ash-kicker mb-2">{state.admin ? L("Správce", "Admin") : "Editor"}</div>
          <div className="flex flex-wrap gap-2">
            {canClaim && (
              <button className="ash-btn small" disabled={busy} onClick={() => act(() => ashesApi.claimHero(!isHero), isHero ? `${FACTION[faction].hero} ${L("je opět legendou.", "is a legend again.")}` : `${L("Teď jsi", "You are now")} ${FACTION[faction].hero}.`)}>
                <Crown className="h-3.5 w-3.5" /> {isHero ? L(`Vrátit ${legion ? "Azkara" : "Eryona"} legendě`, `Return ${FACTION[faction].hero} to legend`) : L(`Hrát za ${legion ? "Azkara" : "Eryona"}`, `Play as ${FACTION[faction].hero}`)}
              </button>
            )}
            {state.admin && (
              <button className="ash-btn ghost small" disabled={busy} onClick={() => act(() => ashesApi.adminWorld(!world.open_to_all), world.open_to_all ? L("Hra je opět jen pro tým.", "The game is team-only again.") : L("Hra je otevřená všem přihlášeným hráčům.", "The game is open to all signed-in players."))}>
                {world.open_to_all ? L("Zavřít hru (jen tým)", "Close game (team only)") : L("Otevřít hru všem hráčům", "Open game to all players")}
              </button>
            )}
          </div>
          {isHero && (
            <div className="mt-3">
              <textarea className="ash-textarea" maxLength={240} placeholder={L(`Co ${FACTION[faction].hero} řekne všem hráčům?`, `What will ${FACTION[faction].hero} say to all players?`)} value={shout} onChange={(e) => setShout(e.target.value)} />
              <button className="ash-btn small mt-2" disabled={busy || shout.trim().length < 2} onClick={() => act(() => ashesApi.heroSay(shout), `${FACTION[faction].hero} ${L("promluvil.", "has spoken.")}`).then(() => setShout(""))}>
                {L("Promluvit ke všem", "Speak to all")}
              </button>
            </div>
          )}
          {state.admin && (
            <p className="mt-2 text-xs text-[var(--ash-muted)]">{L("Hra je teď", "The game is now")} {world.open_to_all ? L("otevřená všem přihlášeným", "open to all signed-in players") : L("jen pro správce a editory", "admins and editors only")}.</p>
          )}
          {!canClaim && !legion && <p className="mt-2 text-xs text-[var(--ash-muted)]">{L("Eryona může převzít jen správce.", "Only the admin can take over Eryon.")}</p>}
        </div>
      )}
    </PanelShell>
  );
}

/* ------------------------------ BARD ------------------------------ */
export function BardPanel({ chapter, onClose }: { chapter: number; onClose: () => void }) {
  const [album, setAlbum] = useState<Album | null>(music.album);
  const [, force] = useState(0);
  const [selected, setSelected] = useState<string | null>(music.current?.id ?? null);

  useEffect(() => {
    const off = music.subscribe(() => force((n) => n + 1));
    music.loadAlbum().then((a) => {
      setAlbum(a);
      if (!selected) setSelected(music.current?.id ?? music.trackForChapter(chapter)?.id ?? null);
    });
    return () => { off(); };
  }, [chapter, selected]);

  const track: Track | undefined = album?.tracks.find((t) => t.id === selected) ?? album?.tracks[0];
  const lyrics = useMemo(() => {
    if (!track) return [];
    return track.lyrics.split("\n").map((line, i) => {
      const tag = /^\[(.+)\]$/.exec(line.trim());
      return tag ? <span key={i} className="tag">{tag[1].split("–")[0].trim()}</span> : <span key={i}>{line}{"\n"}</span>;
    });
  }, [track]);

  return (
    <PanelShell title={L("Bard u ohně", "The Bard by the Fire")} kicker={album ? `${L("Album", "Album")} „${album.album}“ · ${album.artist}` : L("Písně Kalidry", "Songs of Kalidra")} onClose={onClose}>
      <p className="ashes-prose mb-3">{L("Bard ladí lyru. „Kámen si pamatuje. Moře si pamatuje. A já zpívám, aby si to pamatovali i lidé.“", "The bard tunes his lyre. “The stone remembers. The sea remembers. And I sing so that people remember too.”")}</p>
      {!album && <p className="text-sm text-[var(--ash-muted)]">{L("Bard hledá správné struny…", "The bard searches for the right strings…")}</p>}
      <div className="flex flex-col gap-2">
        {album?.tracks.map((t) => (
          <button key={t.id} className="ash-track" data-active={t.id === track?.id} onClick={() => setSelected(t.id)}>
            {t.coverUrl ? <img src={t.coverUrl} alt="" /> : <div className="h-[52px] w-[52px] bg-black/50" />}
            <div className="min-w-0 flex-1">
              <div className="ash-title">{tr(t.title)}</div>
              <div className="ash-meta"><span>{L("Akt", "Act")} {actOf(t.chapters[0])}</span>{music.current?.id === t.id && music.playing && <b>{L("hraje", "playing")}</b>}</div>
            </div>
            <span
              role="button"
              tabIndex={0}
              className="ash-icon-btn"
              onClick={(e) => { e.stopPropagation(); if (music.current?.id === t.id && music.playing) music.pause(); else void music.play(t); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); void music.play(t); } }}
              aria-label={music.current?.id === t.id && music.playing ? L("Pozastavit", "Pause") : L("Přehrát", "Play")}
            >
              {music.current?.id === t.id && music.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button className="ash-icon-btn" onClick={() => music.toggleMute()} aria-label={L("Ztlumit", "Mute")}>{music.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
        <input type="range" min={0} max={1} step={0.01} value={music.volume} onChange={(e) => music.setVolume(Number(e.target.value))} className="flex-1 accent-[#d2ae68]" aria-label={L("Hlasitost", "Volume")} />
      </div>
      {track && (
        <>
          <div className="ash-rule my-4" />
          <div className="ash-kicker mb-2">{L("Text písně", "Lyrics")} · {tr(track.title)}{L("", " (Czech)")}</div>
          <div className="ash-lyrics">{lyrics}</div>
        </>
      )}
    </PanelShell>
  );
}

/* ------------------------------ KRONIKA ------------------------------ */
export function ChroniclePanel({ state, others, onClose }: { state: GameState; others: PresenceHero[]; onClose: () => void }) {
  return (
    <PanelShell title={L("Kronika Kalidry", "Chronicle of Kalidra")} kicker={L("Co se děje ve světě", "What is happening in the world")} onClose={onClose}>
      <div className="ash-meta mb-3">
        <span style={{ color: FACTION.kalidra.color }}>{factionName("kalidra")} <b>{fmtNum(state.world?.kalidra)}</b></span>
        <span style={{ color: FACTION.legie.color }}>{factionName("legie")} <b>{fmtNum(state.world?.legie)}</b></span>
      </div>
      <div className="ash-kicker mb-2">{L("Spolubojovníci ve světě", "Comrades in the world")} ({others.length + 1})</div>
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="ash-card px-3 py-1 text-sm">{state.character?.display_name} <small className="text-[var(--ash-muted)]">{L("(ty)", "(you)")}</small></span>
        {others.map((o) => (
          <span key={o.key} className={`ash-card px-3 py-1 text-sm ${o.eryon || o.azkar ? "hl" : ""}`}>{o.name} <small className="text-[var(--ash-muted)]">{L("úr.", "lvl")} {o.level}</small></span>
        ))}
      </div>
      <div className="ash-kicker mb-2">{L("Zápisy", "Entries")}</div>
      {(state.chronicle ?? []).length === 0 && <p className="text-sm text-[var(--ash-muted)]">{L("Kronika je zatím prázdná.", "The chronicle is empty so far.")}</p>}
      {(state.chronicle ?? []).map((entry, i) => (
        <div key={i} className="ash-stat">
          <span className={entry.kind === "eryon" ? "ashes-prose italic text-[#ffcf8a]" : entry.kind === "azkar" ? "ashes-prose italic text-[#ff8a6a]" : ""}>{trChronicle(entry.text)}</span>
          <span className="text-xs text-[var(--ash-muted)]">{new Date(entry.created_at).toLocaleString(locale(), { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          <span />
        </div>
      ))}
    </PanelShell>
  );
}

/* ------------------------------ TVORBA POSTAVY ------------------------------ */
export const SKINS = ["#e0b08c", "#c99470", "#a4714c", "#7a4e33"];
export const CLOAKS = ["#7a1f16", "#2c3e5a", "#3d4a2a", "#8a6a2a", "#2a2422"];
export const CRESTS = ["#8a1a12", "#1d1d1d", "#d8cdb8", "#2a4a7a"];

export function CreateCharacter({ busy, onPreview, onCreate }: {
  busy: boolean;
  onPreview: (cls: HeroClass, appearance: Appearance, faction: Faction) => void;
  onCreate: (name: string, cls: HeroClass, appearance: Appearance, faction: Faction) => void;
}) {
  const [faction, setFaction] = useState<Faction>("kalidra");
  const [name, setName] = useState("");
  const [cls, setCls] = useState<HeroClass>("hoplit");
  const [skin, setSkin] = useState(SKINS[1]);
  const [cloak, setCloak] = useState(CLOAKS[0]);
  const [crest, setCrest] = useState(CRESTS[0]);
  const appearance = useMemo(() => ({ skin, cloak, crest }), [skin, cloak, crest]);
  useEffect(() => onPreview(cls, appearance, faction), [cls, appearance, faction, onPreview]);
  const valid = /^\p{L}[\p{L}\p{N} _-]{2,19}$/u.test(name.trim()) && !["eryon", "azkar"].includes(name.trim().toLowerCase());
  const sides: { id: Faction; title: string; hero: string; desc: string }[] = [
    { id: "kalidra", title: factionName("kalidra"), hero: L("Eryon, poslední štít", "Eryon, the Last Shield"), desc: L("Braň město na pobřeží. Dokud stojí jeden z vás, Kalidra nepadne.", "Defend the city on the coast. While one of you stands, Kalidra will not fall.") },
    { id: "legie", title: factionName("legie"), hero: L("Azkar, Syn Rudého slunce", "Azkar, Son of the Red Sun"), desc: L("Přišli jste z hor a z moře. Kalidra padne – nebo padnete vy.", "You came from the mountains and the sea. Kalidra will fall – or you will.") },
  ];

  const classes: { id: HeroClass; desc: string }[] = [
    { id: "hoplit", desc: L("Bronzový štít a kopí. Hodně životů, blokuje údery.", "Bronze shield and spear. Lots of health, blocks blows.") },
    { id: "lucistnik", desc: L("Luk a rychlost. Vyhýbá se úderům, kritické zásahy.", "Bow and speed. Dodges blows, lands critical hits.") },
    { id: "vestec", desc: L("Oheň a věštby. Ničivé kouzlo prochází zbrojí.", "Fire and prophecy. Devastating magic pierces armor.") },
  ];

  return (
    <section className="ash-create ash-frame">
      <header className="border-b border-[var(--ash-line)] px-5 pb-3 pt-4">
        <div className="ash-kicker">{faction === "legie" ? L("Zátoka černých plachet", "Bay of Black Sails") : L("Bezejmenný břeh", "Nameless Shore")}</div>
        <h2 className="ash-title m-0 text-xl">{faction === "legie" ? L("Kdo vystupuje z černé lodi?", "Who steps off the black ship?") : L("Kdo se probouzí v příboji?", "Who wakes in the surf?")}</h2>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="ash-kicker mb-2">{L("Strana", "Side")}</div>
        <div className="ash-factions mb-4">
          {sides.map((side) => (
            <button key={side.id} data-active={faction === side.id} data-faction={side.id} onClick={() => setFaction(side.id)}>
              <b>{side.title}</b>
              <span className="hero">{side.hero}</span>
              <small>{side.desc}</small>
            </button>
          ))}
        </div>
        <p className="ashes-prose mb-4">
          {faction === "legie"
            ? L("Černé lodě tě vysadily v zátoce. Azkar ukazuje mečem k městu na pobřeží: „Tam je Kalidra. Najdi mi k ní cestu.“", "The black ships set you ashore in the bay. Azkar points his sword at the city on the coast: “That is Kalidra. Find me a way to it.”")
            : L("Moře tě vyplavilo mezi trosky. Pamatuješ si jen své jméno – a že v dálce hoří světla Kalidry.", "The sea cast you among the wreckage. You remember only your name – and that the lights of Kalidra burn in the distance.")}
        </p>
        <label className="ash-kicker mb-1 block" htmlFor="ash-name">{L("Jméno hrdiny", "Hero name")}</label>
        <input id="ash-name" className="ash-input mb-1" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder={L("např. Tharion", "e.g. Tharion")} autoComplete="off" />
        <p className="mb-4 text-xs text-[var(--ash-muted)]">{L("3–20 znaků. Jména Eryon a Azkar patří legendám.", "3–20 characters. The names Eryon and Azkar belong to legends.")}</p>

        <div className="ash-kicker mb-2">{L("Povolání", "Class")}</div>
        <div className="ash-classes mb-4">
          {classes.map((c) => (
            <button key={c.id} data-active={cls === c.id} onClick={() => setCls(c.id)}>
              <b>{classLabel(c.id)}</b>
              <small>{c.desc}</small>
            </button>
          ))}
        </div>

        <div className="ash-kicker mb-2">{L("Pleť", "Skin")}</div>
        <div className="ash-swatches mb-4">{SKINS.map((c) => <button key={c} data-active={skin === c} style={{ background: c }} onClick={() => setSkin(c)} aria-label={`Pleť ${c}`} />)}</div>
        <div className="ash-kicker mb-2">{cls === "vestec" ? L("Roucho", "Robe") : L("Plášť", "Cloak")}</div>
        <div className="ash-swatches mb-4">{CLOAKS.map((c) => <button key={c} data-active={cloak === c} style={{ background: c }} onClick={() => setCloak(c)} aria-label={`Plášť ${c}`} />)}</div>
        {cls === "hoplit" && (
          <>
            <div className="ash-kicker mb-2">{L("Hřeben přilby", "Helmet crest")}</div>
            <div className="ash-swatches mb-4">{CRESTS.map((c) => <button key={c} data-active={crest === c} style={{ background: c }} onClick={() => setCrest(c)} aria-label={`Hřeben ${c}`} />)}</div>
          </>
        )}
      </div>
      <footer className="border-t border-[var(--ash-line)] px-5 py-4">
        <button className={`ash-btn w-full ${faction === "legie" ? "blood" : ""}`} disabled={!valid || busy} onClick={() => onCreate(name.trim(), cls, appearance, faction)}>
          {faction === "legie" ? L("Vstoupit do Legie", "Join the Legion") : L("Probudit se na břehu", "Wake on the shore")}
        </button>
      </footer>
    </section>
  );
}
