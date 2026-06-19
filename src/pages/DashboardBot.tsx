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
import { Link, Navigate } from "react-router-dom";
import { Bot, Plus, Trash2, Send, Radio, Loader2, Server, Globe, ShieldAlert, ScanSearch, Twitch, Youtube, MessageCircle } from "lucide-react";
import { ChatBotPlatformPanel } from "@/components/ChatBotPlatformPanel";
import { DiscordGuildPicker } from "@/components/DiscordGuildPicker";
import { DiscordMessagePreview } from "@/components/DiscordMessagePreview";
import { EmbedBuilder } from "@/components/EmbedBuilder";
import { GuildResourceSelect, GuildResourceLabel } from "@/components/GuildResourceSelect";
import { MultiChannelPicker } from "@/components/MultiChannelPicker";
import { MultiRolePicker } from "@/components/MultiRolePicker";
import { BotFaq } from "@/components/BotFaq";
import { ServerStatsCard } from "@/components/ServerStatsCard";
import { SocialHandleField } from "@/components/SocialHandleField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

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
  bypass_role_ids: string[];
  bot_maintenance: boolean;
  web_maintenance?: boolean;
  maintenance_channel: string | null;
};

function ScanMembersButton({ guildId, disabled }: { guildId: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const { error } = await supabase.from("bot_outbound_queue").insert({
      source: "bot_scan",
      payload: { action: "scan_members", guild_id: guildId },
    });
    setBusy(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Kontrola spuštěna",
        description: "Bot prověří všechny členy a souhrn pošle do Alerts kanálu.",
      });
    }
  };
  return (
    <Button onClick={run} disabled={disabled || busy} variant="outline" className="border-primary/50">
      {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ScanSearch className="h-4 w-4 mr-2" />}
      Spustit kontrolu členů
    </Button>
  );
}

function ScanMessagesButton({ guildId, disabled }: { guildId: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const { error } = await supabase.from("bot_outbound_queue").insert({
      source: "bot_scan",
      payload: { action: "scan_messages", guild_id: guildId, per_channel: 30 },
    });
    setBusy(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Image scan spuštěn",
        description: "Bot projde obrázky ve všech kanálech a souhrn pošle do Alerts kanálu.",
      });
    }
  };
  return (
    <Button onClick={run} disabled={disabled || busy} variant="outline" className="border-primary/50">
      {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ScanSearch className="h-4 w-4 mr-2" />}
      Skenovat obrázky ve všech kanálech
    </Button>
  );
}

type Command = { id: string; name: string; description: string | null; response_type: string; content: any; enabled: boolean; guild_id: string | null };
type Welcome = { id: string; channel_id: string; message_type: string; content: any; enabled: boolean; guild_id: string | null };
type StreamNotif = { id: string; platform: string; handle: string; discord_channel_id: string; template: string; enabled: boolean; guild_id: string | null };
type StatusCheck = { id: string; label: string; target_type: string; target: string; discord_channel_id: string; enabled: boolean; last_status: string | null; guild_id: string | null };
type BotStatus = { last_heartbeat: string | null; version: string | null; guild_count: number | null };
type GuildOption = { id: string; guild_id: string; name: string; icon_url: string | null; owner_user_id?: string | null; owner_discord_id?: string | null };
type TicketCategory = { id: string; guild_id: string; label: string; description: string | null; emoji: string | null; discord_category_id: string | null; position: number; enabled: boolean };

const GLOBAL_KEY = "__global__";

const DashboardBot = () => {
  const { user, loading: authLoading } = useAuth();
  const { can, loading: permsLoading } = usePermissions();

  // Guild scope
  const [guilds, setGuilds] = useState<GuildOption[]>([]);
  const [guildsLoaded, setGuildsLoaded] = useState(false);
  const [selectedGuildId, setSelectedGuildId] = useState<string>(GLOBAL_KEY);
  const [botCategory, setBotCategory] = useState<"discord" | "twitch" | "youtube">("discord");
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

  const [myDiscordId, setMyDiscordId] = useState<string | null>(null);
  const [scope, setScope] = useState<"mine" | "foreign">("mine");

  // Load list of guilds user can manage (admin sees all approved + pending; owner sees own approved)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [g, did] = await Promise.all([
        supabase
          .from("bot_guilds")
          .select("id, guild_id, name, icon_url, status, owner_user_id, owner_discord_id")
          .eq("status", "approved")
          .order("name"),
        supabase.rpc("current_user_discord_id"),
      ]);
      setGuilds(((g.data as any) ?? []) as GuildOption[]);
      setMyDiscordId((did.data as any) ?? null);
      setGuildsLoaded(true);
    })();
  }, [user]);

  const isMine = (g: GuildOption) =>
    (!!user && g.owner_user_id === user.id) ||
    (!!myDiscordId && g.owner_discord_id === myDiscordId);
  const scopedGuilds = useMemo(
    () => guilds.filter((g) => (scope === "mine" ? isMine(g) : !isMine(g))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guilds, scope, myDiscordId, user]
  );

  // Picker dialog state — opens automatically the first time the user lands
  // on the dashboard so they can pick which server to configure.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [hasPickedScope, setHasPickedScope] = useState(false);

  useEffect(() => {
    if (hasPickedScope) return;
    if (!guildsLoaded) return;
    // If user has nothing to pick (no guilds and no global access), let the
    // existing Navigate fallback handle it.
    if (guilds.length === 0 && !canUseGlobalConfig) return;
    // If only one option exists, auto-pick silently.
    if (guilds.length === 1 && !canUseGlobalConfig) {
      setSelectedGuildId(guilds[0].guild_id);
      setHasPickedScope(true);
      return;
    }
    if (guilds.length === 0 && canUseGlobalConfig) {
      setSelectedGuildId(GLOBAL_KEY);
      setHasPickedScope(true);
      return;
    }
    setPickerOpen(true);
  }, [hasPickedScope, guildsLoaded, canUseGlobalConfig, guilds]);

  const pickScope = (value: string) => {
    setSelectedGuildId(value);
    setHasPickedScope(true);
    setPickerOpen(false);
  };


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
      bypass_role_ids: config.bypass_role_ids ?? [],
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
        {/* Hero header */}
        <div className="mb-8 relative overflow-hidden rounded-2xl border border-border/60 glass p-8 md:p-10">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-primary text-glow">
                {botCategory === "discord" ? "Discord" : botCategory === "twitch" ? "Twitch chat" : "YouTube chat"}
              </p>
              <h1 className="font-display font-black text-4xl md:text-5xl mt-2 flex items-center gap-3">
                <Bot className="h-10 w-10" /> Správce bota
              </h1>
              {botCategory === "discord" ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  {selectedGuild ? (
                    <>
                      {selectedGuild.icon_url ? (
                        <img src={selectedGuild.icon_url} className="h-5 w-5 rounded-full" alt="" />
                      ) : (
                        <Server className="h-4 w-4" />
                      )}
                      <span className="text-foreground/90 font-medium">{selectedGuild.name}</span>
                      <code className="text-xs">{selectedGuild.guild_id}</code>
                    </>
                  ) : (
                    <>
                      <Globe className="h-4 w-4" />
                      <span className="text-foreground/90 font-medium">Globální / šablony</span>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)} className="ml-2 border-primary/40 hover:border-primary/80">
                    <Server className="h-3.5 w-3.5 mr-1.5" />
                    Změnit server
                  </Button>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Sdílený chat bot — moderace, anti-scam, uvítání a vlastní příkazy přímo v chatu streamu.
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap shrink-0">
              {botCategory === "discord" && (
                <Button variant="outline" onClick={() => (window.location.href = "/dashboard/bot/guilds")} className="border-primary/40 hover:border-primary/80">
                  <Server className="h-4 w-4 mr-2" />
                  Servery bota
                </Button>
              )}
              <Card className="glass border-border/60 p-4 flex items-center gap-3 hover:border-primary/60 hover:-translate-y-0.5 transition-all relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className={`h-3 w-3 rounded-full relative ${botOnline ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
                <div className="relative">
                  <div className="text-sm font-medium">{botOnline ? "Bot online" : "Bot offline"}</div>
                  <div className="text-xs text-muted-foreground">
                    {status?.guild_count ?? 0} serverů · {status?.version ?? "—"}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>

        {/* Category switcher: Discord / Twitch / YouTube */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { key: "discord", label: "Discord bot", desc: "Servery, automod, tickety, embed", Icon: MessageCircle },
            { key: "twitch", label: "Twitch chat bot", desc: "Moderace a příkazy v Twitch chatu", Icon: Twitch },
            { key: "youtube", label: "YouTube chat bot", desc: "Moderace a příkazy v Live chatu", Icon: Youtube },
          ] as const).map((cat) => {
            const active = botCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setBotCategory(cat.key)}
                className={`text-left p-4 rounded-xl border transition-all glass ${
                  active
                    ? "border-primary bg-primary/10 [box-shadow:var(--glow-soft)]"
                    : "border-border hover:border-primary/60 hover:-translate-y-0.5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center border ${active ? "bg-primary/20 border-primary/60" : "bg-secondary/40 border-border"}`}>
                    <cat.Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-bold">{cat.label}</div>
                    <div className="text-xs text-muted-foreground">{cat.desc}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>


        {botCategory !== "discord" && (
          <ChatBotPlatformPanel platform={botCategory} />
        )}

        {botCategory === "discord" && <>
        {/* Server picker dialog */}
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0">
            <DialogHeader className="px-6 pt-6 pb-2">
              <DialogTitle>Vyber server</DialogTitle>
              <DialogDescription>
                Zvol server, který chceš spravovat. Můžeš to kdykoli změnit tlačítkem
                „Změnit server".
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 space-y-2">
              {canManageBot && (
                <div className="flex gap-2 sticky top-0 bg-background/80 backdrop-blur py-2 z-10">
                  <Button
                    type="button"
                    size="sm"
                    variant={scope === "mine" ? "default" : "outline"}
                    onClick={() => setScope("mine")}
                  >
                    Moje servery ({guilds.filter(isMine).length})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={scope === "foreign" ? "default" : "outline"}
                    onClick={() => setScope("foreign")}
                  >
                    Cizí servery — admin ({guilds.filter((g) => !isMine(g)).length})
                  </Button>
                </div>
              )}
              {canUseGlobalConfig && scope === "mine" && (
                <button
                  type="button"
                  onClick={() => pickScope(GLOBAL_KEY)}
                  className={`w-full flex items-center gap-3 p-3 border rounded-lg text-left hover:bg-secondary/50 transition ${
                    selectedGuildId === GLOBAL_KEY ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <Globe className="h-6 w-6" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">Globální / šablony</div>
                    <div className="text-xs text-muted-foreground">
                      Výchozí nastavení pro všechny servery
                    </div>
                  </div>
                </button>
              )}
              {scopedGuilds.map((g) => (
                <button
                  key={g.guild_id}
                  type="button"
                  onClick={() => pickScope(g.guild_id)}
                  className={`w-full flex items-center gap-3 p-3 border rounded-lg text-left hover:bg-secondary/50 transition ${
                    selectedGuildId === g.guild_id ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  {g.icon_url ? (
                    <img src={g.icon_url} className="h-8 w-8 rounded-full" alt="" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                      {g.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{g.name}</div>
                    <code className="text-xs text-muted-foreground">{g.guild_id}</code>
                  </div>
                </button>
              ))}
              {scopedGuilds.length === 0 && (
                <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                  {scope === "mine"
                    ? "Nemáš žádné vlastní servery."
                    : "Žádné cizí servery ke správě."}
                  <div className="mt-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/dashboard/bot/guilds">Přejít na Servery bota</Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
              <Button
                variant="default"
                className="gap-2"
                onClick={() => { setClaimOpen(true); }}
              >
                <Plus className="h-4 w-4" /> Přidat / převzít můj server
              </Button>
              {canManageBot && (
                <Button variant="outline" asChild className="gap-2">
                  <Link to="/dashboard/bot/guilds">Schvalovací stránka (admin)</Link>
                </Button>
              )}
              <Button variant="outline" onClick={() => setPickerOpen(false)}>
                Zavřít
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DiscordGuildPicker
          open={claimOpen}
          onOpenChange={setClaimOpen}
          onClaimed={async () => {
            // Reload guilds so the new server appears in the scope switcher
            const { data } = await supabase
              .from("bot_guilds")
              .select("id, guild_id, name, icon_url, status, owner_user_id, owner_discord_id")
              .eq("status", "approved")
              .order("name");
            setGuilds(((data as any) ?? []) as GuildOption[]);
          }}
        />



        <Tabs defaultValue="basics" orientation="vertical" className="flex flex-col lg:flex-row gap-6 items-start">
          <TabsList className="lg:sticky lg:top-20 flex lg:flex-col h-auto w-full lg:w-60 shrink-0 bg-card/40 backdrop-blur-md border border-border rounded-xl p-2 gap-1 overflow-x-auto lg:overflow-visible justify-start">
            {[
              { v: "basics", l: "Základ" },
              { v: "automod", l: "Auto-moderace" },
              { v: "commands", l: "Příkazy" },
              { v: "welcome", l: "Uvítací zprávy" },
              { v: "embed", l: "Embed / Webhook" },
              { v: "streams", l: "YT / Twitch" },
              { v: "tickets", l: "Tickety" },
              { v: "status", l: "Status checks" },
              { v: "serverstats", l: "Server Stats" },
              { v: "faq", l: "FAQ / Návod" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.v}
                value={tab.v}
                className="w-full justify-start whitespace-nowrap rounded-lg border border-transparent px-3 py-2 text-sm text-muted-foreground transition-all hover:text-foreground hover:bg-secondary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/60 data-[state=active]:[box-shadow:var(--glow-soft)]"
              >
                {tab.l}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 min-w-0 w-full">

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
                    <Label>Welcome kanál</Label>
                    <GuildResourceSelect guildId={guildIdOrNull()} kind="text" value={config.default_welcome_channel} onChange={(v) => setConfig({ ...config, default_welcome_channel: v })} disabled={!isManager} placeholder="Vyber kanál" />
                  </div>
                  <div>
                    <Label>Log kanál</Label>
                    <GuildResourceSelect guildId={guildIdOrNull()} kind="text" value={config.default_log_channel} onChange={(v) => setConfig({ ...config, default_log_channel: v })} disabled={!isManager} placeholder="Vyber kanál" />
                  </div>
                  <div>
                    <Label>Alerts kanál</Label>
                    <GuildResourceSelect guildId={guildIdOrNull()} kind="text" value={config.default_alerts_channel} onChange={(v) => setConfig({ ...config, default_alerts_channel: v })} disabled={!isManager} placeholder="Vyber kanál" />
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
                    <Label>Maintenance kanál</Label>
                    <GuildResourceSelect guildId={guildIdOrNull()} kind="text" value={config.maintenance_channel} onChange={(v) => setConfig({ ...config, maintenance_channel: v })} disabled={!isManager} placeholder="Vyber kanál" />
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
                    <Label>Povolené NSFW kanály</Label>
                    <MultiChannelPicker
                      guildId={guildIdOrNull()}
                      value={config.nsfw_allowed_channels ?? []}
                      onChange={(v) => setConfig({ ...config, nsfw_allowed_channels: v })}
                      disabled={!isManager}
                      placeholder="Přidat NSFW kanál"
                    />
                  </div>
                </div>
                <div className="border-t border-border pt-4 space-y-2">
                  <div className="font-medium">Bypass role (žádná penalizace)</div>
                  <p className="text-xs text-muted-foreground">
                    Uživatelé s některou z těchto rolí <strong>nebudou banováni, vyhozeni ani jejich zprávy mazány</strong> anti-scam ani anti-spam ochranou.
                    Mohou posílat jakékoliv odkazy. Pokud poruší pravidla, bot pouze pošle <strong>upozornění do Alerts kanálu</strong> a zpráva zůstane.
                  </p>
                  <MultiRolePicker
                    guildId={guildIdOrNull()}
                    value={config.bypass_role_ids ?? []}
                    onChange={(v) => setConfig({ ...config, bypass_role_ids: v })}
                    disabled={!isManager}
                    placeholder="Přidat bypass roli"
                  />
                </div>
                {selectedGuild && (
                  <div className="border-t border-border pt-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <div className="font-medium">Anti-bot / Anti-scam — kontrola členů</div>
                        <p className="text-xs text-muted-foreground">
                          Projde všechny členy serveru a vyhodnotí podezřelé účty (nově vytvořené, nick „nitro/free/gift", neoficiální boti).
                          Tvrdé případy automaticky <strong>banuje</strong> (+kick fallback). Ostatní označí jako „sledováno".
                          Souhrn odejde do <strong>Alerts kanálu</strong> (nastav v záložce Základ).
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ScanMembersButton guildId={selectedGuild.guild_id} disabled={!isManager} />
                      <ScanMessagesButton guildId={selectedGuild.guild_id} disabled={!isManager} />
                    </div>
                  </div>
                )}
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
                <GuildResourceSelect
                  guildId={guildIdOrNull()}
                  kind="text"
                  value={newWelcome.channel_id}
                  onChange={(v) => setNewWelcome({ ...newWelcome, channel_id: v ?? "" })}
                  placeholder="Vyber kanál"
                />

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
                        <code className="text-xs text-muted-foreground"><GuildResourceLabel guildId={w.guild_id} id={w.channel_id} kind="channel" /></code>
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
            <EmbedBuilder
              guildId={guildIdOrNull()}
              guildName={selectedGuild?.name}
              availableGuilds={guilds}
              isManager={isManager}
            />
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
                <div>
                  <Label className="text-xs">Discord kanál</Label>
                  <GuildResourceSelect
                    guildId={guildIdOrNull()}
                    kind="text"
                    value={newStream.channel}
                    onChange={(v) => setNewStream({ ...newStream, channel: v ?? "" })}
                    placeholder="Vyber kanál pro notifikace"
                  />
                </div>

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
                          <code className="text-xs text-muted-foreground">→ <GuildResourceLabel guildId={s.guild_id} id={s.discord_channel_id} kind="channel" /></code>
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
                  <GuildResourceSelect
                    guildId={guildIdOrNull()}
                    kind="text"
                    value={newCheck.channel}
                    onChange={(v) => setNewCheck({ ...newCheck, channel: v ?? "" })}
                    placeholder="Vyber kanál"
                  />

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
                          <code className="text-xs text-muted-foreground">{c.target} → <GuildResourceLabel guildId={c.guild_id} id={c.discord_channel_id} kind="channel" /></code>
                        </div>
                      </div>
                      {isManager && <Button size="icon" variant="ghost" onClick={() => deleteRow("bot_status_checks", c.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>

          {/* SERVER STATS */}
          <TabsContent value="serverstats" className="mt-4">
            <ServerStatsCard guildId={guildIdOrNull()} isManager={isManager} />
          </TabsContent>

          {/* FAQ */}
          <TabsContent value="faq" className="mt-4">
            <BotFaq />
          </TabsContent>
          </div>
        </Tabs>
        </>}
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
    const ticketConfigPayload = {
      category_id: cfg.category_id,
      support_role_id: cfg.support_role_id,
      notify_channel_id: cfg.notify_channel_id,
      welcome_md: cfg.welcome_md,
      transcripts_enabled: cfg.transcripts_enabled,
      panel_channel_id: cfg.panel_channel_id,
      panel_mode: cfg.panel_mode || "button",
      mirror_enabled: cfg.mirror_enabled,
      sync_channel_id: cfg.sync_channel_id,
      sync_webhook_url: cfg.sync_webhook_url,
      external_webhook_url: cfg.external_webhook_url,
    };
    const { error } = await supabase.from("bot_tickets_config").update(ticketConfigPayload as any).eq("id", cfg.id);
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
      const panelContent = cfg.welcome_md || (panelMode === "button" ? "Klikni níže pro otevření ticketu." : "Vyber typ ticketu níže.");
      const panelComponents = panelMode === "button"
        ? [{ type: 1, components: [{ type: 2, style: 1, custom_id: "ticket_open", label: "Otevřít ticket", emoji: { name: "🎫" } }] }]
        : ticketCategories.filter((category) => category.enabled).length > 0
          ? [{
              type: 1,
              components: [{
                type: 3,
                custom_id: "ticket_category_select",
                placeholder: "Vyber typ ticketu",
                min_values: 1,
                max_values: 1,
                options: ticketCategories.filter((category) => category.enabled).slice(0, 25).map((category) => ({
                  label: category.label.slice(0, 100),
                  value: category.id,
                  description: category.description?.slice(0, 100) || undefined,
                  emoji: category.emoji ? { name: category.emoji } : undefined,
                })),
              }],
            }]
          : undefined;
      const { error } = await supabase.from("bot_outbound_queue").insert({
        channel_id: channelId,
        payload: {
          action: "refresh_ticket_panel",
          guild_id: guildId ?? null,
          panel_channel_id: channelId,
          panel_mode: panelMode,
          content: panelContent,
          components: panelComponents,
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
    <div className="space-y-4">
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="glass border-border p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Discord kategorie (kam vytvářet tickety)</Label>
            <GuildResourceSelect guildId={guildId} kind="category" value={cfg.category_id} onChange={(v) => setCfg({ ...cfg, category_id: v })} disabled={!isManager} placeholder="Vyber kategorii" />
          </div>
          <div>
            <Label>Support role</Label>
            <GuildResourceSelect guildId={guildId} kind="role" value={cfg.support_role_id} onChange={(v) => setCfg({ ...cfg, support_role_id: v })} disabled={!isManager} placeholder="Vyber roli" />
          </div>
          <div className="sm:col-span-2">
            <Label>Kanál pro ticket panel</Label>
            <GuildResourceSelect guildId={guildId} kind="text" value={cfg.panel_channel_id} onChange={(v) => setCfg({ ...cfg, panel_channel_id: v })} disabled={!isManager} placeholder="Vyber textový kanál" />
            <p className="text-xs text-muted-foreground mt-1">Sem bot pošle jen úvodní ticket panel.</p>
          </div>
          <div className="sm:col-span-2">
            <Label>Kanál pro oznámení o nových ticketech</Label>
            <GuildResourceSelect guildId={guildId} kind="text" value={cfg.notify_channel_id} onChange={(v) => setCfg({ ...cfg, notify_channel_id: v })} disabled={!isManager} placeholder="Vyber textový kanál" />
            <p className="text-xs text-muted-foreground mt-1">Sem bot pošle zprávu po vytvoření ticketu přes panel. Pokud je prázdné, oznámení se neposílá.</p>
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
              <GuildResourceSelect guildId={guildId} kind="category" value={newTicketCategory.discord_category_id || null} onChange={(v) => setNewTicketCategory({ ...newTicketCategory, discord_category_id: v ?? "" })} disabled={!isManager} placeholder="Discord kategorie" />
              <Button type="button" onClick={addTicketCategory} disabled={!isManager || !newTicketCategory.label.trim()}><Plus className="h-4 w-4 mr-2" />Přidat</Button>
            </div>
            <div className="space-y-2">
              {ticketCategories.map((category) => (
                <div key={category.id} className="grid sm:grid-cols-[80px_1fr_1fr_1fr_auto_auto] gap-2 items-center rounded-md border border-border p-2">
                  <Input value={category.emoji ?? ""} onChange={(e) => updateTicketCategory(category.id, { emoji: e.target.value || null })} disabled={!isManager} />
                  <Input value={category.label} onChange={(e) => updateTicketCategory(category.id, { label: e.target.value })} disabled={!isManager} />
                  <Input value={category.description ?? ""} onChange={(e) => updateTicketCategory(category.id, { description: e.target.value || null })} disabled={!isManager} />
                  <GuildResourceSelect guildId={guildId} kind="category" value={category.discord_category_id} onChange={(v) => updateTicketCategory(category.id, { discord_category_id: v })} disabled={!isManager} placeholder="Discord kategorie" />
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
            <Label>Sync kanál — pro externího bota</Label>
            <GuildResourceSelect guildId={guildId} kind="text" value={cfg.sync_channel_id} onChange={(v) => setCfg({ ...cfg, sync_channel_id: v })} disabled={!isManager} placeholder="Vyber kanál" />
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

        <div className="border-t border-border pt-4 space-y-3">
          <div>
            <div className="font-medium">Vlastní web (externí webhook)</div>
            <p className="text-xs text-muted-foreground">
              Bot na tuto URL pošle JSON při událostech ticketu (`ticket.created`, `ticket.reply`, `ticket.status`, `ticket.deleted`). Pro vlastní web mimo tuto aplikaci.
            </p>
          </div>
          <Input
            placeholder="https://tvuj-web.cz/api/discord-tickets"
            value={cfg.external_webhook_url ?? ""}
            onChange={(e) => setCfg({ ...cfg, external_webhook_url: e.target.value })}
            disabled={!isManager}
          />
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
    {guildId && <OpenTicketsList guildId={guildId} isManager={isManager} transcriptsEnabled={!!cfg.transcripts_enabled} />}
    </div>
  );
}

function OpenTicketsList({ guildId, isManager, transcriptsEnabled }: { guildId: string; isManager: boolean; transcriptsEnabled: boolean }) {
  const [rows, setRows] = useState<Array<{ id: string; channel_id: string; user_tag: string | null; user_id: string; category_label: string | null; created_at: string; source?: string | null; web_ticket_id?: string | null }>>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("bot_open_tickets" as any)
      .select("id, channel_id, user_tag, user_id, category_label, created_at, source, web_ticket_id")
      .eq("guild_id", guildId)
      .order("created_at", { ascending: false });
    if (!error) setRows((data as any) || []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`bot-open-tickets-${guildId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bot_open_tickets", filter: `guild_id=eq.${guildId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  const act = async (row: typeof rows[number], action: "close_ticket" | "delete_ticket") => {
    if (!isManager) return;
    setBusy(row.id);
    try {
      const { error } = await supabase.from("bot_outbound_queue").insert({
        source: "ticket_dashboard",
        channel_id: row.channel_id,
        payload: {
          action,
          channel_id: row.channel_id,
          transcripts_enabled: action === "close_ticket" ? transcriptsEnabled : false,
          notice: action === "close_ticket" ? "🔒 Ticket uzavřen ze správce bota." : undefined,
        },
      });
      if (error) throw error;
      toast({ title: action === "close_ticket" ? "Zavírám ticket" : "Mažu ticket", description: "Bot ho během chvilky zpracuje." });
      setRows((r) => r.filter((x) => x.id !== row.id));
    } catch (e: any) {
      toast({ title: "Chyba", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="glass border-border p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold">Otevřené tickety</h3>
          <p className="text-xs text-muted-foreground">Aktuálně otevřené ticket kanály na tomto serveru.</p>
        </div>
        <Button size="sm" variant="outline" onClick={load}>Obnovit</Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Žádné otevřené tickety.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const isWeb = r.source === "web";
            return (
              <li key={r.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border ${isWeb ? "border-primary/50 text-primary" : "border-accent/50 text-accent"}`}>
                      {isWeb ? "Web" : "Discord"}
                    </span>
                    <span className="truncate">{r.user_tag || r.user_id}{r.category_label ? ` · ${r.category_label}` : ""}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <code>#{r.channel_id}</code> · {new Date(r.created_at).toLocaleString()}
                    {isWeb && r.web_ticket_id && (
                      <> · <Link to={`/tickets/${r.web_ticket_id}`} className="text-primary hover:underline">otevřít na webu</Link></>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={!isManager || busy === r.id} onClick={() => act(r, "close_ticket")}>
                    🔒 Uzavřít
                  </Button>
                  <Button size="sm" variant="destructive" disabled={!isManager || busy === r.id} onClick={() => act(r, "delete_ticket")}>
                    <Trash2 className="h-4 w-4 mr-1" /> Smazat
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
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
