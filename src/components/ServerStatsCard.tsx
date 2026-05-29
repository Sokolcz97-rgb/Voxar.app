import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, BarChart3 } from "lucide-react";

type Slot = { kind: string; template: string; channel_id: string | null };
type ServerStats = {
  id?: string;
  guild_id: string;
  enabled: boolean;
  category_name: string;
  category_id: string | null;
  slots: Slot[];
};

const KIND_OPTIONS: { value: string; label: string; defaultTpl: string }[] = [
  { value: "none", label: "— vypnuto —", defaultTpl: "" },
  { value: "members", label: "Počet členů", defaultTpl: "👥 Členové: {value}" },
  { value: "online", label: "Online členů", defaultTpl: "🟢 Online: {value}" },
  { value: "web_status", label: "Status webu (UP/DOWN)", defaultTpl: "🌐 Web: {value}" },
  { value: "bot_status", label: "Status bota (UP/DOWN)", defaultTpl: "🤖 Bot: {value}" },
  { value: "boosts", label: "Počet boostů", defaultTpl: "🚀 Boosty: {value}" },
];

const DEFAULT_SLOTS: Slot[] = [
  { kind: "members", template: "👥 Členové: {value}", channel_id: null },
  { kind: "online", template: "🟢 Online: {value}", channel_id: null },
  { kind: "web_status", template: "🌐 Web: {value}", channel_id: null },
  { kind: "bot_status", template: "🤖 Bot: {value}", channel_id: null },
];

export function ServerStatsCard({
  guildId,
  isManager,
}: {
  guildId: string | null;
  isManager: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<ServerStats | null>(null);

  useEffect(() => {
    if (!guildId) { setCfg(null); setLoading(false); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("bot_server_stats")
        .select("*")
        .eq("guild_id", guildId)
        .maybeSingle();
      if (cancel) return;
      if (data) {
        setCfg({
          ...(data as any),
          slots: Array.isArray((data as any).slots) ? (data as any).slots : DEFAULT_SLOTS,
        });
      } else {
        setCfg({
          guild_id: guildId,
          enabled: false,
          category_name: "📊 Statistiky",
          category_id: null,
          slots: DEFAULT_SLOTS,
        });
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [guildId]);

  if (!guildId) {
    return (
      <Card className="glass border-border p-6">
        <p className="text-sm text-muted-foreground">
          Vyber konkrétní Discord server (nahoře). Server stats se konfigurují per server.
        </p>
      </Card>
    );
  }
  if (loading || !cfg) {
    return (
      <Card className="glass border-border p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Načítání…
      </Card>
    );
  }

  const updateSlot = (idx: number, patch: Partial<Slot>) => {
    setCfg((c) => c ? { ...c, slots: c.slots.map((s, i) => i === idx ? { ...s, ...patch } : s) } : c);
  };

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    const payload = {
      guild_id: cfg.guild_id,
      enabled: cfg.enabled,
      category_name: cfg.category_name || "📊 Statistiky",
      category_id: cfg.category_id,
      slots: cfg.slots.slice(0, 4),
    };
    const { error } = await supabase
      .from("bot_server_stats")
      .upsert(payload, { onConflict: "guild_id" });
    setSaving(false);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else toast({ title: "Uloženo", description: "Bot vytvoří/aktualizuje kanály do ~1 minuty." });
  };

  const slots: Slot[] = [
    ...cfg.slots,
    ...Array.from({ length: Math.max(0, 4 - cfg.slots.length) }, () => ({ kind: "none", template: "", channel_id: null } as Slot)),
  ].slice(0, 4);

  return (
    <Card className="glass border-border p-6 space-y-5 max-w-3xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-display text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Server Stats
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Bot vytvoří kategorii s 4 hlasovými kanály nahoře v serveru, kam zapíše statistiky.
            Nikdo do nich nemůže vstoupit – slouží jen jako vizuální štítek.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="ss-enabled" className="text-sm">Zapnuto</Label>
          <Switch
            id="ss-enabled"
            checked={cfg.enabled}
            onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })}
            disabled={!isManager}
          />
        </div>
      </div>

      <div>
        <Label>Název kategorie</Label>
        <Input
          value={cfg.category_name}
          onChange={(e) => setCfg({ ...cfg, category_name: e.target.value })}
          placeholder="📊 Statistiky"
          maxLength={100}
          disabled={!isManager}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Krátký název kategorie nahoře (např. „📊 Stats" nebo „Server Info").
        </p>
      </div>

      <div className="space-y-3">
        <Label>Statistiky (max. 4)</Label>
        {slots.map((slot, idx) => {
          const opt = KIND_OPTIONS.find((o) => o.value === slot.kind) || KIND_OPTIONS[0];
          return (
            <div key={idx} className="grid sm:grid-cols-[200px_1fr] gap-2 items-start">
              <Select
                value={slot.kind}
                onValueChange={(v) => {
                  const def = KIND_OPTIONS.find((o) => o.value === v)?.defaultTpl || "";
                  updateSlot(idx, { kind: v, template: slot.template?.trim() ? slot.template : def });
                }}
                disabled={!isManager}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div>
                <Input
                  value={slot.template}
                  onChange={(e) => updateSlot(idx, { template: e.target.value })}
                  placeholder={opt.defaultTpl || "{value}"}
                  maxLength={100}
                  disabled={!isManager || slot.kind === "none"}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Použij <code>{"{value}"}</code> jako místo, kam se doplní hodnota.
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
        <div className="text-xs text-muted-foreground">
          {cfg.category_id ? (
            <span className="flex items-center gap-2">
              <Badge variant="outline">Kategorie vytvořena</Badge>
              <code className="text-[10px]">{cfg.category_id}</code>
            </span>
          ) : (
            <span>Kategorie zatím nevytvořena – vytvoří se po zapnutí a uložení.</span>
          )}
        </div>
        <Button onClick={save} disabled={!isManager || saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Uložit
        </Button>
      </div>

      <div className="text-xs text-muted-foreground border-t border-border pt-3">
        <strong>Tip:</strong> Discord limituje přejmenování kanálů (~2× za 10 minut), proto se hodnoty
        aktualizují každých 10 minut. Bot potřebuje oprávnění <em>Manage Channels</em>.
      </div>
    </Card>
  );
}
