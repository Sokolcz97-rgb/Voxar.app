import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Trophy, Plus, Minus, RefreshCw, Trash2, Save } from "lucide-react";
import { GuildResourceSelect } from "@/components/GuildResourceSelect";
import { MultiChannelPicker } from "@/components/MultiChannelPicker";
import { MultiRolePicker } from "@/components/MultiRolePicker";

type PointsConfig = {
  guild_id: string;
  enabled: boolean;
  minutes_per_point: number;
  goal_channel_id: string | null;
  milestones: number[];
  repeat_every: number;
  announce_message: string;
  ignore_afk: boolean;
  ignore_muted: boolean;
  ignore_deafened: boolean;
  min_members: number;
  ignored_channel_ids: string[];
  bonus_role_ids: string[];
  bonus_multiplier: number;
};

type LeaderRow = {
  user_id: string;
  points: number;
  total_minutes: number;
  last_milestone: number;
};

type MemberInfo = {
  id: string;
  nick: string | null;
  username: string;
  global_name: string | null;
  avatar_url: string | null;
};

const DEFAULTS = (guildId: string): PointsConfig => ({
  guild_id: guildId,
  enabled: true,
  minutes_per_point: 10,
  goal_channel_id: null,
  milestones: [10, 100, 1000],
  repeat_every: 0,
  announce_message: "🎉 {user} právě dosáhl **{points} bodů**! Skvělá práce v hlasovém kanálu.",
  ignore_afk: true,
  ignore_muted: true,
  ignore_deafened: true,
  min_members: 2,
  ignored_channel_ids: [],
  bonus_role_ids: [],
  bonus_multiplier: 1,
});

function fmtMinutes(min: number) {
  if (!min) return "0 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} h ${m} min`;
}

export function PointsPanel({ guildId, isManager }: { guildId: string | null; isManager: boolean }) {
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<PointsConfig | null>(null);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [adjUserId, setAdjUserId] = useState("");
  const [adjDelta, setAdjDelta] = useState<number>(10);
  const [adjReason, setAdjReason] = useState("");
  const [adjBusy, setAdjBusy] = useState(false);
  const [milestonesText, setMilestonesText] = useState("");
  const [members, setMembers] = useState<Record<string, MemberInfo>>({});

  useEffect(() => {
    if (!guildId) { setCfg(null); setBoard([]); setMembers({}); setLoading(false); return; }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  const load = async () => {
    if (!guildId) return;
    setLoading(true);
    const [c, b] = await Promise.all([
      supabase.from("bot_points_config").select("*").eq("guild_id", guildId).maybeSingle(),
      supabase.from("bot_points").select("user_id, points, total_minutes, last_milestone").eq("guild_id", guildId).order("points", { ascending: false }).limit(25),
    ]);
    let row = c.data as PointsConfig | null;
    if (!row) {
      const ins = await supabase.from("bot_points_config").insert(DEFAULTS(guildId)).select().maybeSingle();
      row = (ins.data as PointsConfig | null) ?? DEFAULTS(guildId);
    }
    setCfg(row);
    setMilestonesText((row.milestones ?? []).join(", "));
    const rows = (b.data as LeaderRow[]) ?? [];
    setBoard(rows);
    setLoading(false);
    // Fetch nicknames in background
    if (rows.length > 0) {
      void fetchMembers(rows.map((r) => r.user_id));
    } else {
      setMembers({});
    }
  };

  const fetchMembers = async (ids: string[]) => {
    if (!guildId || ids.length === 0) return;
    try {
      const { data, error } = await supabase.functions.invoke("discord-guild-members", {
        body: { guild_id: guildId, user_ids: ids },
      });
      if (error) return;
      const m = (data as { members?: Record<string, MemberInfo> })?.members ?? {};
      setMembers(m);
    } catch { /* ignore */ }
  };

  const displayName = (uid: string) => {
    const m = members[uid];
    if (!m) return null;
    return m.nick || m.global_name || m.username || null;
  };

  const save = async () => {
    if (!cfg || !guildId) return;
    setSaving(true);
    const milestones = milestonesText.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n) && n > 0);
    const payload = { ...cfg, milestones, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("bot_points_config").update(payload).eq("guild_id", guildId);
    setSaving(false);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Uloženo", description: "Změny se projeví do 30 s (bot cachuje konfiguraci)." });
      setCfg({ ...cfg, milestones });
    }
  };

  const adjust = async (mode: "add" | "remove" | "set" | "reset") => {
    if (!guildId) return;
    const uid = adjUserId.trim();
    if (!uid) { toast({ title: "Chybí Discord ID uživatele", variant: "destructive" }); return; }
    setAdjBusy(true);
    try {
      const { data: prev } = await supabase.from("bot_points").select("points").eq("guild_id", guildId).eq("user_id", uid).maybeSingle();
      const cur = prev?.points ?? 0;
      let next = cur;
      let delta = 0;
      if (mode === "add") { delta = adjDelta; next = Math.max(0, cur + delta); }
      else if (mode === "remove") { delta = -adjDelta; next = Math.max(0, cur + delta); }
      else if (mode === "set") { delta = adjDelta - cur; next = Math.max(0, adjDelta); }
      else if (mode === "reset") {
        await supabase.from("bot_points").delete().eq("guild_id", guildId).eq("user_id", uid);
        await supabase.from("bot_points_log").insert({ guild_id: guildId, user_id: uid, delta: 0, reason: adjReason || "reset" });
        toast({ title: "Body vymazány" });
        setAdjUserId("");
        setAdjReason("");
        await load();
        return;
      }
      await supabase.from("bot_points").upsert({
        guild_id: guildId, user_id: uid, points: next, updated_at: new Date().toISOString(),
      }, { onConflict: "guild_id,user_id" });
      await supabase.from("bot_points_log").insert({
        guild_id: guildId, user_id: uid, delta, reason: adjReason || null,
      });
      toast({ title: "Hotovo", description: `Nová hodnota: ${next} bodů` });
      setAdjUserId("");
      setAdjReason("");
      await load();
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setAdjBusy(false);
    }
  };

  if (!guildId) {
    return <Card className="glass border-border p-6 text-sm text-muted-foreground">Vyber konkrétní server — bodový systém se konfiguruje per server.</Card>;
  }
  if (loading || !cfg) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Načítám…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header / intro */}
      <Card className="glass border-border p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display text-2xl font-bold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" /> Bodový systém
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Uživatelé získávají body za čas strávený v hlasových kanálech. Po dosažení milníku bot pošle
              oznámení do „goal“ kanálu. Body může admin ručně přidat, odebrat nebo vynulovat
              (např. pro eventy a soutěže). Uživatelé si své body zobrazí přes <code>/body me</code>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={cfg.enabled ? "default" : "secondary"}>{cfg.enabled ? "Aktivní" : "Vypnuto"}</Badge>
            <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} disabled={!isManager} />
          </div>
        </div>
      </Card>

      {/* Basic settings */}
      <Card className="glass border-border p-6 space-y-4">
        <h3 className="font-display font-bold">Základní pravidla</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Minuty za 1 bod</Label>
            <Input
              type="number" min={1} max={240}
              value={cfg.minutes_per_point}
              onChange={(e) => setCfg({ ...cfg, minutes_per_point: parseInt(e.target.value) || 10 })}
              disabled={!isManager}
            />
            <p className="text-xs text-muted-foreground mt-1">Výchozí 10 min = 1 bod. Změna se týká pouze <em>nově</em> získaných bodů, staré časy se přepočítávají průběžně z celkových minut.</p>
          </div>
          <div>
            <Label>Min. lidí v kanálu</Label>
            <Input
              type="number" min={1} max={50}
              value={cfg.min_members}
              onChange={(e) => setCfg({ ...cfg, min_members: parseInt(e.target.value) || 1 })}
              disabled={!isManager}
            />
            <p className="text-xs text-muted-foreground mt-1">Aby se nesbírala body samotou. 1 = počítá i sólo.</p>
          </div>
          <div>
            <Label>Goal kanál (kam posílat oznámení o milnících)</Label>
            <GuildResourceSelect
              guildId={guildId} kind="text"
              value={cfg.goal_channel_id}
              onChange={(v) => setCfg({ ...cfg, goal_channel_id: v })}
              disabled={!isManager} placeholder="Vyber kanál"
            />
          </div>
          <div>
            <Label>Milníky (čárkou oddělené hodnoty)</Label>
            <Input
              value={milestonesText}
              onChange={(e) => setMilestonesText(e.target.value)}
              placeholder="10, 100, 1000"
              disabled={!isManager}
            />
            <p className="text-xs text-muted-foreground mt-1">Discrétní milníky — bot je oznámí, jakmile je uživatel dosáhne.</p>
          </div>
          <div>
            <Label>Opakovaný milník po X bodech (0 = vypnuto)</Label>
            <Input
              type="number" min={0}
              value={cfg.repeat_every}
              onChange={(e) => setCfg({ ...cfg, repeat_every: parseInt(e.target.value) || 0 })}
              disabled={!isManager}
            />
            <p className="text-xs text-muted-foreground mt-1">Např. 100 → oznámí každých 100 bodů (100, 200, 300…). Kombinuje se s discrétními milníky.</p>
          </div>
        </div>

        <div>
          <Label>Šablona oznámení</Label>
          <Textarea
            rows={2}
            value={cfg.announce_message}
            onChange={(e) => setCfg({ ...cfg, announce_message: e.target.value })}
            disabled={!isManager}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Proměnné: <code>{"{user}"}</code> · <code>{"{points}"}</code> (dosažený milník) · <code>{"{total}"}</code> (celkové body) · <code>{"{minutes}"}</code>
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div><div className="font-medium text-sm">Ignorovat AFK kanál</div></div>
            <Switch checked={cfg.ignore_afk} onCheckedChange={(v) => setCfg({ ...cfg, ignore_afk: v })} disabled={!isManager} />
          </div>
          <div className="flex items-center justify-between">
            <div><div className="font-medium text-sm">Ignorovat mute</div></div>
            <Switch checked={cfg.ignore_muted} onCheckedChange={(v) => setCfg({ ...cfg, ignore_muted: v })} disabled={!isManager} />
          </div>
          <div className="flex items-center justify-between">
            <div><div className="font-medium text-sm">Ignorovat deafen</div></div>
            <Switch checked={cfg.ignore_deafened} onCheckedChange={(v) => setCfg({ ...cfg, ignore_deafened: v })} disabled={!isManager} />
          </div>
        </div>

        <div>
          <Label>Vyloučené hlasové kanály</Label>
          <MultiChannelPicker
            guildId={guildId}
            value={cfg.ignored_channel_ids}
            onChange={(v) => setCfg({ ...cfg, ignored_channel_ids: v })}
            kind="voice"
            disabled={!isManager}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4 border-t border-border pt-4">
          <div>
            <Label>Bonusové role</Label>
            <MultiRolePicker
              guildId={guildId}
              value={cfg.bonus_role_ids}
              onChange={(v) => setCfg({ ...cfg, bonus_role_ids: v })}
              disabled={!isManager}
            />
            <p className="text-xs text-muted-foreground mt-1">Členové s libovolnou z těchto rolí dostávají body násobené níže uvedeným koeficientem.</p>
          </div>
          <div>
            <Label>Násobitel pro bonusové role</Label>
            <Input
              type="number" min={1} step="0.1"
              value={cfg.bonus_multiplier}
              onChange={(e) => setCfg({ ...cfg, bonus_multiplier: parseFloat(e.target.value) || 1 })}
              disabled={!isManager}
            />
          </div>
        </div>

        <Button onClick={save} disabled={!isManager || saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Uložit
        </Button>
      </Card>

      {/* Manual adjustments */}
      {isManager && (
        <Card className="glass border-border p-6 space-y-4">
          <h3 className="font-display font-bold">Ruční úprava bodů</h3>
          <p className="text-xs text-muted-foreground">Zadej Discord ID uživatele (v Discordu: pravé tlačítko → Kopírovat ID; developer režim musí být zapnut). Změny se zaznamenají do auditu.</p>
          <div className="grid sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <Label>Discord ID uživatele</Label>
              <Input value={adjUserId} onChange={(e) => setAdjUserId(e.target.value)} placeholder="123456789012345678" />
            </div>
            <div>
              <Label>Počet / Hodnota</Label>
              <Input type="number" value={adjDelta} onChange={(e) => setAdjDelta(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Důvod (volitelné)</Label>
              <Input value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="event, soutěž…" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="default" onClick={() => adjust("add")} disabled={adjBusy}><Plus className="h-4 w-4 mr-1" /> Přidat</Button>
            <Button variant="outline" onClick={() => adjust("remove")} disabled={adjBusy}><Minus className="h-4 w-4 mr-1" /> Odebrat</Button>
            <Button variant="outline" onClick={() => adjust("set")} disabled={adjBusy}>Nastavit</Button>
            <Button variant="destructive" onClick={() => adjust("reset")} disabled={adjBusy}><Trash2 className="h-4 w-4 mr-1" /> Reset</Button>
          </div>
        </Card>
      )}

      {/* Leaderboard */}
      <Card className="glass border-border p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Žebříček (top 25)</h3>
          <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Obnovit</Button>
        </div>
        {board.length === 0 ? (
          <p className="text-sm text-muted-foreground">Zatím nikdo nemá body. Až někdo bude ve voice, čísla naskočí.</p>
        ) : (
          <div className="divide-y divide-border">
            {board.map((r, i) => {
              const m = members[r.user_id];
              const name = displayName(r.user_id);
              const initials = (name || r.user_id).slice(0, 2).toUpperCase();
              return (
                <div key={r.user_id} className="py-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 text-center font-bold ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>{["🥇", "🥈", "🥉"][i] || `${i + 1}.`}</div>
                    {m?.avatar_url ? (
                      <img decoding="async" src={m.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" loading="lazy" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold shrink-0">{initials}</div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{name ?? r.user_id}</div>
                      {m ? (
                        <div className="text-[11px] text-muted-foreground truncate">
                          @{m.username}{m.nick && m.global_name && m.nick !== m.global_name ? ` · ${m.global_name}` : ""}
                        </div>
                      ) : (
                        <div className="text-[11px] text-muted-foreground truncate font-mono">{r.user_id}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm flex items-center gap-3 shrink-0">
                    <span className="font-bold">{r.points} b.</span>
                    <span className="text-muted-foreground">{fmtMinutes(r.total_minutes)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
