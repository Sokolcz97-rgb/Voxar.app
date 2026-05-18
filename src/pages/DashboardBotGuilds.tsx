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
  notes: string | null;
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
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());


  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("bot_guilds")
      .select("*")
      .order("requested_at", { ascending: false });
    if (error) toast.error(error.message);
    setGuilds((data as BotGuild[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    (async () => {
      const { data } = await supabase.rpc("can", {
        _module: "bot",
        _action: "manage",
      });
      setCanManage(Boolean(data));
    })();
  }, []);

  // Handle returning from Discord OAuth: ?discord_session=NONCE
  useEffect(() => {
    const ds = searchParams.get("discord_session");
    if (!ds || !user) return;
    (async () => {
      const { data, error } = await supabase.functions.invoke("discord-oauth-result", {
        body: { state: ds },
      });
      if (error || !data) {
        toast.error("Nepodařilo se načíst seznam serverů z Discordu.");
      } else {
        setPickerGuilds((data as any).guilds || []);
        setDiscordUsername((data as any).discord_username || null);
        setDiscordUserId((data as any).discord_user_id || null);
        setPickerOpen(true);
      }
      // Strip the query param
      const next = new URLSearchParams(searchParams);
      next.delete("discord_session");
      setSearchParams(next, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams.get("discord_session")]);

  const startDiscordOAuth = async () => {
    setOauthLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("discord-oauth-start", {
        body: { origin: window.location.origin },
      });
      if (error || !data?.url) {
        toast.error("Nepodařilo se spustit přihlášení přes Discord.");
        return;
      }
      window.location.href = (data as any).url;
    } finally {
      setOauthLoading(false);
    }
  };

  const requestGuild = async (g: DiscordGuildOption) => {
    setSubmittingIds((s) => new Set(s).add(g.id));
    try {
      // Skip if already registered
      const existing = guilds.find((x) => x.guild_id === g.id);
      if (existing) {
        toast.info(`${g.name}: již registrováno (${statusLabel[existing.status]})`);
        return;
      }
      const { error } = await supabase.from("bot_guilds").insert({
        guild_id: g.id,
        name: g.name,
        icon_url: g.icon_url,
        owner_user_id: user?.id ?? null,
        owner_discord_id: discordUserId,
        source: "request",
        status: "pending",
        member_count: g.approximate_member_count,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(`${g.name} odeslán ke schválení`);
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
        reviewed_by: user?.id ?? null,
        ...(notes !== undefined ? { notes } : {}),
      })
      .eq("id", g.id);
    if (error) return toast.error(error.message);
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

  const filtered = filter === "all" ? guilds : guilds.filter((g) => g.status === filter);
  const counts = {
    all: guilds.length,
    pending: guilds.filter((g) => g.status === "pending").length,
    approved: guilds.filter((g) => g.status === "approved").length,
    rejected: guilds.filter((g) => g.status === "rejected").length,
    suspended: guilds.filter((g) => g.status === "suspended").length,
  };

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
            <Button onClick={startDiscordOAuth} disabled={oauthLoading} variant="default">
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
            <CardTitle>Registrované servery</CardTitle>
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
                      <img src={g.icon_url} alt="" className="w-10 h-10 rounded-full" />
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
                    {existing ? (
                      <Badge variant={statusVariant[existing.status] as any}>
                        {statusLabel[existing.status]}
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => requestGuild(g)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Požádat o přidání"
                        )}
                      </Button>
                    )}
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
          <img src={guild.icon_url} alt="" className="w-10 h-10 rounded-full" />
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
