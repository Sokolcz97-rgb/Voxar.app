import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MultiRolePicker } from "@/components/MultiRolePicker";
import { ShieldCheck, ShieldAlert, Ban, Clock, EyeOff, RefreshCw, Info, UserCheck } from "lucide-react";

type ProtectionConfig = {
  antiscam_enabled?: boolean;
  antiscam_sensitivity?: "low" | "normal" | "high";
  antiscam_allowed_domains?: string[];
  antiscam_blocked_domains?: string[];
  antiscam_allow_invites?: boolean;
  bypass_role_ids?: string[];
};

type ModEvent = {
  id: number;
  user_id: string;
  user_tag: string | null;
  source: string;
  level: string;
  score: number | null;
  reasons: string[];
  content: string | null;
  moderator: string | null;
  resolution: string | null;
  created_at: string;
};

const LEVELS: Record<string, { label: string; cls: string; Icon: typeof Ban }> = {
  warn: { label: "Skryto", cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40", Icon: EyeOff },
  timeout: { label: "Timeout", cls: "bg-orange-500/15 text-orange-300 border-orange-500/40", Icon: Clock },
  ban: { label: "Ban", cls: "bg-red-500/15 text-red-300 border-red-500/40", Icon: Ban },
  kick: { label: "Kick", cls: "bg-red-500/10 text-red-300 border-red-500/30", Icon: Ban },
  info: { label: "Podezřelý", cls: "bg-sky-500/15 text-sky-300 border-sky-500/40", Icon: Info },
  ok: { label: "Výjimka", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", Icon: UserCheck },
};
const SOURCES: Record<string, string> = { antiscam: "ochrana zpráv", antibot: "příchod člena", manual: "moderátor", scan: "kontrola" };
const RESOLUTIONS: Record<string, string> = { unban: "odbanován (omyl)", untimeout: "timeout zrušen", ban: "potvrzen ban", ok: "vyřízeno" };

const SENS = [
  { v: "low", t: "Mírná", d: "Zasahuje jen u jasných podvodů. Méně omylů, víc práce pro moderátory." },
  { v: "normal", t: "Vyvážená", d: "Doporučeno. Běžné odkazy a @everyone neřeší, podvody spolehlivě zastaví." },
  { v: "high", t: "Přísná", d: "Zasahuje dřív – vhodné při náletu spamu nebo pro velké veřejné servery." },
] as const;

const list = (s: string) => s.split(/[\s,]+/).map((x) => x.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter(Boolean);

export function BotProtectionPanel({
  config, setConfig, isManager, guildId, onSave, scanButtons,
}: {
  config: ProtectionConfig;
  setConfig: (c: any) => void;
  isManager: boolean;
  guildId: string | null;
  onSave: () => void;
  scanButtons?: React.ReactNode;
}) {
  const [events, setEvents] = useState<ModEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    if (!guildId) return;
    setLoading(true);
    const { data } = await supabase
      .from("bot_moderation_events" as any)
      .select("id, user_id, user_tag, source, level, score, reasons, content, moderator, resolution, created_at")
      .eq("guild_id", guildId)
      .order("created_at", { ascending: false })
      .limit(60);
    setEvents(((data as any) ?? []) as ModEvent[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [guildId]);

  const stats = useMemo(() => {
    const day = Date.now() - 86400000;
    const recent = events.filter((e) => new Date(e.created_at).getTime() > day);
    return {
      day: recent.length,
      bans: recent.filter((e) => e.level === "ban").length,
      timeouts: recent.filter((e) => e.level === "timeout").length,
      hidden: recent.filter((e) => e.level === "warn").length,
      mistakes: events.filter((e) => e.resolution === "unban" || e.resolution === "untimeout").length,
    };
  }, [events]);

  const shown = events.filter((e) => filter === "all" || e.level === filter || e.source === filter);
  const enabled = config.antiscam_enabled !== false;
  const sens = config.antiscam_sensitivity ?? "normal";

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Přehled */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: "Zásahů za 24 h", v: stats.day, Icon: ShieldCheck, c: "text-primary" },
          { l: "Skryté zprávy", v: stats.hidden, Icon: EyeOff, c: "text-yellow-300" },
          { l: "Timeouty", v: stats.timeouts, Icon: Clock, c: "text-orange-300" },
          { l: "Bany", v: stats.bans, Icon: Ban, c: "text-red-300" },
        ].map((s) => (
          <Card key={s.l} className="glass border-border p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><s.Icon className={`h-4 w-4 ${s.c}`} />{s.l}</div>
            <div className="mt-1 text-2xl font-display font-bold">{guildId ? s.v : "—"}</div>
          </Card>
        ))}
      </div>

      {/* Nastavení */}
      <Card className="glass border-border p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 border border-primary/40 flex items-center justify-center"><ShieldAlert className="h-5 w-5 text-primary" /></div>
            <div>
              <div className="font-display font-bold text-lg">Ochrana proti podvodům a botům</div>
              <p className="text-sm text-muted-foreground">
                Každá zpráva dostane body za podezřelé znaky (podvodné a napodobené domény, podvodné fráze s odkazem, stejná zpráva do více kanálů…)
                a body dolů za důvěru (doba na serveru, role, booster). Moderátoři a správci se nekontrolují.
              </p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={(v) => setConfig({ ...config, antiscam_enabled: v })} disabled={!isManager} />
        </div>

        <div className={enabled ? "space-y-5" : "space-y-5 opacity-50 pointer-events-none"}>
          <div>
            <Label className="text-sm">Citlivost</Label>
            <div className="mt-2 grid sm:grid-cols-3 gap-2">
              {SENS.map((s) => (
                <button
                  key={s.v}
                  type="button"
                  disabled={!isManager}
                  onClick={() => setConfig({ ...config, antiscam_sensitivity: s.v })}
                  className={`text-left rounded-lg border p-3 transition ${sens === s.v ? "border-primary bg-primary/10 [box-shadow:var(--glow-soft)]" : "border-border hover:border-primary/50"}`}
                >
                  <div className="font-medium">{s.t}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.d}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/20 p-3 text-sm grid sm:grid-cols-3 gap-3">
            <div><span className="text-yellow-300 font-medium">1. Skrytí</span><div className="text-xs text-muted-foreground">Zpráva zmizí, autor dostane vlídné upozornění. Žádný trest.</div></div>
            <div><span className="text-orange-300 font-medium">2. Timeout 30 min</span><div className="text-xs text-muted-foreground">U pravděpodobného podvodu. Moderátor může jedním klikem zrušit.</div></div>
            <div><span className="text-red-300 font-medium">3. Ban</span><div className="text-xs text-muted-foreground">Jen u jasného podvodu nebo opakování. V hlášení je tlačítko „Odbanovat“.</div></div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Povolené domény</Label>
              <p className="text-xs text-muted-foreground mb-1">Odkazy na tyto weby se nikdy nehodnotí (např. váš web, fórum). Odděl čárkou nebo mezerou.</p>
              <Textarea rows={3} placeholder="mujweb.cz, forum.example.com"
                defaultValue={(config.antiscam_allowed_domains ?? []).join(", ")}
                key={`allow-${guildId}`}
                onBlur={(e) => setConfig({ ...config, antiscam_allowed_domains: list(e.target.value) })}
                disabled={!isManager} />
            </div>
            <div>
              <Label>Zakázané domény</Label>
              <p className="text-xs text-muted-foreground mb-1">Odkaz na tyto weby = okamžitý zásah (k vestavěnému seznamu podvodných domén).</p>
              <Textarea rows={3} placeholder="podvod.example"
                defaultValue={(config.antiscam_blocked_domains ?? []).join(", ")}
                key={`block-${guildId}`}
                onBlur={(e) => setConfig({ ...config, antiscam_blocked_domains: list(e.target.value) })}
                disabled={!isManager} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="font-medium text-sm">Povolit pozvánky na jiné Discord servery</div>
              <p className="text-xs text-muted-foreground">Vypnuté = pozvánka (discord.gg/…) přidá trochu bodů, sama o sobě ale nic neudělá.</p>
            </div>
            <Switch checked={!!config.antiscam_allow_invites} onCheckedChange={(v) => setConfig({ ...config, antiscam_allow_invites: v })} disabled={!isManager} />
          </div>

          <div className="space-y-2">
            <Label>Výjimky – role bez kontroly</Label>
            <p className="text-xs text-muted-foreground">Členové s těmito rolemi se netrestají; při podezřelé zprávě přijde jen upozornění do Alerts kanálu.</p>
            <MultiRolePicker guildId={guildId} value={config.bypass_role_ids ?? []} onChange={(v) => setConfig({ ...config, bypass_role_ids: v })} disabled={!isManager} placeholder="Přidat roli" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button onClick={onSave} disabled={!isManager}>Uložit nastavení</Button>
          {scanButtons}
        </div>
      </Card>

      {/* Zásahy */}
      <Card className="glass border-border p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <div className="font-display font-bold">Poslední zásahy</div>
            <p className="text-xs text-muted-foreground">Ochrana i ruční moderace (/ban, /kick, /timeout). Uchovává se 90 dní.{stats.mistakes ? ` Moderátoři opravili ${stats.mistakes} omyl(ů).` : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <select className="bg-background border border-border rounded-md px-2 py-1 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Vše</option>
              <option value="warn">Skryté zprávy</option>
              <option value="timeout">Timeouty</option>
              <option value="ban">Bany</option>
              <option value="antibot">Příchody</option>
              <option value="manual">Ruční moderace</option>
            </select>
            <Button size="sm" variant="outline" onClick={load} disabled={loading || !guildId} className="gap-1"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Obnovit</Button>
          </div>
        </div>
        {!guildId && <p className="text-sm text-muted-foreground">Vyber server, ať vidíš jeho zásahy.</p>}
        {guildId && shown.length === 0 && !loading && <p className="text-sm text-muted-foreground py-6 text-center">Zatím žádné zásahy. 🎉</p>}
        <div className="space-y-2">
          {shown.map((e) => {
            const L = LEVELS[e.level] ?? LEVELS.info;
            return (
              <div key={e.id} className="rounded-lg border border-border bg-secondary/10 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`gap-1 ${L.cls}`}><L.Icon className="h-3 w-3" />{L.label}</Badge>
                  <span className="font-medium">{e.user_tag || e.user_id}</span>
                  <span className="text-xs text-muted-foreground">· {SOURCES[e.source] ?? e.source}{e.score != null ? ` · ${e.score} b` : ""}{e.moderator ? ` · ${e.moderator}` : ""}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("cs-CZ")}</span>
                </div>
                {e.reasons?.length > 0 && <div className="mt-1 text-xs text-muted-foreground">{e.reasons.join(" · ")}</div>}
                {e.content && <div className="mt-2 rounded bg-background/60 border border-border px-2 py-1 text-xs font-mono break-words line-clamp-3">{e.content}</div>}
                {e.resolution && <div className="mt-1 text-xs text-emerald-300">✓ {RESOLUTIONS[e.resolution] ?? e.resolution}</div>}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
