import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Cuboid, Copy, RefreshCw, KeyRound, Trash2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { GuildResourceSelect } from "@/components/GuildResourceSelect";

type MCConfig = {
  id?: string;
  guild_id: string;
  enabled: boolean;
  server_address: string | null;
  server_type: string;
  plugin_token: string;
  chat_channel: string | null;
  console_channel: string | null;
  join_leave_channel: string | null;
  death_channel: string | null;
  achievement_channel: string | null;
  server_status_channel: string | null;
  link_role_id: string | null;
  allow_chat_relay: boolean;
  allow_discord_to_mc: boolean;
  allow_commands: boolean;
  chat_format: string;
  join_format: string;
  leave_format: string;
  death_format: string;
  achievement_format: string;
};

const BRIDGE_URL = `https://rioexuvgvmdwvidfakxy.supabase.co/functions/v1/minecraft-bridge`;

const DEFAULTS = (guild_id: string): MCConfig => ({
  guild_id,
  enabled: false,
  server_address: "",
  server_type: "discordsrv",
  plugin_token: "",
  chat_channel: null,
  console_channel: null,
  join_leave_channel: null,
  death_channel: null,
  achievement_channel: null,
  server_status_channel: null,
  link_role_id: null,
  allow_chat_relay: true,
  allow_discord_to_mc: true,
  allow_commands: false,
  chat_format: "**{name}**: {message}",
  join_format: "🟢 **{name}** se připojil na server",
  leave_format: "🔴 **{name}** opustil server",
  death_format: "💀 {message}",
  achievement_format: "🏆 **{name}** získal: {achievement}",
});

export function MinecraftPanel({ guildId, isManager }: { guildId: string | null; isManager: boolean }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<MCConfig | null>(null);
  const [links, setLinks] = useState<any[]>([]);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);

  const load = async () => {
    if (!guildId) { setCfg(null); setLoading(false); return; }
    setLoading(true);
    const [{ data }, lk] = await Promise.all([
      supabase.from("bot_minecraft_config" as any).select("*").eq("guild_id", guildId).maybeSingle(),
      supabase.from("bot_minecraft_links" as any).select("*").eq("guild_id", guildId).order("verified_at", { ascending: false }).limit(50),
    ]);
    setCfg((data as any) ?? DEFAULTS(guildId));
    setLinks(((lk.data as any) ?? []));
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [guildId]);

  if (!guildId) {
    return (
      <Card className="glass border-border p-6">
        <p className="text-sm text-muted-foreground">Vyber konkrétní Discord server nahoře — Minecraft integrace je per server.</p>
      </Card>
    );
  }
  if (loading || !cfg) {
    return <Card className="glass border-border p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Načítání…</Card>;
  }

  const save = async () => {
    setSaving(true);
    const payload: any = { ...cfg };
    delete payload.id;
    const { error } = await supabase.from("bot_minecraft_config" as any).upsert(payload, { onConflict: "guild_id" });
    setSaving(false);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { toast({ title: "Uloženo" }); void load(); }
  };

  const rotateToken = async () => {
    if (!confirm("Opravdu vygenerovat nový token? Starý plugin přestane fungovat.")) return;
    const newToken = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase.from("bot_minecraft_config" as any)
      .update({ plugin_token: newToken }).eq("guild_id", guildId);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { toast({ title: "Token obnoven" }); void load(); }
  };

  const generateLinkCode = async () => {
    setCodeBusy(true);
    const { data, error } = await supabase.functions.invoke("minecraft-bridge", {
      body: { action: "create_link_code", guild_id: guildId },
    });
    setCodeBusy(false);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else setLinkCode((data as any)?.code ?? null);
  };

  const copy = (v: string) => { void navigator.clipboard.writeText(v); toast({ title: "Zkopírováno" }); };

  const deleteLink = async (id: string) => {
    const { error } = await supabase.from("bot_minecraft_links" as any).delete().eq("id", id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { toast({ title: "Propojení zrušeno" }); void load(); }
  };

  return (
    <div className="space-y-6">
      <Card className="glass border-border p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-display text-lg flex items-center gap-2">
              <Cuboid className="h-5 w-5 text-primary" /> Minecraft integrace
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Propojení Minecraft serveru s Discordem. Kompatibilní s pluginy DiscordSRV, DiscordIntegration a vlastními (přes REST bridge níže).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="mc-en" className="text-sm">Zapnuto</Label>
            <Switch id="mc-en" checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} disabled={!isManager} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Typ pluginu</Label>
            <Select value={cfg.server_type} onValueChange={(v) => setCfg({ ...cfg, server_type: v })} disabled={!isManager}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="discordsrv">DiscordSRV (doporučeno)</SelectItem>
                <SelectItem value="discordintegration">DiscordIntegration</SelectItem>
                <SelectItem value="dsb">DiscordSuite / DSB</SelectItem>
                <SelectItem value="custom">Vlastní (REST bridge)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Adresa MC serveru</Label>
            <Input value={cfg.server_address ?? ""} onChange={(e) => setCfg({ ...cfg, server_address: e.target.value })}
              placeholder="play.example.com" disabled={!isManager} />
          </div>
        </div>
      </Card>

      <Card className="glass border-border p-6 space-y-4">
        <h4 className="font-medium">Kanály pro události</h4>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Chat (relay hry ↔ Discord)</Label>
            <GuildResourceSelect guildId={guildId} kind="text" value={cfg.chat_channel} onChange={(v) => setCfg({ ...cfg, chat_channel: v })} disabled={!isManager} />
          </div>
          <div>
            <Label>Join / Leave</Label>
            <GuildResourceSelect guildId={guildId} kind="text" value={cfg.join_leave_channel} onChange={(v) => setCfg({ ...cfg, join_leave_channel: v })} disabled={!isManager} />
          </div>
          <div>
            <Label>Úmrtí</Label>
            <GuildResourceSelect guildId={guildId} kind="text" value={cfg.death_channel} onChange={(v) => setCfg({ ...cfg, death_channel: v })} disabled={!isManager} />
          </div>
          <div>
            <Label>Achievementy</Label>
            <GuildResourceSelect guildId={guildId} kind="text" value={cfg.achievement_channel} onChange={(v) => setCfg({ ...cfg, achievement_channel: v })} disabled={!isManager} />
          </div>
          <div>
            <Label>Konzole / logy</Label>
            <GuildResourceSelect guildId={guildId} kind="text" value={cfg.console_channel} onChange={(v) => setCfg({ ...cfg, console_channel: v })} disabled={!isManager} />
          </div>
          <div>
            <Label>Status serveru (start/stop)</Label>
            <GuildResourceSelect guildId={guildId} kind="text" value={cfg.server_status_channel} onChange={(v) => setCfg({ ...cfg, server_status_channel: v })} disabled={!isManager} />
          </div>
          <div>
            <Label>Role po propojení účtu</Label>
            <GuildResourceSelect guildId={guildId} kind="role" value={cfg.link_role_id} onChange={(v) => setCfg({ ...cfg, link_role_id: v })} disabled={!isManager} placeholder="Vyber roli" />
          </div>
        </div>

        <div className="border-t border-border pt-4 grid sm:grid-cols-3 gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={cfg.allow_chat_relay} onCheckedChange={(v) => setCfg({ ...cfg, allow_chat_relay: v })} disabled={!isManager} />
            Chat MC → Discord
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={cfg.allow_discord_to_mc} onCheckedChange={(v) => setCfg({ ...cfg, allow_discord_to_mc: v })} disabled={!isManager} />
            Chat Discord → MC
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={cfg.allow_commands} onCheckedChange={(v) => setCfg({ ...cfg, allow_commands: v })} disabled={!isManager} />
            Povolit /příkazy z Discordu
          </label>
        </div>
      </Card>

      <Card className="glass border-border p-6 space-y-4">
        <h4 className="font-medium">Formáty zpráv</h4>
        <p className="text-xs text-muted-foreground">Proměnné: <code>{"{name}"}</code>, <code>{"{uuid}"}</code>, <code>{"{message}"}</code>, <code>{"{achievement}"}</code></p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Chat</Label><Input value={cfg.chat_format} onChange={(e) => setCfg({ ...cfg, chat_format: e.target.value })} disabled={!isManager} /></div>
          <div><Label>Join</Label><Input value={cfg.join_format} onChange={(e) => setCfg({ ...cfg, join_format: e.target.value })} disabled={!isManager} /></div>
          <div><Label>Leave</Label><Input value={cfg.leave_format} onChange={(e) => setCfg({ ...cfg, leave_format: e.target.value })} disabled={!isManager} /></div>
          <div><Label>Death</Label><Input value={cfg.death_format} onChange={(e) => setCfg({ ...cfg, death_format: e.target.value })} disabled={!isManager} /></div>
          <div className="sm:col-span-2"><Label>Achievement</Label><Input value={cfg.achievement_format} onChange={(e) => setCfg({ ...cfg, achievement_format: e.target.value })} disabled={!isManager} /></div>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={!isManager || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Uložit nastavení
          </Button>
        </div>
      </Card>

      <Card className="glass border-border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h4 className="font-medium">REST bridge (pro plugin)</h4>
        </div>
        <p className="text-sm text-muted-foreground">
          Endpoint pro plugin. Volej HTTP POST s hlavičkou <code>x-mc-token</code> a JSON tělem.
        </p>
        <div className="space-y-2">
          <Label>Endpoint URL</Label>
          <div className="flex gap-2">
            <Input readOnly value={BRIDGE_URL} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => copy(BRIDGE_URL)}><Copy className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Plugin token (nikdy nesdílej)</Label>
          <div className="flex gap-2">
            <Input readOnly value={cfg.plugin_token} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => copy(cfg.plugin_token)}><Copy className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={rotateToken} disabled={!isManager}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
        <Textarea readOnly className="font-mono text-xs h-40" value={
`# Příklad – chatová zpráva ze hry do Discordu
curl -X POST "${BRIDGE_URL}" \\
  -H "x-mc-token: ${cfg.plugin_token}" \\
  -H "content-type: application/json" \\
  -d '{"action":"chat","name":"Steve","uuid":"...","message":"ahoj"}'

# Akce: chat | join | leave | death | achievement | server_status | verify_link
# verify_link body: { action:"verify_link", name, uuid, code:"ABC123" }`
        } />
      </Card>

      <Card className="glass border-border p-6 space-y-4">
        <h4 className="font-medium">Propojení mého účtu</h4>
        <p className="text-sm text-muted-foreground">
          Vygeneruj kód (platí 15 minut), přihlaš se na MC server a napiš do chatu <code>/discord link KÓD</code>.
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={generateLinkCode} disabled={codeBusy}>
            {codeBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Vygenerovat kód
          </Button>
          {linkCode && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-base tracking-widest px-3 py-1">{linkCode}</Badge>
              <Button variant="ghost" size="icon" onClick={() => copy(linkCode)}><Copy className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="glass border-border p-6 space-y-3">
        <h4 className="font-medium">Propojené účty ({links.length})</h4>
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground">Zatím žádné.</p>
        ) : (
          <ul className="divide-y divide-border">
            {links.map((l: any) => (
              <li key={l.id} className="py-2 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-medium">{l.minecraft_name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{l.minecraft_uuid}</span>
                  {l.discord_user_id && <span className="text-xs text-muted-foreground ml-2">↔ Discord {l.discord_user_id}</span>}
                </div>
                {isManager && (
                  <Button size="icon" variant="ghost" onClick={() => deleteLink(l.id)}><Trash2 className="h-4 w-4" /></Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
