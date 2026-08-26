import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Gamepad2, Radar, Radio, Loader2, Plus, Trash2, RefreshCw, Youtube, Twitch, Zap, Users,
} from "lucide-react";

type Game = {
  id: string;
  slug: string;
  name: string;
  color_tag: string;
  is_active: boolean;
  position: number;
};

type LfgRow = {
  id: string;
  user_id: string;
  game_id: string;
  note: string | null;
  created_at: string;
  expires_at: string;
};

type Prof = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  twitch_username: string | null;
  youtube_handle: string | null;
  kick_username: string | null;
};

type SubTab = "games" | "lfg" | "broadcast";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <div className="border border-primary/20 bg-[hsl(222_35%_5%/0.6)] p-4"
       style={{ clipPath: "polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)" }}>
    <div className="mb-3">
      <div className="font-display text-[11px] uppercase tracking-[0.28em] text-primary text-glow">{title}</div>
      {hint && <p className="text-[11px] font-mono text-muted-foreground mt-1">{hint}</p>}
    </div>
    {children}
  </div>
);

export function AppDevTools() {
  const { user, isAdmin } = useAuth();
  const [sub, setSub] = useState<SubTab>("lfg");

  // ---- games
  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#22d3ee");
  const [saving, setSaving] = useState(false);

  // ---- lfg
  const [lfg, setLfg] = useState<LfgRow[]>([]);
  const [myGames, setMyGames] = useState<Set<string>>(new Set());
  const [busyGame, setBusyGame] = useState<string | null>(null);
  const [loadingLfg, setLoadingLfg] = useState(true);

  // ---- broadcast
  const [profiles, setProfiles] = useState<Prof[]>([]);
  const [featured, setFeatured] = useState<Set<string>>(new Set());
  const [loadingBc, setLoadingBc] = useState(true);

  const loadGames = async () => {
    const { data } = await supabase
      .from("games")
      .select("id,slug,name,color_tag,is_active,position")
      .order("position");
    setGames((data ?? []) as Game[]);
    setLoadingGames(false);
  };

  const loadLfg = async () => {
    const [{ data: reqs }, { data: mine }] = await Promise.all([
      supabase.from("lfg_requests").select("*").order("created_at", { ascending: false }).limit(50),
      user ? supabase.from("user_games").select("game_id").eq("user_id", user.id) : Promise.resolve({ data: [] } as any),
    ]);
    setLfg((reqs ?? []) as LfgRow[]);
    setMyGames(new Set((mine ?? []).map((r: any) => r.game_id)));
    setLoadingLfg(false);
  };

  const loadBroadcast = async () => {
    const [{ data: profs }, { data: ovr }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id,display_name,username,twitch_username,youtube_handle,kick_username")
        .limit(500),
      supabase.from("streamer_overrides").select("user_id,is_included"),
    ]);
    setProfiles((profs ?? []) as Prof[]);
    setFeatured(new Set((ovr ?? []).filter((r: any) => r.is_included).map((r: any) => r.user_id)));
    setLoadingBc(false);
  };

  useEffect(() => { void loadGames(); void loadLfg(); }, [user]);
  useEffect(() => { if (sub === "broadcast" && loadingBc) void loadBroadcast(); }, [sub]);

  const gameById = useMemo(() => Object.fromEntries(games.map(g => [g.id, g])), [games]);

  const addGame = async () => {
    if (!newName.trim()) return toast.error("Zadej název hry");
    setSaving(true);
    const { error } = await supabase.from("games").insert({
      name: newName.trim(),
      slug: slugify(newName),
      color_tag: newColor,
      position: (games.at(-1)?.position ?? 100) + 1,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setNewName("");
    toast.success("Hra přidána do globálního katalogu");
    void loadGames();
  };

  const patchGame = async (g: Game, patch: Partial<Game>) => {
    const { error } = await supabase.from("games").update(patch as any).eq("id", g.id);
    if (error) return toast.error(error.message);
    setGames(prev => prev.map(x => (x.id === g.id ? { ...x, ...patch } : x)));
  };

  const deleteGame = async (g: Game) => {
    if (!confirm(`Smazat hru "${g.name}"? Odstraní i její servery a tagy.`)) return;
    const { error } = await supabase.from("games").delete().eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success("Smazáno");
    void loadGames();
  };

  const toggleMyGame = async (id: string) => {
    if (!user) return;
    setBusyGame(id);
    const has = myGames.has(id);
    const res = has
      ? await supabase.from("user_games").delete().eq("user_id", user.id).eq("game_id", id)
      : await supabase.from("user_games").insert({ user_id: user.id, game_id: id });
    setBusyGame(null);
    if (res.error) return toast.error(res.error.message);
    setMyGames(prev => {
      const n = new Set(prev);
      has ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const broadcastLfg = async (gameId: string) => {
    if (!user) return;
    const { error } = await supabase.from("lfg_requests").insert({ user_id: user.id, game_id: gameId });
    if (error) return toast.error(error.message);
    toast.success("LFG výzva vyslána");
    void loadLfg();
  };

  const killLfg = async (id: string) => {
    const { error } = await supabase.from("lfg_requests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setLfg(prev => prev.filter(r => r.id !== id));
  };

  const toggleFeatured = async (uid: string) => {
    const on = featured.has(uid);
    const { error } = await supabase
      .from("streamer_overrides")
      .upsert({ user_id: uid, is_included: !on }, { onConflict: "user_id" });
    if (error) return toast.error(error.message);
    setFeatured(prev => {
      const n = new Set(prev);
      on ? n.delete(uid) : n.add(uid);
      return n;
    });
  };

  if (!isAdmin) {
    return (
      <div className="p-6 border border-destructive/30 bg-destructive/5 text-sm font-mono text-muted-foreground">
        &gt; ACCESS DENIED // vývojářské nástroje jsou dostupné pouze pro administrátory.
      </div>
    );
  }

  const subs: { key: SubTab; label: string; icon: any }[] = [
    { key: "lfg", label: "LFG / Matchmaking", icon: Radar },
    { key: "games", label: "Hry & tagy", icon: Gamepad2 },
    { key: "broadcast", label: "Vysílací nástroje", icon: Radio },
  ];

  const platforms: { key: "twitch" | "youtube" | "kick"; label: string; icon: any; field: keyof Prof }[] = [
    { key: "twitch", label: "Twitch", icon: Twitch, field: "twitch_username" },
    { key: "youtube", label: "YouTube", icon: Youtube, field: "youtube_handle" },
    { key: "kick", label: "Kick.com", icon: Zap, field: "kick_username" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {subs.map(s => (
          <button
            key={s.key}
            onClick={() => setSub(s.key)}
            className={cn(
              "px-3 py-2 text-[11px] font-display uppercase tracking-[0.2em] border transition-colors flex items-center gap-2",
              sub === s.key
                ? "border-primary bg-primary/15 text-foreground shadow-[0_0_18px_hsl(var(--primary)/0.25)]"
                : "border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
            )}
            style={{ clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)" }}
          >
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {sub === "games" && (
        <>
          <Section title="// Nová hra" hint="Globální katalog her — používá se pro server list, tagy hráčů a LFG.">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Název</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Farming Simulator 25" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Barva tagu</Label>
                <Input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-20 p-1 h-10" />
              </div>
              <Button onClick={addGame} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                Přidat
              </Button>
            </div>
          </Section>

          <Section title="// Katalog" hint={`${games.length} her`}>
            {loadingGames ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <div className="space-y-2">
                {games.map(g => (
                  <div key={g.id} className="flex items-center gap-3 p-2 border border-border/60 bg-card/40">
                    <input
                      type="color"
                      value={g.color_tag || "#22d3ee"}
                      onChange={e => patchGame(g, { color_tag: e.target.value })}
                      className="w-8 h-8 bg-transparent border border-border cursor-pointer"
                      title="Barva tagu"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{g.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">/{g.slug}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Aktivní</span>
                      <Switch checked={g.is_active} onCheckedChange={v => patchGame(g, { is_active: v })} />
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteGame(g)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}

      {sub === "lfg" && (
        <>
          <Section title="// Moje hry" hint="Tagy, podle kterých tě matchmaking páruje s ostatními online hráči.">
            {loadingGames ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : games.filter(g => g.is_active).length === 0 ? (
              <p className="text-[11px] font-mono text-muted-foreground">
                &gt; Katalog je prázdný — přidej hru v sekci „Hry &amp; tagy“.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {games.filter(g => g.is_active).map(g => {
                  const on = myGames.has(g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() => toggleMyGame(g.id)}
                      disabled={busyGame === g.id}
                      className="px-3 py-2 text-xs border transition-all flex items-center gap-2"
                      style={{
                        borderColor: on ? g.color_tag : "hsl(var(--border))",
                        background: on ? `${g.color_tag}26` : "transparent",
                        clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)",
                      }}
                    >
                      {busyGame === g.id && <Loader2 className="w-3 h-3 animate-spin" />}
                      {g.name}
                    </button>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title="// Vyslat LFG výzvu" hint="Online hráči se stejným tagem dostanou HUD upozornění.">
            <div className="flex flex-wrap gap-2">
              {games.filter(g => myGames.has(g.id)).map(g => (
                <Button key={g.id} size="sm" variant="outline" onClick={() => broadcastLfg(g.id)}>
                  <Radar className="w-3.5 h-3.5 mr-1" />{g.name}
                </Button>
              ))}
              {games.filter(g => myGames.has(g.id)).length === 0 && (
                <p className="text-[11px] font-mono text-muted-foreground">&gt; Nejdřív si vyber alespoň jednu hru výše.</p>
              )}
            </div>
          </Section>

          <Section title="// Aktivní výzvy" hint="Přehled všech LFG requestů — jako admin je můžeš zrušit.">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-muted-foreground">{lfg.length} záznamů</span>
              <Button size="sm" variant="ghost" onClick={() => void loadLfg()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />Obnovit
              </Button>
            </div>
            {loadingLfg ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : lfg.length === 0 ? (
              <p className="text-[11px] font-mono text-muted-foreground">&gt; Žádné aktivní výzvy.</p>
            ) : (
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {lfg.map(r => {
                  const g = gameById[r.game_id];
                  const expired = new Date(r.expires_at).getTime() < Date.now();
                  return (
                    <li key={r.id} className="flex items-center gap-3 p-2 border border-border/60 bg-card/40 text-xs">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: g?.color_tag ?? "#666", boxShadow: `0 0 8px ${g?.color_tag ?? "#666"}` }}
                      />
                      <span className="font-medium truncate">{g?.name ?? "Neznámá hra"}</span>
                      <span className="font-mono text-muted-foreground truncate">{r.user_id.slice(0, 8)}…</span>
                      <span className={cn("ml-auto font-mono", expired ? "text-destructive" : "text-primary")}>
                        {expired ? "EXPIRED" : "LIVE"}
                      </span>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => killLfg(r.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </>
      )}

      {sub === "broadcast" && (
        <>
          <p className="text-[11px] font-mono text-muted-foreground">
            &gt; BROADCAST OPS // kategorizované nástroje pro Twitch, YouTube a Kick. Přepínač určuje, kdo se objeví v
            sekci „Live Now / Aktivní streameři“.
          </p>
          {loadingBc ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : (
            platforms.map(p => {
              const list = profiles.filter(pr => !!(pr as any)[p.field]);
              return (
                <Section key={p.key} title={`// ${p.label}`} hint={`${list.length} propojených účtů`}>
                  {list.length === 0 ? (
                    <p className="text-[11px] font-mono text-muted-foreground">
                      &gt; Nikdo nemá propojený {p.label} účet (Nastavení → Propojení).
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {list.map(pr => (
                        <li key={pr.user_id} className="flex items-center gap-3 p-2 border border-border/60 bg-card/40 text-xs">
                          <p.icon className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-medium truncate">
                            {pr.display_name || pr.username || "Hráč"}
                          </span>
                          <span className="font-mono text-muted-foreground truncate">
                            {String((pr as any)[p.field])}
                          </span>
                          <div className="ml-auto flex items-center gap-2 shrink-0">
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Featured</span>
                            <Switch checked={featured.has(pr.user_id)} onCheckedChange={() => toggleFeatured(pr.user_id)} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              );
            })
          )}
          <Section title="// Připraveno pro rozšíření" hint="Další nástroje doplníme podle zadání.">
            <div className="grid sm:grid-cols-3 gap-2 text-[11px] font-mono text-muted-foreground">
              <div className="p-3 border border-border/60">Twitch: chat bot, klipy, raid alerty</div>
              <div className="p-3 border border-border/60">YouTube: WebSub, premiéry, live chat</div>
              <div className="p-3 border border-border/60">Kick: polling, alerty, moderace</div>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
