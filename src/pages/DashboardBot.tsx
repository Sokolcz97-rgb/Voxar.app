import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";
import { Bot, Plus, Trash2, Send, Radio, Loader2, Server, Globe } from "lucide-react";
import { DiscordMessagePreview } from "@/components/DiscordMessagePreview";
import { SocialHandleField } from "@/components/SocialHandleField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AnyConfig = {
  id: string;
  prefix?: string | null;
  default_welcome_channel: string | null;
  default_log_channel: string | null;
  default_alerts_channel: string | null;
  automod_enabled: boolean;
  automod_blocked_words: string[];
  automod_max_mentions: number;
  automod_max_emojis: number;
  automod_spam_threshold: number;
  automod_action: string;
  nsfw_protection: boolean;
  nsfw_allowed_channels: string[];
  bot_maintenance: boolean;
  web_maintenance?: boolean;
  maintenance_channel: string | null;
};

type Command = { id: string; name: string; description: string | null; response_type: string; content: any; enabled: boolean; guild_id: string | null };
type Welcome = { id: string; channel_id: string; message_type: string; content: any; enabled: boolean; guild_id: string | null };
type StreamNotif = { id: string; platform: string; handle: string; discord_channel_id: string; template: string; enabled: boolean; guild_id: string | null };
type StatusCheck = { id: string; label: string; target_type: string; target: string; discord_channel_id: string; enabled: boolean; last_status: string | null; guild_id: string | null };
type BotStatus = { last_heartbeat: string | null; version: string | null; guild_count: number | null };
type GuildOption = { id: string; guild_id: string; name: string; icon_url: string | null };
type TicketCategory = { id: string; guild_id: string; label: string; description: string | null; emoji: string | null; discord_category_id: string | null; position: number; enabled: boolean };

const GLOBAL_KEY = "__global__";

const DashboardBot = () => {
  const { user, loading: authLoading } = useAuth();
  const { can, loading: permsLoading } = usePermissions();

  // Guild scope
  const [guilds, setGuilds] = useState<GuildOption[]>([]);
  const [guildsLoaded, setGuildsLoaded] = useState(false);
  const [selectedGuildId, setSelectedGuildId] = useState<string>(GLOBAL_KEY);
  const canManageBot = can("bot", "manage");
  const canViewBot = can("bot", "view");
  const canUseGlobalConfig = canManageBot || canViewBot;
  const selectedGuild = useMemo(
    () => (selectedGuildId === GLOBAL_KEY ? null : guilds.find((g) => g.guild_id === selectedGuildId) ?? null),
    [selectedGuildId, guilds]
  );

  const [config, setConfig] = useState<AnyConfig | null>(null);
  const [commands, setCommands] = useState<Command[]>([]);
  const [welcomes, setWelcomes] = useState<Welcome[]>([]);
  const [streams, setStreams] = useState<StreamNotif[]>([]);
  const [checks, setChecks] = useState<StatusCheck[]>([]);
  const [status, setStatus] = useState<BotStatus | null>(null);

  const [embedWebhook, setEmbedWebhook] = useState("");
  const [embedContent, setEmbedContent] = useState("");
  const [embedJson, setEmbedJson] = useState('{\n  "title": "Test",\n  "description": "Z webu",\n  "color": 5814783\n}');
  const [sending, setSending] = useState(false);

  const [newCmd, setNewCmd] = useState({ name: "", description: "", response: "" });
  const [newWelcome, setNewWelcome] = useState({ channel_id: "", content: "" });
  const [newStream, setNewStream] = useState({ platform: "twitch", handle: "", channel: "", webhook: "", template: "🔴 {handle} právě vysílá: {title}" });
  const [newCheck, setNewCheck] = useState({ label: "", target: "", channel: "", webhook: "" });

  // Load list of guilds user can manage (admin sees all approved + pending; owner sees own approved)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("bot_guilds")
        .select("id, guild_id, name, icon_url, status")
        .eq("status", "approved")
        .order("name");
      setGuilds(((data as any) ?? []) as GuildOption[]);
      setGuildsLoaded(true);
    })();
  }, [user]);

  useEffect(() => {
    if (!canUseGlobalConfig && selectedGuildId === GLOBAL_KEY && guilds[0]) {
      setSelectedGuildId(guilds[0].guild_id);
    }
  }, [canUseGlobalConfig, guilds, selectedGuildId]);

  useEffect(() => {
    if (!user) return;
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedGuildId]);

  const scopeFilter = (q: any) =>
    selectedGuild ? q.eq("guild_id", selectedGuild.guild_id) : q.is("guild_id", null);

  const loadAll = async () => {
    // Config: per-guild config vs global bot_config
    let configRow: any = null;
    if (selectedGuild) {
      const r = await supabase
        .from("bot_guild_config")
        .select("*")
        .eq("guild_id", selectedGuild.guild_id)
        .maybeSingle();
      if (r.data) configRow = r.data;
      else {
        // No row yet — auto-insert via upsert
        const ins = await supabase
          .from("bot_guild_config")
          .insert({ guild_id: selectedGuild.guild_id })
          .select()
          .maybeSingle();
        configRow = ins.data;
      }
    } else {
      const r = await supabase.from("bot_config").select("*").maybeSingle();
      configRow = r.data;
    }

    const [cmds, w, s, ch, st] = await Promise.all([
      scopeFilter(supabase.from("bot_commands").select("*").order("name")),
      scopeFilter(supabase.from("bot_welcome").select("*").order("created_at", { ascending: false })),
      scopeFilter(supabase.from("bot_stream_notifications").select("*").order("created_at", { ascending: false })),
      scopeFilter(supabase.from("bot_status_checks").select("*").order("created_at", { ascending: false })),
      supabase.from("bot_status").select("last_heartbeat, version, guild_count").maybeSingle(),
    ]);
    setConfig(configRow ?? null);
    setCommands((cmds.data as any) ?? []);
    setWelcomes((w.data as any) ?? []);
    setStreams((s.data as any) ?? []);
    setChecks((ch.data as any) ?? []);
    setStatus((st.data as any) ?? null);
  };

  if (authLoading || permsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (guildsLoaded && !canManageBot && !canViewBot && guilds.length === 0)
    return <Navigate to="/dashboard" replace />;

  const isAdmin = canManageBot;
  // Manager = admin OR (guild owner of selected guild — already enforced by RLS on save)
  const isManager = isAdmin || !!selectedGuild;

  const botOnline = status?.last_heartbeat
    ? Date.now() - new Date(status.last_heartbeat).getTime() < 90_000
    : false;

  const guildIdOrNull = () => selectedGuild?.guild_id ?? null;

  const saveConfig = async () => {
    if (!config) return;
    const payload: any = {
      default_welcome_channel: config.default_welcome_channel,
      default_log_channel: config.default_log_channel,
      default_alerts_channel: config.default_alerts_channel,
      automod_enabled: config.automod_enabled,
      automod_blocked_words: config.automod_blocked_words,
      automod_max_mentions: config.automod_max_mentions,
      automod_max_emojis: config.automod_max_emojis,
      automod_spam_threshold: config.automod_spam_threshold,
      automod_action: config.automod_action,
      nsfw_protection: config.nsfw_protection,
      nsfw_allowed_channels: config.nsfw_allowed_channels,
      bot_maintenance: config.bot_maintenance,
      maintenance_channel: config.maintenance_channel,
    };
    if (config.prefix !== undefined && config.prefix !== null) payload.prefix = config.prefix;

    const table = selectedGuild ? "bot_guild_config" : "bot_config";
    if (!selectedGuild) payload.web_maintenance = (config as any).web_maintenance ?? false;

    const { error } = await supabase.from(table as any).update(payload).eq("id", config.id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else toast({ title: "Uloženo" });
  };

  const addCommand = async () => {
    if (!newCmd.name.trim() || !newCmd.response.trim()) return;
    const { error } = await supabase.from("bot_commands").insert({
      name: newCmd.name.trim().replace(/^!/, ""),
      description: newCmd.description || null,
      response_type: "text",
      content: { text: newCmd.response },
      enabled: true,
      created_by: user.id,
      guild_id: guildIdOrNull(),
    });
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else {
      setNewCmd({ name: "", description: "", response: "" });
      void loadAll();
    }
  };

  const deleteCommand = async (id: string) => {
    await supabase.from("bot_commands").delete().eq("id", id);
    void loadAll();
  };
  const toggleCommand = async (id: string, enabled: boolean) => {
    await supabase.from("bot_commands").update({ enabled }).eq("id", id);
    void loadAll();
  };

  const addWelcome = async () => {
    if (!newWelcome.channel_id.trim() || !newWelcome.content.trim()) return;
    const { error } = await supabase.from("bot_welcome").insert({
      channel_id: newWelcome.channel_id.trim(),
      message_type: "text",
      content: { text: newWelcome.content },
      enabled: true,
      guild_id: guildIdOrNull(),
    });
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { setNewWelcome({ channel_id: "", content: "" }); void loadAll(); }
  };

  const addStream = async () => {
    if (!newStream.handle.trim() || !newStream.channel.trim()) return;
    const { error } = await supabase.from("bot_stream_notifications").insert({
      platform: newStream.platform,
      handle: newStream.handle.trim().replace(/^@/, ""),
      discord_channel_id: newStream.channel.trim(),
      webhook_url: newStream.webhook.trim() || null,
      template: newStream.template,
      enabled: true,
      guild_id: guildIdOrNull(),
    });
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { setNewStream({ ...newStream, handle: "", channel: "", webhook: "" }); void loadAll(); }
  };

  const addCheck = async () => {
    if (!newCheck.label.trim() || !newCheck.target.trim() || !newCheck.channel.trim()) return;
    const { error } = await supabase.from("bot_status_checks").insert({
      label: newCheck.label.trim(),
      target_type: "url",
      target: newCheck.target.trim(),
      discord_channel_id: newCheck.channel.trim(),
      webhook_url: newCheck.webhook.trim() || null,
      enabled: true,
      guild_id: guildIdOrNull(),
    });
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { setNewCheck({ label: "", target: "", channel: "", webhook: "" }); void loadAll(); }
  };

  const sendEmbed = async () => {
    setSending(true);
    try {
      let embed: any = null;
      if (embedJson.trim()) {
        try { embed = JSON.parse(embedJson); } catch { toast({ title: "Chyba", description: "Neplatný JSON embed", variant: "destructive" }); setSending(false); return; }
        if (embed.embeds && Array.isArray(embed.embeds)) embed = embed.embeds[0];
        if (embed.embed) embed = embed.embed;
      }
      const { data, error } = await supabase.functions.invoke("discord-bot-send", {
        body: { webhook_url: embedWebhook || undefined, content: embedContent || undefined, embed, guild_id: guildIdOrNull() },
      });
      if (error) throw error;
      toast({ title: data?.queued ? "Zařazeno do fronty" : "Odesláno" });
    } catch (e: any) {
      toast({ title: "Chyba", description: e?.message ?? "Neznámá chyba", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const deleteRow = async (table: string, id: string) => {
    await supabase.from(table as any).delete().eq("id", id);
    void loadAll();
  };

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">Discord</p>
            <h1 className="font-display font-black text-4xl md:text-5xl mt-2 flex items-center gap-3">
              <Bot className="h-10 w-10" /> Správce bota
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" onClick={() => (window.location.href = "/dashboard/bot/guilds")}>
              <Server className="h-4 w-4 mr-2" />
              Servery bota
            </Button>
            <Card className="glass border-border p-4 flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${botOnline ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
              <div>
                <div className="text-sm font-medium">{botOnline ? "Bot online" : "Bot offline"}</div>
                <div className="text-xs text-muted-foreground">
                  {status?.guild_count ?? 0} serverů · {status?.version ?? "—"}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Guild selector */}
        <Card className="glass border-border p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <Label className="shrink-0">Konfigurace pro:</Label>
          <Select value={selectedGuildId} onValueChange={setSelectedGuildId}>
            <SelectTrigger className="sm:max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {canUseGlobalConfig && (
                <SelectItem value={GLOBAL_KEY}>
                  <span className="flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Globální / šablony (legacy)
                  </span>
                </SelectItem>
              )}
              {guilds.map((g) => (
                <SelectItem key={g.guild_id} value={g.guild_id}>
                  <span className="flex items-center gap-2">
                    {g.icon_url ? (
                      <img src={g.icon_url} className="h-4 w-4 rounded-full" alt="" />
                    ) : (
                      <Server className="h-4 w-4" />
                    )}
                    {g.name}
                  </span>
                </SelectItem>
              ))}
              {guilds.length === 0 && !isAdmin && (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Žádné schválené servery — požádej na stránce „Servery bota".
                </div>
              )}
            </SelectContent>
          </Select>
          {selectedGuild && (
            <code className="text-xs text-muted-foreground">{selectedGuild.guild_id}</code>
          )}
        </Card>

        <Tabs defaultValue="basics">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="basics">Základ</TabsTrigger>
            <TabsTrigger value="automod">Auto-moderace</TabsTrigger>
            <TabsTrigger value="commands">Příkazy</TabsTrigger>
            <TabsTrigger value="welcome">Uvítací zprávy</TabsTrigger>
            <TabsTrigger value="embed">Embed / Webhook</TabsTrigger>
            <TabsTrigger value="streams">YT / Twitch</TabsTrigger>
            <TabsTrigger value="tickets">Tickety</TabsTrigger>
            <TabsTrigger value="status">Status checks</TabsTrigger>
          </TabsList>

          {/* BASICS */}
          <TabsContent value="basics" className="mt-4">
            {config && (
              <Card className="glass border-border p-6 space-y-4 max-w-2xl">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Prefix příkazů {selectedGuild && <span className="text-xs text-muted-foreground">(prázdné = použít globální)</span>}</Label>
                    <Input value={config.prefix ?? ""} onChange={(e) => setConfig({ ...config, prefix: e.target.value })} disabled={!isManager} />
                  </div>
                  <div>
                    <Label>Welcome kanál (ID)</Label>
                    <Input value={config.default_welcome_channel ?? ""} onChange={(e) => setConfig({ ...config, default_welcome_channel: e.target.value })} disabled={!isManager} />
                  </div>
                  <div>
                    <Label>Log kanál (ID)</Label>
                    <Input value={config.default_log_channel ?? ""} onChange={(e) => setConfig({ ...config, default_log_channel: e.target.value })} disabled={!isManager} />
                  </div>
                  <div>
                    <Label>Alerts kanál (ID)</Label>
                    <Input value={config.default_alerts_channel ?? ""} onChange={(e) => setConfig({ ...config, default_alerts_channel: e.target.value })} disabled={!isManager} />
                  </div>
                </div>
                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Maintenance — bot</div>
                      <p className="text-xs text-muted-foreground">Bot pošle do maintenance kanálu a přestane reagovat na tomto serveru</p>
                    </div>
                    <Switch checked={config.bot_maintenance} onCheckedChange={(v) => setConfig({ ...config, bot_maintenance: v })} disabled={!isManager} />
                  </div>
                  {!selectedGuild && (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Maintenance — web</div>
                        <p className="text-xs text-muted-foreground">Pošle oznámení o údržbě webu</p>
                      </div>
                      <Switch checked={!!(config as any).web_maintenance} onCheckedChange={(v) => setConfig({ ...config, web_maintenance: v } as any)} disabled={!isManager} />
                    </div>
                  )}
                  <div>
                    <Label>Maintenance kanál (ID)</Label>
                    <Input value={config.maintenance_channel ?? ""} onChange={(e) => setConfig({ ...config, maintenance_channel: e.target.value })} disabled={!isManager} />
                  </div>
                </div>
                <Button onClick={saveConfig} disabled={!isManager}>Uložit</Button>
              </Card>
            )}
          </TabsContent>

          {/* AUTOMOD */}
          <TabsContent value="automod" className="mt-4">
            {config && (
              <Card className="glass border-border p-6 space-y-4 max-w-2xl">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Auto-moderace zapnutá</Label>
                  <Switch checked={config.automod_enabled} onCheckedChange={(v) => setConfig({ ...config, automod_enabled: v })} disabled={!isManager} />
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
                  <div className="font-medium text-foreground">Vestavěná ochrana (vždy aktivní)</div>
                  <p className="text-muted-foreground">
                    Bot automaticky blokuje běžné vulgarismy (CZ + EN), rasistické nadávky včetně N-words a NSFW termíny.
                    Detekce ignoruje diakritiku, takže např. „piča" i „pica" se zachytí stejně.
                  </p>
                </div>
                <div>
                  <Label>Další blokovaná slova (oddělená čárkou)</Label>
                  <p className="text-xs text-muted-foreground mb-1">
                    Tato slova se přidají navíc k vestavěnému seznamu.
                  </p>
                  <Textarea
                    rows={3}
                    value={(config.automod_blocked_words ?? []).join(", ")}
                    onChange={(e) => setConfig({ ...config, automod_blocked_words: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                    disabled={!isManager}
                  />
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Max mentions</Label>
                    <Input type="number" value={config.automod_max_mentions} onChange={(e) => setConfig({ ...config, automod_max_mentions: parseInt(e.target.value) || 0 })} disabled={!isManager} />
                  </div>
                  <div>
                    <Label>Max emoji</Label>
                    <Input type="number" value={config.automod_max_emojis} onChange={(e) => setConfig({ ...config, automod_max_emojis: parseInt(e.target.value) || 0 })} disabled={!isManager} />
                  </div>
                  <div>
                    <Label>Spam práh (zpráv / 5s)</Label>
                    <Input type="number" value={config.automod_spam_threshold} onChange={(e) => setConfig({ ...config, automod_spam_threshold: parseInt(e.target.value) || 0 })} disabled={!isManager} />
                  </div>
                </div>
                <div>
                  <Label>Akce při porušení</Label>
                  <select className="w-full bg-background border border-border rounded-md px-3 py-2" value={config.automod_action} onChange={(e) => setConfig({ ...config, automod_action: e.target.value })} disabled={!isManager}>
                    <option value="warn">Warn</option>
                    <option value="delete">Smazat zprávu</option>
                    <option value="mute">Mute</option>
                    <option value="kick">Kick</option>
                    <option value="ban">Ban</option>
                  </select>
                </div>
                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">NSFW ochrana</div>
                      <p className="text-xs text-muted-foreground">Detekce explicitního obsahu v obrázcích</p>
                    </div>
                    <Switch checked={config.nsfw_protection} onCheckedChange={(v) => setConfig({ ...config, nsfw_protection: v })} disabled={!isManager} />
                  </div>
                  <div>
                    <Label>Povolené NSFW kanály (ID, oddělené čárkou)</Label>
                    <Input
                      value={(config.nsfw_allowed_channels ?? []).join(", ")}
                      onChange={(e) => setConfig({ ...config, nsfw_allowed_channels: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      disabled={!isManager}
                    />
                  </div>
                </div>
                <Button onClick={saveConfig} disabled={!isManager}>Uložit</Button>
              </Card>
            )}
          </TabsContent>

          {/* COMMANDS */}
          <TabsContent value="commands" className="mt-4 space-y-4">
            {isManager && (
              <Card className="glass border-border p-6 space-y-3">
                <h3 className="font-display text-lg font-bold">
                  Nový vlastní příkaz {selectedGuild ? `· ${selectedGuild.name}` : "· globální"}
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Input placeholder="název (bez prefixu)" value={newCmd.name} onChange={(e) => setNewCmd({ ...newCmd, name: e.target.value })} />
                  <Input placeholder="popis (volitelné)" value={newCmd.description} onChange={(e) => setNewCmd({ ...newCmd, description: e.target.value })} />
                </div>
                <Textarea placeholder="odpověď bota" rows={3} value={newCmd.response} onChange={(e) => setNewCmd({ ...newCmd, response: e.target.value })} />
                <Button onClick={addCommand}><Plus className="h-4 w-4 mr-2" />Přidat</Button>
              </Card>
            )}
            <Card className="glass border-border p-6">
              {commands.length === 0 ? (
                <p className="text-sm text-muted-foreground">Žádné vlastní příkazy.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {commands.map((c) => (
                    <li key={c.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <code className="text-primary font-mono">{(config?.prefix ?? "!")}{c.name}</code>
                          {!c.enabled && <Badge variant="secondary">vypnuté</Badge>}
                        </div>
                        {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
                        <div className="text-sm mt-1 line-clamp-2">{typeof c.content === "object" ? (c.content as any).text : ""}</div>
                      </div>
                      {isManager && (
                        <div className="flex items-center gap-2">
                          <Switch checked={c.enabled} onCheckedChange={(v) => toggleCommand(c.id, v)} />
                          <Button size="icon" variant="ghost" onClick={() => deleteCommand(c.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          {/* WELCOME */}
          <TabsContent value="welcome" className="mt-4 space-y-4">
            {isManager && (
              <Card className="glass border-border p-6 space-y-3">
                <h3 className="font-display text-lg font-bold">Nová uvítací zpráva</h3>
                <Input placeholder="ID Discord kanálu" value={newWelcome.channel_id} onChange={(e) => setNewWelcome({ ...newWelcome, channel_id: e.target.value })} />
                <Textarea placeholder="Vítej {user} na {server}! 🎉" rows={3} value={newWelcome.content} onChange={(e) => setNewWelcome({ ...newWelcome, content: e.target.value })} />
                <p className="text-xs text-muted-foreground">Proměnné: <code>{`{user}`}</code>, <code>{`{server}`}</code>, <code>{`{memberCount}`}</code></p>
                <Button onClick={addWelcome}><Plus className="h-4 w-4 mr-2" />Přidat</Button>
              </Card>
            )}
            <Card className="glass border-border p-6">
              {welcomes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nic nenastaveno.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {welcomes.map((w) => (
                    <li key={w.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <code className="text-xs text-muted-foreground">#{w.channel_id}</code>
                        <div className="text-sm mt-1 whitespace-pre-wrap">{(w.content as any)?.text}</div>
                      </div>
                      {isManager && (
                        <Button size="icon" variant="ghost" onClick={() => deleteRow("bot_welcome", w.id)}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          {/* EMBED / WEBHOOK */}
          <TabsContent value="embed" className="mt-4">
            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="glass border-border p-6 space-y-4">
                <div>
                  <Label>Discord webhook URL <span className="text-muted-foreground">(prázdné = zařadit do fronty pro bota)</span></Label>
                  <Input placeholder="https://discord.com/api/webhooks/..." value={embedWebhook} onChange={(e) => setEmbedWebhook(e.target.value)} disabled={!isManager} />
                </div>
                <div>
                  <Label>Text zprávy (volitelně)</Label>
                  <Textarea rows={2} value={embedContent} onChange={(e) => setEmbedContent(e.target.value)} disabled={!isManager} />
                </div>
                <div>
                  <Label>Embed JSON <span className="text-muted-foreground">(podporuje formát z discohook.org)</span></Label>
                  <Textarea rows={12} className="font-mono text-xs" value={embedJson} onChange={(e) => setEmbedJson(e.target.value)} disabled={!isManager} />
                </div>
                <Button onClick={sendEmbed} disabled={!isManager || sending}>
                  {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Odeslat {selectedGuild && `do ${selectedGuild.name}`}
                </Button>
              </Card>
              <div className="space-y-2 lg:sticky lg:top-24 self-start">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Náhled</Label>
                <EmbedLivePreview content={embedContent} json={embedJson} />
              </div>
            </div>
          </TabsContent>

          {/* STREAMS */}
          <TabsContent value="streams" className="mt-4 space-y-4">
            {isManager && (
              <Card className="glass border-border p-6 space-y-3">
                <h3 className="font-display text-lg font-bold">Sledovat kanál</h3>
                <div className="grid sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <Label>Platforma</Label>
                    <select className="w-full bg-background border border-border rounded-md px-3 py-2 mt-2" value={newStream.platform} onChange={(e) => setNewStream({ ...newStream, platform: e.target.value, handle: "" })}>
                      <option value="twitch">Twitch</option>
                      <option value="youtube">YouTube</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Kanál (jméno, URL, nebo začni psát)</Label>
                    <div className="mt-2">
                      <SocialHandleField
                        id="stream-handle"
                        label=""
                        color="hsl(var(--primary))"
                        platform={newStream.platform as "twitch" | "youtube"}
                        value={newStream.handle}
                        onChange={(v) => setNewStream({ ...newStream, handle: v })}
                        placeholder="např. shroud nebo https://twitch.tv/shroud"
                        hideLabel
                      />
                    </div>
                  </div>
                  <Button onClick={addStream}><Plus className="h-4 w-4 mr-2" />Přidat</Button>
                </div>
                <Input placeholder="Discord kanál ID" value={newStream.channel} onChange={(e) => setNewStream({ ...newStream, channel: e.target.value })} />
                <Input placeholder="šablona zprávy" value={newStream.template} onChange={(e) => setNewStream({ ...newStream, template: e.target.value })} />
                <Input placeholder="Discord webhook URL (volitelné – bez bota)" value={newStream.webhook} onChange={(e) => setNewStream({ ...newStream, webhook: e.target.value })} />
                <p className="text-xs text-muted-foreground">Proměnné: <code>{`{handle}`}</code>, <code>{`{title}`}</code>, <code>{`{url}`}</code>, <code>{`{game}`}</code>.</p>
              </Card>
            )}
            <Card className="glass border-border p-6">
              {streams.length === 0 ? (
                <p className="text-sm text-muted-foreground">Žádné sledování.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {streams.map((s) => (
                    <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Radio className="h-4 w-4 text-primary" />
                        <div>
                          <div className="font-medium">{s.platform}: {s.handle}</div>
                          <code className="text-xs text-muted-foreground">→ #{s.discord_channel_id}</code>
                        </div>
                      </div>
                      {isManager && <Button size="icon" variant="ghost" onClick={() => deleteRow("bot_stream_notifications", s.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          {/* TICKETS */}
          <TabsContent value="tickets" className="mt-4">
            <TicketsConfigCard
              key={selectedGuildId}
              isManager={isManager}
              guildId={guildIdOrNull()}
              onChanged={loadAll}
            />
          </TabsContent>

          {/* STATUS CHECKS */}
          <TabsContent value="status" className="mt-4 space-y-4">
            {isManager && (
              <Card className="glass border-border p-6 space-y-3">
                <h3 className="font-display text-lg font-bold">Nový monitoring</h3>
                <div className="grid sm:grid-cols-4 gap-3">
                  <Input placeholder="popisek" value={newCheck.label} onChange={(e) => setNewCheck({ ...newCheck, label: e.target.value })} />
                  <Input placeholder="URL k pingu" value={newCheck.target} onChange={(e) => setNewCheck({ ...newCheck, target: e.target.value })} />
                  <Input placeholder="Discord kanál ID" value={newCheck.channel} onChange={(e) => setNewCheck({ ...newCheck, channel: e.target.value })} />
                  <Button onClick={addCheck}><Plus className="h-4 w-4 mr-2" />Přidat</Button>
                </div>
                <Input placeholder="Discord webhook URL (volitelné – bez bota)" value={newCheck.webhook} onChange={(e) => setNewCheck({ ...newCheck, webhook: e.target.value })} />
              </Card>
            )}
            <Card className="glass border-border p-6">
              {checks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nic se nemonitoruje.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {checks.map((c) => (
                    <li key={c.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-2.5 w-2.5 rounded-full ${c.last_status === "up" ? "bg-green-500" : c.last_status === "down" ? "bg-red-500" : "bg-muted-foreground"}`} />
                        <div>
                          <div className="font-medium">{c.label}</div>
                          <code className="text-xs text-muted-foreground">{c.target} → #{c.discord_channel_id}</code>
                        </div>
                      </div>
                      {isManager && <Button size="icon" variant="ghost" onClick={() => deleteRow("bot_status_checks", c.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

function EmbedLivePreview({ content, json }: { content: string; json: string }) {
  let embed: any = null;
  try {
    if (json.trim()) {
      const parsed = JSON.parse(json);
      embed = parsed?.embeds?.[0] ?? parsed?.embed ?? parsed;
    }
  } catch {
    return (
      <Card className="glass border-border p-6">
        <p className="text-sm text-destructive">Neplatný JSON — náhled nelze zobrazit.</p>
      </Card>
    );
  }
  return (
    <Card className="glass border-border p-4">
      <DiscordMessagePreview content={content} embed={embed} />
    </Card>
  );
}

function TicketsConfigCard({
  isManager,
  guildId,
  onChanged,
}: {
  isManager: boolean;
  guildId: string | null;
  onChanged: () => void;
}) {
  const [cfg, setCfg] = useState<any>(null);
  const [panelSending, setPanelSending] = useState(false);
  const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([]);
  const [newTicketCategory, setNewTicketCategory] = useState({ label: "", description: "", emoji: "", discord_category_id: "" });

  const loadTicketCategories = async () => {
    if (!guildId) {
      setTicketCategories([]);
      return;
    }
    const { data } = await supabase
      .from("bot_ticket_categories" as any)
      .select("*")
      .eq("guild_id", guildId)
      .order("position", { ascending: true })
      .order("label", { ascending: true });
    setTicketCategories(((data as any) ?? []) as TicketCategory[]);
  };

  useEffect(() => {
    (async () => {
      const q = supabase.from("bot_tickets_config").select("*");
      const filtered = guildId ? q.eq("guild_id", guildId) : q.is("guild_id", null);
      const r = await filtered.maybeSingle();
      if (r.data) {
        setCfg(r.data);
      } else {
        const ins = await supabase
          .from("bot_tickets_config")
          .insert({
            guild_id: guildId,
            welcome_md: "Ahoj! Popiš svůj problém a tým ti odpoví co nejdřív.",
            transcripts_enabled: true,
            mirror_enabled: false,
          })
          .select()
          .maybeSingle();
        setCfg(ins.data);
      }
      await loadTicketCategories();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  if (!cfg) return <p className="text-sm text-muted-foreground">Načítání…</p>;

  const save = async () => {
    const { error } = await supabase.from("bot_tickets_config").update({
      category_id: cfg.category_id,
      support_role_id: cfg.support_role_id,
      welcome_md: cfg.welcome_md,
      transcripts_enabled: cfg.transcripts_enabled,
      panel_channel_id: cfg.panel_channel_id,
      panel_mode: cfg.panel_mode || "button",
      mirror_enabled: cfg.mirror_enabled,
      sync_channel_id: cfg.sync_channel_id,
      sync_webhook_url: cfg.sync_webhook_url,
    }).eq("id", cfg.id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { toast({ title: "Uloženo", description: "Panel se obnoví v Discordu během chvíle." }); onChanged(); }
  };

  const sendPanelNow = async () => {
    const channelId = `${cfg.panel_channel_id ?? ""}`.trim();
    if (!channelId) {
      toast({ title: "Chybí ID kanálu", description: "Vyplň ID Discord kanálu, kam se má ticket panel odeslat.", variant: "destructive" });
      return;
    }

    setPanelSending(true);
    try {
      const { error } = await supabase.from("bot_outbound_queue").insert({
        channel_id: channelId,
        payload: {
          action: "refresh_ticket_panel",
          guild_id: guildId ?? null,
          panel_channel_id: channelId,
        },
        source: "ticket_panel_manual",
      });
      if (error) throw error;
      toast({ title: "Zařazeno do fronty", description: `Bot odešle panel do kanálu ${channelId}.` });
    } catch (e: any) {
      toast({ title: "Chyba", description: e?.message ?? "Panel se nepodařilo zařadit k odeslání.", variant: "destructive" });
    } finally {
      setPanelSending(false);
    }
  };

  const addTicketCategory = async () => {
    if (!guildId || !newTicketCategory.label.trim()) return;
    const { error } = await supabase.from("bot_ticket_categories" as any).insert({
      guild_id: guildId,
      label: newTicketCategory.label.trim(),
      description: newTicketCategory.description.trim() || null,
      emoji: newTicketCategory.emoji.trim() || null,
      discord_category_id: newTicketCategory.discord_category_id.trim() || null,
      position: ticketCategories.length + 1,
      enabled: true,
    });
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else {
      setNewTicketCategory({ label: "", description: "", emoji: "", discord_category_id: "" });
      await loadTicketCategories();
      toast({ title: "Kategorie přidána" });
    }
  };

  const updateTicketCategory = async (id: string, patch: Partial<TicketCategory>) => {
    const { error } = await supabase.from("bot_ticket_categories" as any).update(patch).eq("id", id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else await loadTicketCategories();
  };

  const deleteTicketCategory = async (id: string) => {
    const { error } = await supabase.from("bot_ticket_categories" as any).delete().eq("id", id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else await loadTicketCategories();
  };

  const panelMode: "button" | "categories" = cfg.panel_mode === "categories" || cfg.panel_mode === "markdown" ? "categories" : "button";

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="glass border-border p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Kategorie (ID)</Label>
            <Input value={cfg.category_id ?? ""} onChange={(e) => setCfg({ ...cfg, category_id: e.target.value })} disabled={!isManager} />
          </div>
          <div>
            <Label>Support role (ID)</Label>
            <Input value={cfg.support_role_id ?? ""} onChange={(e) => setCfg({ ...cfg, support_role_id: e.target.value })} disabled={!isManager} />
          </div>
          <div className="sm:col-span-2">
            <Label>ID kanálu pro ticket panel</Label>
            <Input placeholder="Např. 1506373996277665862" value={cfg.panel_channel_id ?? ""} onChange={(e) => setCfg({ ...cfg, panel_channel_id: e.target.value.trim() })} disabled={!isManager} />
            <p className="text-xs text-muted-foreground mt-1">Sem bot pošle úvodní ticket panel. Ticket kanály se vytvoří ve stejné kategorii, pokud není vyplněná kategorie níže.</p>
          </div>
        </div>
        <div>
          <Label>Režim panelu</Label>
          <div className="flex gap-2 mt-1">
            <Button
              type="button"
              variant={panelMode === "button" ? "default" : "outline"}
              size="sm"
              onClick={() => setCfg({ ...cfg, panel_mode: "button" })}
              disabled={!isManager}
            >
              🎫 Tlačítko
            </Button>
            <Button
              type="button"
              variant={panelMode === "categories" ? "default" : "outline"}
              size="sm"
              onClick={() => setCfg({ ...cfg, panel_mode: "categories" })}
              disabled={!isManager}
            >
              🗂️ Výběr kategorií
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Tlačítko vytvoří obecný ticket. Výběr kategorií ukáže volby jako BUG nebo Dotaz.
          </p>
        </div>
        <div>
          <Label>Uvítací zpráva ticketu (markdown)</Label>
          <Textarea rows={8} value={cfg.welcome_md ?? ""} onChange={(e) => setCfg({ ...cfg, welcome_md: e.target.value })} disabled={!isManager} />
        </div>
        {guildId && (
          <div className="border-t border-border pt-4 space-y-3">
            <div>
              <div className="font-medium">Kategorie ticketů</div>
              <p className="text-xs text-muted-foreground">Použije se v režimu výběru kategorií. Každá volba může mít vlastní Discord kategorii.</p>
            </div>
            <div className="grid sm:grid-cols-5 gap-2">
              <Input placeholder="Název (BUG)" value={newTicketCategory.label} onChange={(e) => setNewTicketCategory({ ...newTicketCategory, label: e.target.value })} disabled={!isManager} />
              <Input placeholder="Popis" value={newTicketCategory.description} onChange={(e) => setNewTicketCategory({ ...newTicketCategory, description: e.target.value })} disabled={!isManager} />
              <Input placeholder="Emoji" value={newTicketCategory.emoji} onChange={(e) => setNewTicketCategory({ ...newTicketCategory, emoji: e.target.value })} disabled={!isManager} />
              <Input placeholder="ID Discord kategorie" value={newTicketCategory.discord_category_id} onChange={(e) => setNewTicketCategory({ ...newTicketCategory, discord_category_id: e.target.value.trim() })} disabled={!isManager} />
              <Button type="button" onClick={addTicketCategory} disabled={!isManager || !newTicketCategory.label.trim()}><Plus className="h-4 w-4 mr-2" />Přidat</Button>
            </div>
            <div className="space-y-2">
              {ticketCategories.map((category) => (
                <div key={category.id} className="grid sm:grid-cols-[80px_1fr_1fr_1fr_auto_auto] gap-2 items-center rounded-md border border-border p-2">
                  <Input value={category.emoji ?? ""} onChange={(e) => updateTicketCategory(category.id, { emoji: e.target.value || null })} disabled={!isManager} />
                  <Input value={category.label} onChange={(e) => updateTicketCategory(category.id, { label: e.target.value })} disabled={!isManager} />
                  <Input value={category.description ?? ""} onChange={(e) => updateTicketCategory(category.id, { description: e.target.value || null })} disabled={!isManager} />
                  <Input value={category.discord_category_id ?? ""} onChange={(e) => updateTicketCategory(category.id, { discord_category_id: e.target.value.trim() || null })} disabled={!isManager} />
                  <Switch checked={category.enabled} onCheckedChange={(enabled) => updateTicketCategory(category.id, { enabled })} disabled={!isManager} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => deleteTicketCategory(category.id)} disabled={!isManager}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {ticketCategories.length === 0 && <p className="text-xs text-muted-foreground">Zatím nejsou vytvořené žádné kategorie.</p>}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div>
            <div className="font-medium">Ukládat transkripty</div>
            <p className="text-xs text-muted-foreground">Po zavření ticketu uložit historii</p>
          </div>
          <Switch checked={cfg.transcripts_enabled} onCheckedChange={(v) => setCfg({ ...cfg, transcripts_enabled: v })} disabled={!isManager} />
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Synchronizace s webovými tickety</div>
              <p className="text-xs text-muted-foreground">
                Nové tickety, odpovědi a změny stavu se z webu posílají na Discord.
              </p>
            </div>
            <Switch
              checked={!!cfg.mirror_enabled}
              onCheckedChange={(v) => setCfg({ ...cfg, mirror_enabled: v })}
              disabled={!isManager}
            />
          </div>
          <div>
            <Label>Sync kanál (ID) — pro externího bota</Label>
            <Input
              placeholder="ID Discord kanálu"
              value={cfg.sync_channel_id ?? ""}
              onChange={(e) => setCfg({ ...cfg, sync_channel_id: e.target.value })}
              disabled={!isManager}
            />
          </div>
          <div>
            <Label>Nebo Discord webhook URL — bez bota (okamžité)</Label>
            <Input
              placeholder="https://discord.com/api/webhooks/..."
              value={cfg.sync_webhook_url ?? ""}
              onChange={(e) => setCfg({ ...cfg, sync_webhook_url: e.target.value })}
              disabled={!isManager}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={!isManager}>Uložit</Button>
          <Button
            type="button"
            variant="outline"
            disabled={!isManager || !cfg.panel_channel_id || panelSending}
            onClick={sendPanelNow}
          >
            {panelSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Odeslat panel nyní
          </Button>
        </div>
      </Card>
      <div className="space-y-4 lg:sticky lg:top-24 self-start">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Náhled panelu</Label>
          <Card className="glass border-border p-4 space-y-3">
            <DiscordMessagePreview content={cfg.welcome_md || (panelMode === "button" ? "Klikni níže pro otevření ticketu." : "Pro otevření ticketu napiš zprávu.")} />
            {panelMode === "button" && (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md bg-[#5865F2] hover:bg-[#4752c4] text-white text-sm font-medium px-4 py-2 transition-colors"
                disabled
              >
                🎫 Otevřít ticket
              </button>
            )}
            {panelMode === "categories" && (
              <div className="rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-muted-foreground">
                Vyber typ ticketu: {ticketCategories.filter((category) => category.enabled).map((category) => `${category.emoji ?? "🎫"} ${category.label}`).join(" · ") || "žádné kategorie"}
              </div>
            )}
          </Card>
        </div>
        <TicketsWebhookPreview webhookUrl={cfg.sync_webhook_url ?? ""} isManager={isManager} />
      </div>
    </div>
  );
}

function TicketsWebhookPreview({ webhookUrl, isManager }: { webhookUrl: string; isManager: boolean }) {
  const [sending, setSending] = useState(false);
  const trimmed = webhookUrl.trim();
  const isValid = /^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/.test(trimmed);

  const sampleEmbed = {
    title: "🎫 Nový ticket #42",
    description: "**Předmět:** Příklad ticketu\n\nUkázkový popis problému od uživatele.",
    color: 0x5865F2,
    fields: [
      { name: "Priorita", value: "medium", inline: true },
      { name: "Stav", value: "open", inline: true },
    ],
    footer: { text: "StudioVoxario • Tickets" },
    timestamp: new Date().toISOString(),
  };

  const sendTest = async () => {
    if (!isValid) return;
    setSending(true);
    try {
      const res = await fetch(trimmed, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "✅ Testovací zpráva ze sync webhooku (tickety).",
          embeds: [sampleEmbed],
        }),
      });
      if (res.ok || res.status === 204) toast({ title: "Test odeslán", description: "Zkontroluj kanál na Discordu." });
      else toast({ title: "Chyba", description: `Discord vrátil ${res.status}`, variant: "destructive" });
    } catch (e: any) {
      toast({ title: "Chyba", description: e?.message ?? "Nelze odeslat", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Náhled sync webhooku</Label>
        {trimmed ? (
          <Badge variant={isValid ? "default" : "destructive"} className="text-[10px]">
            {isValid ? "URL OK" : "Neplatná URL"}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">Bez webhooku</Badge>
        )}
      </div>
      <Card className="glass border-border p-4 space-y-3">
        {trimmed ? (
          <>
            <DiscordMessagePreview
              content="✅ Testovací zpráva ze sync webhooku (tickety)."
              embed={sampleEmbed}
            />
            <Button size="sm" onClick={sendTest} disabled={!isValid || !isManager || sending} className="gap-2">
              <Send className="h-3.5 w-3.5" />
              {sending ? "Odesílám…" : "Odeslat test na webhook"}
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Vlož Discord webhook URL výše a uvidíš živý náhled ukázkové sync zprávy.
          </p>
        )}
      </Card>
    </div>
  );
}

export default DashboardBot;
