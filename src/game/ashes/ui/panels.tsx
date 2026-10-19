import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Coins, Crown, Flame, Hourglass, Pause, Play, Shield, Skull, Sparkles, Swords, Trophy, Volume2, VolumeX, X,
} from "lucide-react";
import { ashesApi } from "../api";
import { music, type Album, type Track } from "../audio";
import {
  CLASS_LABEL, CLASS_MAIN, FACTION, RARITY, SLOT_LABEL, STAT_LABEL,
  type Appearance, type Faction, type Fighter, type GameState, type HeroClass, type Item, type PresenceHero, type Slot, type StatKey,
} from "../types";

export type Act = (fn: () => Promise<GameState>, success?: string) => Promise<void>;

const STATS: StatKey[] = ["sila", "obratnost", "intelekt", "vydrz", "stesti"];
const SLOTS: Slot[] = ["zbran", "stit", "helma", "zbroj", "rukavice", "boty", "amulet"];

export function fmtNum(n: number | undefined | null) {
  return typeof n === "number" ? Math.round(n).toLocaleString("cs-CZ") : "—";
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
        <button className="ash-icon-btn close" onClick={onClose} aria-label="Zavřít"><X className="h-4 w-4" /></button>
      </header>
      <div className="body">{children}</div>
    </section>
  );
}

function itemLines(item: Item) {
  const lines: { label: string; value: number; key: string }[] = [];
  if (item.slot === "zbran") lines.push({ key: "dmg", label: "Poškození", value: (item.wmin + item.wmax) / 2 });
  if (item.armor) lines.push({ key: "armor", label: "Zbroj", value: item.armor });
  for (const s of STATS) if (item[s]) lines.push({ key: s, label: STAT_LABEL[s], value: item[s] });
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
          <div className="ash-item-name" style={{ color: rarity.color }}>{item.name}</div>
          <div className="ash-meta mt-1">
            <span>{SLOT_LABEL[item.slot]}</span>
            <span>{rarity.label}</span>
            <span>úroveň {item.level}</span>
            {item.equipped && <b>Nasazeno</b>}
          </div>
          <div className="ash-item-stats">
            {item.slot === "zbran" && <span>{item.wmin}–{item.wmax} poškození</span>}
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
      title={ch.faction === "legie" ? "Markytánka u černých plachet" : "Krčma U Zlomeného vesla"}
      kicker={`Kapitola ${ch.chapter > 6 ? "VI" : ["I", "II", "III", "IV", "V", "VI"][ch.chapter - 1]} · výpravy`}
      onClose={onClose}
    >
      <p className="ashes-prose mb-3">
        {ch.faction === "legie"
          ? "Markytánka nalévá kyselé víno z měchu a ukáže na rozkazy přibité ke stěžni. „Azkar platí bronzem. Mrtví neplatí nic.“"
          : "Hostinský utírá cínové poháry a kývne k tabuli. „Práce je dost. Lidí, co se vrátí, málo.“"}
      </p>
      <div className="mb-4">
        <div className="ash-meta mb-1"><span>Odvaha na dnešek</span><b>{ch.courage} / 100</b>{state.admin && <span>(správce bez omezení)</span>}</div>
        <div className="ash-bar courage"><i style={{ width: `${ch.courage}%` }} /></div>
      </div>

      {active ? (() => {
        const end = active.ends_at ? new Date(active.ends_at).getTime() : now;
        const start = active.started_at ? new Date(active.started_at).getTime() : now;
        const left = end - now;
        const pct = Math.min(100, Math.max(0, ((now - start) / Math.max(1, end - start)) * 100));
        return (
          <div className="ash-card hl ash-quest">
            <div className="ash-kicker mb-1">Na výpravě</div>
            <h3 className="ash-title">{active.title}</h3>
            <p className="ashes-prose">{active.story}</p>
            <EnemyLine enemy={active.enemy} />
            <div className="ash-bar mt-3"><i style={{ width: `${pct}%` }} /></div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button className="ash-btn" disabled={left > 0 || busy} onClick={() => onFinish(false)}>
                {left > 0 ? <><Hourglass className="h-4 w-4" /> Zbývá {fmtTime(left)}</> : <><Swords className="h-4 w-4" /> Utkat se s nepřítelem</>}
              </button>
              {state.admin && left > 0 && (
                <button className="ash-btn ghost small" disabled={busy} onClick={() => onFinish(true)}>Přeskočit čekání (správce)</button>
              )}
            </div>
          </div>
        );
      })() : (
        quests.map((q) => {
          const cost = 8 + q.minutes * 2;
          return (
            <div key={q.id} className="ash-card ash-quest">
              <h3 className="ash-title">{q.title}</h3>
              <p className="ashes-prose">{q.story}</p>
              <EnemyLine enemy={q.enemy} />
              <div className="ash-meta">
                <span><Hourglass className="mr-1 inline h-3.5 w-3.5" /><b>{q.minutes} min</b></span>
                <span><Sparkles className="mr-1 inline h-3.5 w-3.5" /><b>{fmtNum(q.xp)}</b> zkušeností</span>
                <span><Coins className="mr-1 inline h-3.5 w-3.5" /><b>{fmtNum(q.gold)}</b> zlata</span>
                <span>kořist {q.item_chance} %</span>
                <span>odvaha −{cost}</span>
              </div>
              <button
                className="ash-btn mt-3"
                disabled={busy || (!state.admin && ch.courage < cost)}
                onClick={() => act(() => ashesApi.startQuest(q.id), `Vydáváš se na výpravu: ${q.title}`)}
              >
                Vydat se na výpravu
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
      <span><b>{enemy.name}</b> · {CLASS_LABEL[enemy.class]} · úroveň {enemy.level}</span>
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
    <PanelShell title={ch.display_name} kicker={`${FACTION[ch.faction ?? "kalidra"].name} · ${CLASS_LABEL[ch.class]} · úroveň ${ch.level}`} onClose={onClose}>
      <div className="mb-3">
        <div className="ash-meta mb-1"><span>Zkušenosti</span><b>{fmtNum(ch.xp)} / {fmtNum(ch.xp_need)}</b></div>
        <div className="ash-bar"><i style={{ width: `${(ch.xp / ch.xp_need) * 100}%` }} /></div>
      </div>
      <div className="ash-meta mb-3">
        <span>Životy <b>{fmtNum(state.hp)}</b></span>
        <span>Poškození <b>{dmg(f.wmin)}–{dmg(f.wmax)}</b></span>
        <span>Zbroj <b>{f.armor}</b></span>
        <span>Kritický zásah <b>{critPct.toFixed(0)} %</b></span>
        <span>Výhry <b>{ch.wins}</b> / prohry <b>{ch.losses}</b></span>
      </div>

      <div className="ash-kicker mb-1">Vlastnosti a výcvik</div>
      <div className="mb-4">
        {STATS.map((s) => {
          const base = ch[s];
          const total = f[s];
          const cost = state.train_cost?.[s] ?? 0;
          return (
            <div key={s} className={`ash-stat ${s === main ? "main" : ""}`}>
              <span className="name">{STAT_LABEL[s]}{s === main ? " ★" : ""}</span>
              <span className="val">{total}{total > base && <small>(+{total - base})</small>}</span>
              <button className="ash-btn ghost small" disabled={busy || ch.gold < cost} onClick={() => act(() => ashesApi.train(s))} title={`Výcvik za ${cost} zlata`}>
                +1 · {fmtNum(cost)} <Coins className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="ash-kicker mb-2">Výbava</div>
      <div className="ash-slots mb-4">
        {SLOTS.map((slot) => {
          const it = equipped.find((i) => i.slot === slot);
          return (
            <button key={slot} className={`ash-slot ${it ? "filled" : ""}`} onClick={() => it && setSelected(selected === it.id ? null : it.id)} style={it ? { borderColor: `${RARITY[it.rarity].color}66` } : undefined}>
              <span className="slot">{SLOT_LABEL[slot]}</span>
              {it ? <span className="ash-item-name" style={{ color: RARITY[it.rarity].color }}>{it.name}</span> : <span className="text-[var(--ash-muted)]">prázdné</span>}
            </button>
          );
        })}
      </div>
      {selected && equipped.find((i) => i.id === selected) && (
        <div className="mb-4">
          <ItemCard
            item={equipped.find((i) => i.id === selected)!}
            actions={<button className="ash-btn ghost small" disabled={busy} onClick={() => act(() => ashesApi.equip(selected, false)).then(() => setSelected(null))}>Sundat</button>}
          />
        </div>
      )}

      <div className="ash-kicker mb-2">Batoh ({bag.length} / {state.bag_max ?? 12})</div>
      {bag.length === 0 && <p className="text-sm text-[var(--ash-muted)]">Batoh je prázdný. Kořist najdeš na výpravách a u kováře.</p>}
      {bag.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          compare={equipped.find((e) => e.slot === item.slot) ?? null}
          actions={
            <>
              <button className="ash-btn small" disabled={busy || item.level > ch.level + 2} onClick={() => act(() => ashesApi.equip(item.id, true))}>Nasadit</button>
              <button className="ash-btn ghost small" disabled={busy} onClick={() => act(() => ashesApi.sell(item.id), `Prodáno za ${Math.max(1, Math.floor(item.price / 4))} zlata`)}>
                Prodat · {fmtNum(Math.max(1, Math.floor(item.price / 4)))}
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
    <PanelShell title={ch.faction === "legie" ? "Polní kovárna Legie" : "Kovárna u výhně"} kicker="Bronz, kůže a talismany" onClose={onClose}>
      <p className="ashes-prose mb-3">
        {ch.faction === "legie"
          ? "Kovář Rukmar kalí čepele v moři. „Bronz Legie je černý od kouře. O to líp se v něm odráží oheň.“"
          : "Kovář Tharos ani nezvedne hlavu od kovadliny. „Bronz se nevrací. Bronz jde jen vpřed. Vyber si.“"}
      </p>
      <div className="ash-meta mb-3"><span>Tvé zlato <b>{fmtNum(ch.gold)}</b></span><span>Zboží se obměňuje každý den</span>{bagFull && <b className="text-[#e07a5f]">Batoh je plný</b>}</div>
      {error && <p className="ash-toast-error text-sm">{error}</p>}
      {!stock && !error && <p className="text-sm text-[var(--ash-muted)]">Kovář vykládá zboží…</p>}
      {stock?.length === 0 && <p className="text-sm text-[var(--ash-muted)]">Dnes je vyprodáno. Zítra ráno přiveze nový bronz.</p>}
      {stock?.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          compare={equipped.find((e) => e.slot === item.slot) ?? null}
          actions={
            <button className="ash-btn small" disabled={busy || ch.gold < item.price || bagFull} onClick={() => act(() => ashesApi.buy(item.id), `Koupeno: ${item.name}`)}>
              Koupit · {fmtNum(item.price)}
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
    <PanelShell title="Kruh kamenů" kicker="Aréna · souboje hráčů" onClose={onClose}>
      <p className="ashes-prose mb-3">V kruhu menhirů se měří obránci Kalidry i vojáci Legie. Vítěz bere čest, poražený poučení. Souboj s nepřítelem z druhé strany dává o polovinu víc cti a pohne hradbami.</p>
      <div className="ash-meta mb-3"><span>Tvá čest <b>{fmtNum(ch.honor)}</b></span>{wait > 0 && !state.admin && <span>Další souboj za <b>{fmtTime(wait)}</b></span>}</div>
      <div className="ash-tabs">
        <button data-active={tab === "souperi"} onClick={() => setTab("souperi")}>Soupeři</button>
        <button data-active={tab === "slava"} onClick={() => setTab("slava")}>Síň slávy</button>
      </div>
      {tab === "souperi" && (
        <>
          {!foes && <p className="text-sm text-[var(--ash-muted)]">Hledám soupeře…</p>}
          {foes?.length === 0 && <p className="text-sm text-[var(--ash-muted)]">Zatím tu nejsou jiní hrdinové. Až se probudí další, objeví se tady.</p>}
          {foes?.map((foe) => (
            <div key={foe.id} className={`ash-card ${foe.eryon || foe.azkar ? "hl" : ""}`}>
              <div className="flex items-center gap-3">
                {foe.eryon || foe.azkar ? <Crown className="h-5 w-5 text-[#ffcf8a]" /> : <Shield className="h-5 w-5" style={{ color: FACTION[foe.faction ?? "kalidra"].color }} />}
                <div className="min-w-0 flex-1">
                  <div className="ash-title">{foe.name}{(foe.eryon || foe.azkar) && <span className="ml-2 text-xs text-[#ffb27a]">legenda</span>}</div>
                  <div className="ash-meta"><span style={{ color: FACTION[foe.faction ?? "kalidra"].color }}>{FACTION[foe.faction ?? "kalidra"].short}{foe.faction !== ch.faction ? " · nepřítel" : ""}</span><span>{CLASS_LABEL[foe.class]}</span><span>úroveň <b>{foe.level}</b></span><span>čest <b>{fmtNum(foe.honor)}</b></span></div>
                </div>
                <button className="ash-btn blood small" disabled={busy || (wait > 0 && !state.admin)} onClick={() => foe.id && onFight(foe.id)}>
                  <Swords className="h-3.5 w-3.5" /> Vyzvat
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
              <span className="name">{i + 1}. {row.eryon || row.azkar ? "👑 " : ""}{row.name} <small style={{ color: FACTION[row.faction ?? "kalidra"].color }}>{FACTION[row.faction ?? "kalidra"].short}</small> <small className="text-[var(--ash-muted)]">{CLASS_LABEL[row.class]} · úr. {row.level}</small></span>
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
      title={legion ? "Tábor Legie" : "Hradby Kalidry"}
      kicker={actDone ? "1. akt dohrán" : `${FACTION[faction].name} · kapitola ${ch.chapter} z 6 · ${chapter.title}`}
      onClose={onClose}
    >
      <div className="ash-chapters mb-4">
        {CHAPTER_NAMES[faction].map((name, i) => (
          <div key={name} data-state={i + 1 < ch.chapter ? "done" : i + 1 === ch.chapter ? "now" : "todo"}>{i + 1}. {name}</div>
        ))}
      </div>

      {!actDone ? (
        <>
          <p className="ashes-prose">{chapter.intro}</p>
          <div className="mt-3">
            <div className="ash-meta mb-1"><span>Splněné výpravy kapitoly</span><b>{Math.min(ch.chapter_progress, chapter.need)} / {chapter.need}</b></div>
            <div className="ash-bar"><i style={{ width: `${Math.min(100, (ch.chapter_progress / chapter.need) * 100)}%` }} /></div>
          </div>
          <div className="ash-card hl mt-4">
            <div className="ash-kicker mb-1">Rozhodující bitva</div>
            <h3 className="ash-title text-lg">{chapter.boss.t}</h3>
            <p className="ashes-prose">{chapter.boss.s}</p>
            <div className="ash-enemy"><Skull className="h-4 w-4 text-[#d2492b]" /><span><b>{chapter.boss.e}</b> · {CLASS_LABEL[chapter.boss.c]}</span></div>
            {ally && (
              <p className="text-sm text-[#ffcf8a]"><Crown className="mr-1 inline h-4 w-4" />{ally === "azkar" ? "Azkar" : "Eryon"} bojuje po tvém boku: +25 % poškození.</p>
            )}
            <button className="ash-btn blood mt-3" disabled={busy || !canBoss} onClick={onBoss}>
              {ch.chapter_progress < chapter.need ? `Nejdřív splň výpravy (${ch.chapter_progress}/${chapter.need})` : bossReady > 0 && !state.admin ? `Odpočinek ${fmtTime(bossReady)}` : <><Flame className="h-4 w-4" /> Vyrazit do bitvy</>}
            </button>
          </div>
        </>
      ) : (
        <div className="ash-card hl">
          <p className="ashes-prose">{legion ? "Moře je černé… zítra bude rudé." : "Došli jsme k moři. A moře… už čekalo."}</p>
          <p className="text-sm text-[var(--ash-muted)]">1. akt je dohrán. Další akt se připravuje – zatím můžeš sílit na výpravách a v aréně.</p>
        </div>
      )}

      <div className="ash-rule my-5" />
      <div className="ash-kicker mb-1">Válka o Kalidru · všichni hráči</div>
      <div className="ash-meta mb-1">
        <span>Síla hradeb</span><b>{wallPct.toFixed(1)} %</b>
        <span style={{ color: FACTION.kalidra.color }}>Obránci {fmtNum(world.kalidra)}</span>
        <span style={{ color: FACTION.legie.color }}>Legie {fmtNum(world.legie)}</span>
      </div>
      <div className="ash-bar wall"><i style={{ width: `${wallPct}%` }} /></div>
      <p className="mt-2 text-xs text-[var(--ash-muted)]">
        {legion
          ? "Každé vítězství Legie hradby oslabí, každé vítězství obránců je zpevní. Zbořte je dřív, než je Kalidra znovu postaví."
          : "Každé vítězství obránců hradby zpevní, každé vítězství Legie je oslabí. Dokud stojí, stojí Kalidra."}
      </p>

      <div className="ash-rule my-5" />
      <div className="ash-kicker mb-2">{FACTION[faction].heroFull}</div>
      {heroShout ? (
        <blockquote className="ashes-prose border-l-2 border-[#b3160d] pl-3 italic">„{heroShout}“</blockquote>
      ) : (
        <p className="ashes-prose italic text-[var(--ash-muted)]">
          {legion ? "Azkar stojí u ohně a mlčky brousí meč." : "Eryon mlčí na hradbách a hledí k horám."}
        </p>
      )}
      {(canClaim || state.admin) && (
        <div className="ash-card mt-3">
          <div className="ash-kicker mb-2">{state.admin ? "Správce" : "Editor"}</div>
          <div className="flex flex-wrap gap-2">
            {canClaim && (
              <button className="ash-btn small" disabled={busy} onClick={() => act(() => ashesApi.claimHero(!isHero), isHero ? `${FACTION[faction].hero} je opět legendou.` : `Teď jsi ${FACTION[faction].hero}.`)}>
                <Crown className="h-3.5 w-3.5" /> {isHero ? `Vrátit ${legion ? "Azkara" : "Eryona"} legendě` : `Hrát za ${legion ? "Azkara" : "Eryona"}`}
              </button>
            )}
            {state.admin && (
              <button className="ash-btn ghost small" disabled={busy} onClick={() => act(() => ashesApi.adminWorld(!world.open_to_all), world.open_to_all ? "Hra je opět jen pro tým." : "Hra je otevřená všem přihlášeným hráčům.")}>
                {world.open_to_all ? "Zavřít hru (jen tým)" : "Otevřít hru všem hráčům"}
              </button>
            )}
          </div>
          {isHero && (
            <div className="mt-3">
              <textarea className="ash-textarea" maxLength={240} placeholder={`Co ${FACTION[faction].hero} řekne všem hráčům?`} value={shout} onChange={(e) => setShout(e.target.value)} />
              <button className="ash-btn small mt-2" disabled={busy || shout.trim().length < 2} onClick={() => act(() => ashesApi.heroSay(shout), `${FACTION[faction].hero} promluvil.`).then(() => setShout(""))}>
                Promluvit ke všem
              </button>
            </div>
          )}
          {state.admin && (
            <p className="mt-2 text-xs text-[var(--ash-muted)]">Hra je teď {world.open_to_all ? "otevřená všem přihlášeným" : "jen pro správce a editory"}.</p>
          )}
          {!canClaim && !legion && <p className="mt-2 text-xs text-[var(--ash-muted)]">Eryona může převzít jen správce.</p>}
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
    <PanelShell title="Bard u ohně" kicker={album ? `Album „${album.album}“ · ${album.artist}` : "Písně Kalidry"} onClose={onClose}>
      <p className="ashes-prose mb-3">Starý bard ladí lyru. „Kámen si pamatuje. Moře si pamatuje. A já zpívám, aby si to pamatovali i lidé.“</p>
      {!album && <p className="text-sm text-[var(--ash-muted)]">Bard hledá správné struny…</p>}
      <div className="flex flex-col gap-2">
        {album?.tracks.map((t) => (
          <button key={t.id} className="ash-track" data-active={t.id === track?.id} onClick={() => setSelected(t.id)}>
            {t.coverUrl ? <img src={t.coverUrl} alt="" /> : <div className="h-[52px] w-[52px] bg-black/50" />}
            <div className="min-w-0 flex-1">
              <div className="ash-title">{t.title}</div>
              <div className="ash-meta"><span>Kapitola {t.chapters.join(", ")}</span>{music.current?.id === t.id && music.playing && <b>hraje</b>}</div>
            </div>
            <span
              role="button"
              tabIndex={0}
              className="ash-icon-btn"
              onClick={(e) => { e.stopPropagation(); if (music.current?.id === t.id && music.playing) music.pause(); else void music.play(t); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); void music.play(t); } }}
              aria-label={music.current?.id === t.id && music.playing ? "Pozastavit" : "Přehrát"}
            >
              {music.current?.id === t.id && music.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button className="ash-icon-btn" onClick={() => music.toggleMute()} aria-label="Ztlumit">{music.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
        <input type="range" min={0} max={1} step={0.01} value={music.volume} onChange={(e) => music.setVolume(Number(e.target.value))} className="flex-1 accent-[#d2ae68]" aria-label="Hlasitost" />
      </div>
      {track && (
        <>
          <div className="ash-rule my-4" />
          <div className="ash-kicker mb-2">Text písně · {track.title}</div>
          <div className="ash-lyrics">{lyrics}</div>
        </>
      )}
    </PanelShell>
  );
}

/* ------------------------------ KRONIKA ------------------------------ */
export function ChroniclePanel({ state, others, onClose }: { state: GameState; others: PresenceHero[]; onClose: () => void }) {
  return (
    <PanelShell title="Kronika Kalidry" kicker="Co se děje ve světě" onClose={onClose}>
      <div className="ash-meta mb-3">
        <span style={{ color: FACTION.kalidra.color }}>Obránci Kalidry <b>{fmtNum(state.world?.kalidra)}</b></span>
        <span style={{ color: FACTION.legie.color }}>Legie Rudého slunce <b>{fmtNum(state.world?.legie)}</b></span>
      </div>
      <div className="ash-kicker mb-2">V tvém táboře právě teď ({others.length + 1})</div>
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="ash-card px-3 py-1 text-sm">{state.character?.display_name} <small className="text-[var(--ash-muted)]">(ty)</small></span>
        {others.map((o) => (
          <span key={o.key} className={`ash-card px-3 py-1 text-sm ${o.eryon || o.azkar ? "hl" : ""}`}>{o.name} <small className="text-[var(--ash-muted)]">úr. {o.level}</small></span>
        ))}
      </div>
      <div className="ash-kicker mb-2">Zápisy</div>
      {(state.chronicle ?? []).length === 0 && <p className="text-sm text-[var(--ash-muted)]">Kronika je zatím prázdná.</p>}
      {(state.chronicle ?? []).map((entry, i) => (
        <div key={i} className="ash-stat">
          <span className={entry.kind === "eryon" ? "ashes-prose italic text-[#ffcf8a]" : entry.kind === "azkar" ? "ashes-prose italic text-[#ff8a6a]" : ""}>{entry.text}</span>
          <span className="text-xs text-[var(--ash-muted)]">{new Date(entry.created_at).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
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
    { id: "kalidra", title: "Obránci Kalidry", hero: "Eryon, poslední štít", desc: "Braň město na pobřeží. Dokud stojí jeden z vás, Kalidra nepadne." },
    { id: "legie", title: "Legie Rudého slunce", hero: "Azkar, Syn Rudého slunce", desc: "Přišli jste z hor a z moře. Kalidra padne – nebo padnete vy." },
  ];

  const classes: { id: HeroClass; desc: string }[] = [
    { id: "hoplit", desc: "Bronzový štít a kopí. Hodně životů, blokuje údery." },
    { id: "lucistnik", desc: "Luk a rychlost. Vyhýbá se úderům, kritické zásahy." },
    { id: "vestec", desc: "Oheň a věštby. Ničivé kouzlo prochází zbrojí." },
  ];

  return (
    <section className="ash-create ash-frame">
      <header className="border-b border-[var(--ash-line)] px-5 pb-3 pt-4">
        <div className="ash-kicker">{faction === "legie" ? "Zátoka černých plachet" : "Bezejmenný břeh"}</div>
        <h2 className="ash-title m-0 text-xl">{faction === "legie" ? "Kdo vystupuje z černé lodi?" : "Kdo se probouzí v příboji?"}</h2>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="ash-kicker mb-2">Strana</div>
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
            ? "Černé lodě tě vysadily v zátoce. Azkar ukazuje mečem k městu na pobřeží: „Tam je Kalidra. Najdi mi k ní cestu.“"
            : "Moře tě vyplavilo mezi trosky. Pamatuješ si jen své jméno – a že v dálce hoří světla Kalidry."}
        </p>
        <label className="ash-kicker mb-1 block" htmlFor="ash-name">Jméno hrdiny</label>
        <input id="ash-name" className="ash-input mb-1" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="např. Tharion" autoComplete="off" />
        <p className="mb-4 text-xs text-[var(--ash-muted)]">3–20 znaků. Jména Eryon a Azkar patří legendám.</p>

        <div className="ash-kicker mb-2">Povolání</div>
        <div className="ash-classes mb-4">
          {classes.map((c) => (
            <button key={c.id} data-active={cls === c.id} onClick={() => setCls(c.id)}>
              <b>{CLASS_LABEL[c.id]}</b>
              <small>{c.desc}</small>
            </button>
          ))}
        </div>

        <div className="ash-kicker mb-2">Pleť</div>
        <div className="ash-swatches mb-4">{SKINS.map((c) => <button key={c} data-active={skin === c} style={{ background: c }} onClick={() => setSkin(c)} aria-label={`Pleť ${c}`} />)}</div>
        <div className="ash-kicker mb-2">{cls === "vestec" ? "Roucho" : "Plášť"}</div>
        <div className="ash-swatches mb-4">{CLOAKS.map((c) => <button key={c} data-active={cloak === c} style={{ background: c }} onClick={() => setCloak(c)} aria-label={`Plášť ${c}`} />)}</div>
        {cls === "hoplit" && (
          <>
            <div className="ash-kicker mb-2">Hřeben přilby</div>
            <div className="ash-swatches mb-4">{CRESTS.map((c) => <button key={c} data-active={crest === c} style={{ background: c }} onClick={() => setCrest(c)} aria-label={`Hřeben ${c}`} />)}</div>
          </>
        )}
      </div>
      <footer className="border-t border-[var(--ash-line)] px-5 py-4">
        <button className={`ash-btn w-full ${faction === "legie" ? "blood" : ""}`} disabled={!valid || busy} onClick={() => onCreate(name.trim(), cls, appearance, faction)}>
          {faction === "legie" ? "Vstoupit do Legie" : "Probudit se na břehu"}
        </button>
      </footer>
    </section>
  );
}
