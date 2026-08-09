import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Check, X, Pause, Play, Trash2, Plus, LogIn, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { InviteBotButton } from "@/components/InviteBotButton";

interface DiscordGuildOption {
  id: string;
  name: string;
  icon_url: string | null;
  owner: boolean;
  approximate_member_count: number | null;
}



type GuildStatus = "pending" | "approved" | "rejected" | "suspended";

interface BotGuild {
  id: string;
  guild_id: string;
  name: string;
  icon_url: string | null;
  owner_user_id: string | null;
  owner_discord_id: string | null;
  status: GuildStatus;
  source: string;
  requested_at: string;
  reviewed_at: string | null;
  notes?: string | null;
  member_count: number | null;
}

const statusVariant: Record<GuildStatus, string> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  suspended: "outline",
};

const statusLabel: Record<GuildStatus, string> = {
  pending: "Čeká na schválení",
  approved: "Schváleno",
  rejected: "Zamítnuto",
  suspended: "Pozastaveno",
};

export default function DashboardBotGuilds() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [guilds, setGuilds] = useState<BotGuild[]>([]);
  const [filter, setFilter] = useState<GuildStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newGuildId, setNewGuildId] = useState("");
  const [newGuildName, setNewGuildName] = useState("");
  const [oauthLoading, setOauthLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerGuilds, setPickerGuilds] = useState<DiscordGuildOption[]>([]);
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [discordUserId, setDiscordUserId] = useState<string | null>(null);
  const [oauthState, setOauthState] = useState<string | null>(null);
  const [myDiscordId, setMyDiscordId] = useState<string | null>(null);
  const [scope, setScope] = useState<"mine" | "foreign">("mine");
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());


  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bot_guilds")
      .select("*")
      .order("requested_at", { ascending: false });
    if (error) toast.error(error.message);
    const rows = (data as any[]) || [];
    // Load staff-only review notes and merge (only visible to bot managers)
    const { data: reviewRows } = await supabase
      .from("bot_guilds_review")
      .select("guild_row_id, notes");
    const notesById = new Map<string, string | null>();
    (reviewRows || []).forEach((r: any) => notesById.set(r.guild_row_id, r.notes));
    const merged: BotGuild[] = rows.map((r) => ({ ...r, notes: notesById.get(r.id) ?? null }));
    setGuilds(merged);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("can", {
        _module: "bot",
        _action: "manage",
      });
      const allowed = Boolean(data);
      setCanManage(allowed);
      if (!allowed) {
        // Page is admin-only — bounce regular users back to bot dashboard.
        toast.error("Tato stránka je dostupná jen adminům bota.");
        navigate("/dashboard/bot", { replace: true });
        return;
      }
      const { data: did } = await supabase.rpc("current_user_discord_id");
      setMyDiscordId((did as string) || null);
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPickerForNonce = async (nonce: string) => {
    const { data, error } = await supabase.functions.invoke("discord-oauth-result", {
      body: { state: nonce },
    });
    if (error || !data) {
      toast.error("Nepodařilo se načíst seznam serverů z Discordu.");
      return;
    }
    setPickerGuilds((data as any).guilds || []);
    setDiscordUsername((data as any).discord_username || null);
    setDiscordUserId((data as any).discord_user_id || null);
    setOauthState(nonce);
    setPickerOpen(true);
    // Refresh ownership data so the picker can label already-claimed rows.
    void load();
    if ((data as any).discord_user_id) setMyDiscordId((data as any).discord_user_id);
  };

  // Fallback: when popup is blocked and the callback redirected the whole tab back
  // with ?discord_session=NONCE.
  useEffect(() => {
    const ds = searchParams.get("discord_session");
    if (!ds || !user) return;
    void loadPickerForNonce(ds);
    const next = new URLSearchParams(searchParams);
    next.delete("discord_session");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams.get("discord_session")]);

  // Primary path: popup returns to our same-origin completion page, then notifies this tab.
  useEffect(() => {
    const handleNonce = (nonce: string) => {
      setOauthLoading(false);
      void loadPickerForNonce(nonce);
    };

    const handler = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const data = ev.data as any;
      if (!data || data.type !== "discord-oauth-result" || !data.nonce) return;
      handleNonce(data.nonce);
    };

    const storageHandler = (ev: StorageEvent) => {
      if (ev.key !== "discord-oauth-result" || !ev.newValue) return;
      try {
        const data = JSON.parse(ev.newValue);
        if (data?.type === "discord-oauth-result" && data.nonce) handleNonce(data.nonce);
      } catch {
        // Ignore malformed storage payloads.
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("discord-oauth");
      channel.onmessage = (ev) => {
        const data = ev.data as any;
        if (data?.type === "discord-oauth-result" && data.nonce) handleNonce(data.nonce);
      };
    } catch {
      channel = null;
    }

    window.addEventListener("message", handler);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("message", handler);
      window.removeEventListener("storage", storageHandler);
      channel?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startDiscordOAuth = async () => {
    setOauthLoading(true);
    // Otevři popup hned (synchronně po kliknutí), aby ho browser nezablokoval
    const w = 500;
    const h = 800;
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
    const popup = window.open(
      "about:blank",
      "discord-oauth",
      `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`,
    );
    try {
      const { data, error } = await supabase.functions.invoke("discord-oauth-start", {
        body: { origin: window.location.origin },
      });
      if (error || !data?.url) {
        popup?.close();
        setOauthLoading(false);
        toast.error("Nepodařilo se spustit přihlášení přes Discord.");
        return;
      }
      if (popup && !popup.closed) {
        popup.location.href = (data as any).url;
        // Sleduj zavření popupu bez dokončení (uživatel ho zavřel)
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            setOauthLoading(false);
          }
        }, 500);
      } else {
        // Popup zablokován (časté v Lovable preview iframe) — místo top-level
        // navigace (která může selhat cross-origin) otevři nové okno/tab.
        setOauthLoading(false);
        const opened = window.open((data as any).url, "_blank", "noopener=no");
        if (!opened) {
          toast.error("Povol vyskakovací okna pro tento web a zkus to znovu.");
        }
      }
    } catch (e) {
      popup?.close();
      setOauthLoading(false);
      toast.error("Nepodařilo se spustit přihlášení přes Discord.");
    }
  };


  const requestGuild = async (g: DiscordGuildOption) => {
    if (!oauthState) {
      toast.error("Chybí ověřená Discord session — zkus to znovu.");
      return;
    }
    setSubmittingIds((s) => new Set(s).add(g.id));
    try {
      const { data, error } = await supabase.functions.invoke("bot-guild-claim", {
        body: { state: oauthState, guild_id: g.id },
      });
      if (error || (data as any)?.error) {
        toast.error((data as any)?.error || error?.message || "Nepodařilo se převzít server");
        return;
      }
      const existing = guilds.find((x) => x.guild_id === g.id);
      toast.success(
        existing
          ? `${g.name}: vlastnictví převzato a server schválen`
          : `${g.name}: přidáno a schváleno`,
      );
      await load();
    } finally {
      setSubmittingIds((s) => {
        const n = new Set(s);
        n.delete(g.id);
        return n;
      });
    }
  };


  const updateStatus = async (g: BotGuild, status: GuildStatus, notes?: string) => {
    const { error } = await supabase
      .from("bot_guilds")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", g.id);
    if (error) return toast.error(error.message);
    // Store staff-only review meta (notes + reviewer) in the separate protected table
    const { error: reviewErr } = await supabase
      .from("bot_guilds_review")
      .upsert({
        guild_row_id: g.id,
        reviewed_by: user?.id ?? null,
        ...(notes !== undefined ? { notes } : {}),
        updated_at: new Date().toISOString(),
      });
    if (reviewErr) return toast.error(reviewErr.message);
    toast.success(`Stav: ${statusLabel[status]}`);
    load();
  };

  const remove = async (g: BotGuild) => {
    if (!confirm(`Smazat registraci ${g.name}?`)) return;
    const { error } = await supabase.from("bot_guilds").delete().eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success("Smazáno");
    load();
  };

  const addManual = async () => {
    if (!newGuildId.trim() || !newGuildName.trim()) {
      return toast.error("Zadej Guild ID a název");
    }
    const { error } = await supabase.from("bot_guilds").insert({
      guild_id: newGuildId.trim(),
      name: newGuildName.trim(),
      owner_user_id: user?.id ?? null,
      source: "request",
      status: "pending",
    });
    if (error) return toast.error(error.message);
    toast.success("Žádost odeslána ke schválení");
    setAddOpen(false);
    setNewGuildId("");
    setNewGuildName("");
    load();
  };

  const isMine = (g: BotGuild) =>
    (!!user && g.owner_user_id === user.id) ||
    (!!myDiscordId && g.owner_discord_id === myDiscordId);

  const scoped = guilds.filter((g) => (scope === "mine" ? isMine(g) : !isMine(g)));
  const filtered = filter === "all" ? scoped : scoped.filter((g) => g.status === filter);
  const counts = {
    all: scoped.length,
    pending: scoped.filter((g) => g.status === "pending").length,
    approved: scoped.filter((g) => g.status === "approved").length,
    rejected: scoped.filter((g) => g.status === "rejected").length,
    suspended: scoped.filter((g) => g.status === "suspended").length,
  };
  const mineCount = guilds.filter(isMine).length;
  const foreignCount = guilds.length - mineCount;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/bot")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Servery bota</h1>
              <p className="text-muted-foreground text-sm">
                Schvaluj a spravuj Discord servery připojené k botovi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <InviteBotButton variant="default" />
            <Button onClick={startDiscordOAuth} disabled={oauthLoading} variant="outline">
              {oauthLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4 mr-2" />
              )}
              Vybrat z mých Discord serverů
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Ručně přes ID
                </Button>
              </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Žádost o přidání serveru</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Discord Guild ID</label>
                  <Input
                    value={newGuildId}
                    onChange={(e) => setNewGuildId(e.target.value)}
                    placeholder="123456789012345678"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    V Discordu: Zapni Developer Mode → klikni pravým na server → Copy ID
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Název serveru</label>
                  <Input
                    value={newGuildName}
                    onChange={(e) => setNewGuildName(e.target.value)}
                    placeholder="Můj Discord server"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  Zrušit
                </Button>
                <Button onClick={addManual}>Odeslat ke schválení</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>


        <div className="flex gap-2 mb-3 flex-wrap">
          <Button
            variant={scope === "mine" ? "default" : "outline"}
            size="sm"
            onClick={() => setScope("mine")}
          >
            Moje servery ({mineCount})
          </Button>
          {canManage && (
            <Button
              variant={scope === "foreign" ? "default" : "outline"}
              size="sm"
              onClick={() => setScope("foreign")}
            >
              Cizí servery — admin ({foreignCount})
            </Button>
          )}
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {(["all", "pending", "approved", "rejected", "suspended"] as const).map((s) => (
            <Button
              key={s}
              variant={filter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(s)}
            >
              {s === "all" ? "Vše" : statusLabel[s as GuildStatus]} ({counts[s]})
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {scope === "mine" ? "Moje registrované servery" : "Cizí servery (správa adminem)"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Načítání…</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground text-sm">Žádné servery</p>
            ) : (
              <div className="space-y-3">
                {filtered.map((g) => (
                  <GuildRow
                    key={g.id}
                    guild={g}
                    canManage={canManage}
                    isOwner={g.owner_user_id === user?.id}
                    onUpdate={updateStatus}
                    onDelete={remove}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Vyber server{discordUsername ? ` (přihlášen jako ${discordUsername})` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto -mx-6 px-6 space-y-2">
            {pickerGuilds.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">
                Nemáš žádné servery, kde bys byl administrátor nebo vlastník.
              </p>
            ) : (
              pickerGuilds.map((g) => {
                const existing = guilds.find((x) => x.guild_id === g.id);
                const isSubmitting = submittingIds.has(g.id);
                return (
                  <div
                    key={g.id}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                  >
                    {g.icon_url ? (
                      <img loading="lazy" decoding="async" src={g.icon_url} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                        {g.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{g.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {g.owner ? "Vlastník" : "Administrátor"}
                        {g.approximate_member_count != null &&
                          ` · ${g.approximate_member_count} členů`}
                      </div>
                    </div>
                    {(() => {
                      const mine =
                        existing &&
                        ((!!user && existing.owner_user_id === user.id) ||
                          (!!discordUserId && existing.owner_discord_id === discordUserId));
                      if (mine) {
                        return (
                          <Badge variant={statusVariant[existing!.status] as any}>
                            {statusLabel[existing!.status]} · vlastním
                          </Badge>
                        );
                      }
                      const label = existing
                        ? existing.owner_user_id
                          ? "Převzít vlastnictví"
                          : "Přidat & schválit"
                        : "Přidat & schválit";
                      return (
                        <Button
                          size="sm"
                          onClick={() => requestGuild(g)}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
                        </Button>
                      );
                    })()}
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>
              Zavřít
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function GuildRow({
  guild,
  canManage,
  isOwner,
  onUpdate,
  onDelete,
}: {
  guild: BotGuild;
  canManage: boolean;
  isOwner: boolean;
  onUpdate: (g: BotGuild, s: GuildStatus, notes?: string) => void;
  onDelete: (g: BotGuild) => void;
}) {
  const [notes, setNotes] = useState(guild.notes ?? "");
  return (
    <div className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {guild.icon_url ? (
          <img loading="lazy" decoding="async" src={guild.icon_url} alt="" className="w-10 h-10 rounded-full" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
            {guild.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{guild.name}</span>
            <Badge variant={statusVariant[guild.status] as any}>
              {statusLabel[guild.status]}
            </Badge>
            {guild.source === "auto" && (
              <Badge variant="outline" className="text-xs">
                auto
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground font-mono truncate">
            {guild.guild_id}
            {guild.member_count != null && ` · ${guild.member_count} členů`}
          </div>
        </div>
      </div>

      {canManage && (
        <div className="flex items-center gap-2 flex-wrap">
          {guild.status !== "approved" && (
            <Button
              size="sm"
              variant="default"
              onClick={() => onUpdate(guild, "approved", notes)}
            >
              <Check className="h-4 w-4 mr-1" />
              Schválit
            </Button>
          )}
          {guild.status !== "rejected" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUpdate(guild, "rejected", notes)}
            >
              <X className="h-4 w-4 mr-1" />
              Zamítnout
            </Button>
          )}
          {guild.status === "approved" && (
            <Button size="sm" variant="outline" onClick={() => onUpdate(guild, "suspended")}>
              <Pause className="h-4 w-4 mr-1" />
              Pozastavit
            </Button>
          )}
          {guild.status === "suspended" && (
            <Button size="sm" variant="outline" onClick={() => onUpdate(guild, "approved")}>
              <Play className="h-4 w-4 mr-1" />
              Obnovit
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onDelete(guild)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
      {!canManage && isOwner && guild.status === "pending" && (
        <span className="text-xs text-muted-foreground">Čeká na admina</span>
      )}
    </div>
  );
}
