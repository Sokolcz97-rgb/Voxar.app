import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Beer, Castle, Coins, Flame, Hammer, LogOut, Music, ScrollText, Shield, Sparkles, Swords, Trophy, User, Volume2, VolumeX,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ashesApi } from "./api";
import { music } from "./audio";
import { AshesWorld, LOCATIONS, type BattleEvent, type FrameAnchors, type LocationId } from "./three/world";
import {
  ArenaPanel, BardPanel, ChroniclePanel, CreateCharacter, HeroPanel, SmithyPanel, TavernPanel, WallsPanel, fmtNum,
} from "./ui/panels";
import { CLASS_LABEL, RARITY, type Appearance, type FightResult, type Fighter, type GameState, type HeroClass, type PresenceHero } from "./types";
import "./ashes.css";

type PanelId = LocationId | "kronika";

const NAV: { id: PanelId; label: string; icon: typeof Beer }[] = [
  { id: "krcma", label: "Krčma", icon: Beer },
  { id: "postava", label: "Hrdina", icon: User },
  { id: "kovarna", label: "Kovárna", icon: Hammer },
  { id: "arena", label: "Aréna", icon: Swords },
  { id: "hradby", label: "Hradby a Eryon", icon: Castle },
  { id: "bard", label: "Bard", icon: Music },
  { id: "kronika", label: "Kronika", icon: ScrollText },
];

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VI"];

type BattleState = {
  f1: Fighter;
  f2: Fighter;
  max1: number;
  max2: number;
  hp1: number;
  hp2: number;
  done: boolean;
};

type Pop = { id: number; x: number; y: number; text: string; kind: "hit" | "crit" | "miss" };

function useServerNow(serverIso?: string) {
  const offset = useRef(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (serverIso) offset.current = new Date(serverIso).getTime() - Date.now();
  }, [serverIso]);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

export default function AshesGame() {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<GameState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [busy, setBusy] = useState(false);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [pops, setPops] = useState<Pop[]>([]);
  const [result, setResult] = useState<(FightResult & { kind: "quest" | "boss" | "arena" }) | null>(null);
  const [hover, setHover] = useState<LocationId | null>(null);
  const [others, setOthers] = useState<PresenceHero[]>([]);
  const [, forceMusic] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<AshesWorld | null>(null);
  const popId = useRef(0);
  const now = useServerNow(state?.now);

  const character = state?.character ?? null;

  // Načtení stavu ze serveru
  const refresh = useCallback(async () => {
    try {
      const next = await ashesApi.state();
      setState(next);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Svět se nepodařilo načíst.");
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    void refresh();
    const t = window.setInterval(() => void refresh(), 45_000);
    return () => window.clearInterval(t);
  }, [authLoading, user, refresh]);

  useEffect(() => {
    const off = music.subscribe(() => forceMusic((n) => n + 1));
    return () => {
      off();
    };
  }, []);
  useEffect(() => () => music.stop(), []);

  // 3D svět
  useEffect(() => {
    if (!state?.allowed || !hostRef.current || worldRef.current) return;
    let world: AshesWorld;
    try {
      world = new AshesWorld(hostRef.current);
    } catch {
      setLoadError("Tvůj prohlížeč nepodporuje WebGL, bez kterého 3D svět nepoběží.");
      return;
    }
    worldRef.current = world;
    world.onHover = setHover;
    world.onSelect = (id) => setPanel(id);
    world.onFrame = (anchors: FrameAnchors) => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      overlay.querySelectorAll<HTMLElement>("[data-loc]").forEach((el) => {
        const p = anchors.locations[el.dataset.loc as string];
        if (!p) return;
        el.style.display = p.visible ? "" : "none";
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
      });
      overlay.querySelectorAll<HTMLElement>("[data-other]").forEach((el) => {
        const p = anchors.others[el.dataset.other as string];
        el.style.display = p?.visible ? "" : "none";
        if (p) {
          el.style.left = `${p.x}px`;
          el.style.top = `${p.y}px`;
        }
      });
      const eryonEl = overlay.querySelector<HTMLElement>("[data-eryon]");
      if (eryonEl) {
        const p = anchors.eryon;
        eryonEl.style.display = p?.visible ? "" : "none";
        if (p) {
          eryonEl.style.left = `${p.x}px`;
          eryonEl.style.top = `${p.y}px`;
        }
      }
    };
    return () => {
      world.dispose();
      worldRef.current = null;
    };
  }, [state?.allowed]);

  // Postava hráče ve scéně
  const shieldOn = !!state?.items?.some((i) => i.equipped && i.slot === "stit");
  useEffect(() => {
    const world = worldRef.current;
    if (!world || !character) return;
    world.setPlayer(character.class, character.appearance ?? {}, character.is_eryon, shieldOn || character.class === "hoplit");
  }, [character?.class, character?.appearance, character?.is_eryon, shieldOn, state?.allowed, character]);

  useEffect(() => {
    const world = worldRef.current;
    if (!world || battle) return;
    if (!character) world.setView("create");
    else world.setView(panel === "postava" ? "portrait" : "hub");
  }, [panel, character, battle, state?.allowed]);

  // Ostatní hráči na břehu (realtime presence)
  useEffect(() => {
    if (!character || !user) return;
    const channel = supabase.channel("ashes:shore", { config: { presence: { key: user.id } } });
    channel.on("presence", { event: "sync" }, () => {
      const raw = channel.presenceState<PresenceHero>();
      const list: PresenceHero[] = [];
      for (const [key, metas] of Object.entries(raw)) {
        if (key === user.id) continue;
        const m = metas[0];
        if (m) list.push({ ...m, key });
      }
      setOthers(list);
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({
          name: character.display_name,
          cls: character.class,
          level: character.level,
          appearance: character.appearance ?? {},
          eryon: character.is_eryon,
        });
      }
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [character?.display_name, character?.level, character?.is_eryon, character?.class, user, character]);

  useEffect(() => {
    worldRef.current?.setOthers(others);
  }, [others, state?.allowed]);

  // Hudba podle kapitoly
  useEffect(() => {
    if (!entered || !character) return;
    void music.loadAlbum().then(() => music.play(music.trackForChapter(character.chapter)));
  }, [entered, character?.chapter, character]);

  const act = useCallback(async (fn: () => Promise<GameState>, success?: string) => {
    setBusy(true);
    try {
      const next = await fn();
      setState(next);
      if (success) toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Akce se nepodařila.");
    } finally {
      setBusy(false);
    }
  }, []);

  const runFight = useCallback(async (kind: "quest" | "boss" | "arena", promise: () => Promise<FightResult>) => {
    const world = worldRef.current;
    if (!world) return;
    setBusy(true);
    let res: FightResult;
    try {
      res = await promise();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Souboj se nepodařil.");
      setBusy(false);
      return;
    }
    setPanel(null);
    const onEvent = (e: BattleEvent) => {
      if (e.type === "start") {
        setBattle({ f1: e.f1, f2: e.f2, max1: e.hp1, max2: e.hp2, hp1: e.hp1, hp2: e.hp2, done: false });
      } else if (e.type === "round") {
        setBattle((b) => (b ? { ...b, hp1: e.hp1, hp2: e.hp2 } : b));
        const id = (popId.current += 1);
        const text = e.evaded ? "Úhyb!" : e.blocked ? "Blok!" : `${e.crit ? "Kritický! " : ""}-${fmtNum(e.damage)}`;
        setPops((list) => [...list, { id, x: e.at.x, y: e.at.y, text, kind: e.evaded || e.blocked ? "miss" : e.crit ? "crit" : "hit" }]);
        window.setTimeout(() => setPops((list) => list.filter((p) => p.id !== id)), 1200);
      } else {
        setBattle((b) => (b ? { ...b, done: true } : b));
      }
    };
    await world.playFight(res.fight, onEvent, !!res.eryon_ally);
    setResult({ ...res, kind });
    setState(res.state);
    setBusy(false);
  }, []);

  const closeResult = () => {
    const leveled = (result?.levels ?? 0) > 0;
    setResult(null);
    setBattle(null);
    setPops([]);
    worldRef.current?.setView("hub");
    if (leveled) toast.success("Nová úroveň! Tvé síly rostou.");
  };

  const enter = () => {
    setEntered(true);
    void music.loadAlbum().then(() => {
      if (character) void music.play(music.trackForChapter(character.chapter));
      else void music.play(music.trackForChapter(1));
    });
  };

  const onPreview = useCallback((cls: HeroClass, appearance: Appearance) => {
    worldRef.current?.setPlayer(cls, appearance, false, cls === "hoplit");
  }, []);

  const shoutFresh = useMemo(() => {
    const at = state?.world?.eryon_shout_at ? new Date(state.world.eryon_shout_at).getTime() : 0;
    return state?.world?.eryon_shout && now - at < 1000 * 60 * 60 * 24 ? state.world.eryon_shout : null;
  }, [state?.world?.eryon_shout, state?.world?.eryon_shout_at, now]);

  const activeQuest = state?.quests?.find((q) => q.state === "active");
  const questReady = activeQuest?.ends_at ? new Date(activeQuest.ends_at).getTime() <= now : false;

  // ------------------------------------------------------------ obrazovky mimo hru
  if (authLoading || (user && !state && !loadError)) {
    return <div className="ashes-root"><div className="ash-loading">Probouzím svět…</div></div>;
  }

  if (!user || (state && !state.allowed) || (loadError && !state)) {
    return (
      <div className="ashes-root">
        <div className="ash-title-screen">
          <div className="ash-title-inner">
            <img src="/game/eryon/wordmark.webp" alt="Ashes of Eryon" />
            {!user ? (
              <>
                <p className="ashes-prose">Do světa Kalidry vstoupíš se svým účtem StudioVoxario.</p>
                <Link className="ash-btn" to="/auth?next=/hra">Přihlásit se</Link>
              </>
            ) : loadError ? (
              <p className="ashes-prose">{loadError}</p>
            ) : (
              <>
                <button className="ash-btn" disabled>Připravuje se…</button>
                <p className="ashes-prose">Bezejmenný břeh se teprve probouzí. Brzy otevřeme brány Kalidry všem hráčům.</p>
              </>
            )}
            <Link to="/" className="ash-btn ghost small">Zpět na StudioVoxario</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!state) return null;
  const world = state.world;

  return (
    <div className="ashes-root">
      <div ref={hostRef} className="ashes-canvas" />
      <div className="ashes-vignette" />

      {/* popisky ve 3D scéně */}
      <div ref={overlayRef} className="absolute inset-0" style={{ pointerEvents: "none" }}>
        {character && !battle && panel !== "postava" && LOCATIONS.map((loc) => (
          <button
            key={loc.id}
            data-loc={loc.id}
            data-hover={hover === loc.id}
            className="ash-loc"
            style={{ pointerEvents: "auto", display: "none" }}
            onClick={() => setPanel(loc.id)}
          >
            {loc.id === "postava" ? character.display_name : loc.label}
            {loc.id === "krcma" && questReady && " ⚔"}
          </button>
        ))}
        {character && !battle && others.map((o) => (
          <div key={o.key} data-other={o.key} className={`ash-tag ${o.eryon ? "eryon" : ""}`} style={{ display: "none" }}>
            {o.name} · {o.level}
          </div>
        ))}
        {character && !battle && !character.is_eryon && (
          <div data-eryon className="ash-tag eryon" style={{ display: "none" }}>Eryon</div>
        )}
      </div>

      {/* horní lišta */}
      <header className="ash-hud">
        <img className="wordmark" src="/game/eryon/wordmark.webp" alt="Ashes of Eryon" />
        {character && state.chapter && (
          <div className="chapter">
            <span>{character.chapter > 6 ? "1. akt dohrán" : `1. akt · kapitola ${ROMAN[character.chapter - 1]}`}</span>
            <b>{state.chapter.title}</b>
          </div>
        )}
        <div className="stats">
          {character && (
            <>
              <span className="ash-pill" title="Zlato"><Coins />{fmtNum(character.gold)}</span>
              <span className="ash-pill hide-sm" title="Čest"><Trophy />{fmtNum(character.honor)}</span>
              <span className="ash-pill hide-sm" title="Odvaha"><Flame />{character.courage}</span>
              <span className="ash-pill hide-sm" title="Síla hradeb Kalidry"><Shield />{world ? ((world.wall / world.wall_max) * 100).toFixed(0) : "—"} %</span>
              <div className="ash-hero-chip">
                <div className="lvl">{character.level}</div>
                <div className="hidden min-w-[120px] sm:block">
                  <div className="name">{character.display_name}</div>
                  <div className="ash-bar mt-1" style={{ height: 5 }}><i style={{ width: `${(character.xp / character.xp_need) * 100}%` }} /></div>
                </div>
              </div>
            </>
          )}
          <button className="ash-icon-btn" onClick={() => (music.playing ? music.pause() : music.current ? void music.resume() : enter())} aria-label="Hudba">
            {music.playing && !music.muted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <Link to="/" className="ash-icon-btn" aria-label="Odejít ze hry" title="Odejít ze hry"><LogOut className="h-4 w-4" /></Link>
        </div>
      </header>

      {shoutFresh && !battle && (
        <div className="ash-eryon-banner"><b>Eryon promlouvá</b>„{shoutFresh}“</div>
      )}

      {/* tvorba postavy */}
      {!character && entered && (
        <CreateCharacter
          busy={busy}
          onPreview={onPreview}
          onCreate={(name, cls, appearance) => act(() => ashesApi.createCharacter(name, cls, appearance), `Vítej na Bezejmenném břehu, ${name}.`)}
        />
      )}

      {/* nabídka */}
      {character && !battle && (
        <nav className="ash-nav" aria-label="Místa">
          {NAV.map((item) => (
            <button key={item.id} data-active={panel === item.id} onClick={() => setPanel(panel === item.id ? null : item.id)}>
              <item.icon />
              <span>{item.label}</span>
              {item.id === "krcma" && questReady && <i className="badge">!</i>}
              {item.id === "hradby" && state.chapter && character.chapter <= 6 && character.chapter_progress >= state.chapter.need && <i className="badge">⚔</i>}
            </button>
          ))}
        </nav>
      )}

      {/* panely */}
      {character && !battle && panel === "krcma" && (
        <TavernPanel state={state} now={now} act={act} busy={busy} onClose={() => setPanel(null)} onFinish={(skip) => runFight("quest", () => ashesApi.finishQuest(skip))} />
      )}
      {character && !battle && panel === "postava" && <HeroPanel state={state} act={act} busy={busy} onClose={() => setPanel(null)} />}
      {character && !battle && panel === "kovarna" && <SmithyPanel state={state} act={act} busy={busy} onClose={() => setPanel(null)} />}
      {character && !battle && panel === "arena" && (
        <ArenaPanel state={state} now={now} busy={busy} onClose={() => setPanel(null)} onFight={(id) => runFight("arena", () => ashesApi.arenaFight(id))} />
      )}
      {character && !battle && panel === "hradby" && (
        <WallsPanel state={state} now={now} act={act} busy={busy} onClose={() => setPanel(null)} onBoss={() => runFight("boss", () => ashesApi.fightBoss())} />
      )}
      {character && !battle && panel === "bard" && <BardPanel chapter={character.chapter} onClose={() => setPanel(null)} />}
      {character && !battle && panel === "kronika" && <ChroniclePanel state={state} others={others} onClose={() => setPanel(null)} />}

      {/* souboj */}
      {battle && (
        <>
          <div className="ash-battle-hud">
            {[1, 2].map((side) => {
              const f = side === 1 ? battle.f1 : battle.f2;
              const hp = side === 1 ? battle.hp1 : battle.hp2;
              const max = side === 1 ? battle.max1 : battle.max2;
              const plate = (
                <div key={side} className="ash-frame ash-fplate" style={{ textAlign: side === 1 ? "left" : "right" }}>
                  <div className="n">{f.name}</div>
                  <div className="s">{CLASS_LABEL[f.class]} · úroveň {f.level}</div>
                  <div className="ash-bar hp"><i style={side === 2 ? { width: `${(hp / max) * 100}%`, left: "auto", right: 0 } : { width: `${(hp / max) * 100}%` }} /></div>
                  <div className="hpnum">{fmtNum(hp)} / {fmtNum(max)}</div>
                </div>
              );
              return side === 1 ? [plate, <div key="vs" className="ash-vs">VS</div>] : plate;
            })}
          </div>
          {pops.map((p) => (
            <div key={p.id} className={`ash-pop ${p.kind === "crit" ? "crit" : p.kind === "miss" ? "miss" : ""}`} style={{ left: p.x, top: p.y }}>{p.text}</div>
          ))}
          {!battle.done && (
            <div className="ash-battle-controls">
              <button className="ash-btn ghost small" onClick={() => worldRef.current?.setBattleSpeed(3)}>Zrychlit ×3</button>
              <button className="ash-btn ghost small" onClick={() => worldRef.current?.abortBattle()}>Přeskočit</button>
            </div>
          )}
        </>
      )}

      {result && (
        <div className="ash-modal-wrap">
          <div className="ash-modal ash-frame">
            <div className="ash-kicker">{result.kind === "boss" ? "Rozhodující bitva" : result.kind === "arena" ? "Aréna" : result.title}</div>
            <h2 className={`ash-title ${result.won ? "win" : "lose"}`}>{result.won ? "Vítězství" : "Porážka"}</h2>
            {result.kind === "boss" && result.won && result.boss?.win && <p className="ashes-prose">{result.boss.win}</p>}
            {result.kind === "boss" && !result.won && <p className="ashes-prose">Padl jsi, ale Kalidra stále stojí. Posil se a vrať se.</p>}
            {result.kind === "quest" && !result.won && <p className="ashes-prose">Nepřítel tě zahnal. Aspoň sis odnesl zkušenost.</p>}
            <div className="ash-rewards">
              {!!result.xp && <span><Sparkles className="mr-1 inline h-4 w-4 text-[var(--ash-gold)]" />+{fmtNum(result.xp)} zkušeností</span>}
              {!!result.gold && <span><Coins className="mr-1 inline h-4 w-4 text-[var(--ash-gold)]" />+{fmtNum(result.gold)} zlata</span>}
              {typeof result.honor === "number" && <span><Trophy className="mr-1 inline h-4 w-4 text-[var(--ash-gold)]" />{result.honor > 0 ? "+" : ""}{result.honor} cti</span>}
              {(result.levels ?? 0) > 0 && <b className="text-[#f2cf86]">Nová úroveň!</b>}
            </div>
            {result.item && (
              <p className="mb-3">
                Kořist: <b style={{ color: RARITY[result.item.rarity]?.color }}>{result.item.name}</b>
              </p>
            )}
            <button className="ash-btn" onClick={closeResult}>Pokračovat</button>
          </div>
        </div>
      )}

      {!entered && (
        <div className="ash-title-screen">
          <div className="ash-title-inner">
            <img src="/game/eryon/wordmark.webp" alt="Ashes of Eryon" />
            <p className="ashes-prose">
              {character
                ? `${character.display_name} čeká na Bezejmenném břehu. Kalidra stále stojí.`
                : "Moře tě vyplavilo na Bezejmenném břehu. V dálce hoří světla Kalidry."}
            </p>
            <button className="ash-btn" onClick={enter}>{character ? "Vrátit se na břeh" : "Vstoupit do světa"}</button>
            <p className="text-xs text-[var(--ash-muted)]">Alfa verze · 1. akt · hudba: album „Eryon“</p>
          </div>
        </div>
      )}
    </div>
  );
}
