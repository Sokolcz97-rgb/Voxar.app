import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Server as ServerIcon, Copy, Check, Globe, Wifi, WifiOff, Trash2, Pencil, MessageCircle, ExternalLink } from "lucide-react";
import { ServerFormDialog } from "@/components/servers/ServerFormDialog";
import { useAllDiscord } from "@/hooks/useFeaturedDiscord";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";

type Game = {
  id: string;
  slug: string;
  name: string;
  icon_url: string | null;
  connection_type: "ip_port" | "invite_code";
};

type Server = {
  id: string;
  game_id: string;
  owner_id: string;
  name: string;
  description: string | null;
  ip: string | null;
  port: number | null;
  invite_code: string | null;
  website_url: string | null;
  discord_url: string | null;
  is_online: boolean;
  players_online: number | null;
  players_max: number | null;
  is_approved: boolean;
};

const Servers = () => {
  const { t } = useTranslation();
  const { user, isAdmin, isEditor, roles } = useAuth();
  const isCC = roles.includes("content_creator");
  const canAdd = isAdmin || isEditor || isCC;
  const { discords } = useAllDiscord();

  const [games, setGames] = useState<Game[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [activeGame, setActiveGame] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Server | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    const { data: g } = await supabase
      .from("games")
      .select("id, slug, name, icon_url, connection_type")
      .eq("is_active", true)
      .order("position");
    setGames((g ?? []) as Game[]);
    const { data: s } = await supabase
      .from("servers")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("is_online", { ascending: false })
      .order("created_at", { ascending: false });
    setServers((s ?? []) as Server[]);
  };

  useEffect(() => {
    (async () => {
      await load();
      // Refresh live status + player counts on page load (fire & forget, then reload).
      try {
        await supabase.functions.invoke("ping-server", { body: {} });
        await load();
      } catch {
        /* ignore — UI shows last known status */
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return servers.filter((s) => {
      if (activeGame !== "all" && s.game_id !== activeGame) return false;
      if (search && !`${s.name} ${s.description ?? ""}`.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [servers, activeGame, search]);

  const gameById = (id: string) => games.find((g) => g.id === id);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success(t("servers.copied"));
    setTimeout(() => setCopied(null), 1500);
  };

  const handleDelete = async (s: Server) => {
    if (!confirm(t("servers.confirmDelete", { name: s.name }))) return;
    const { error } = await supabase.from("servers").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success(t("servers.deleted"));
    load();
  };

  const pingNow = async (id: string) => {
    toast.info(t("servers.pinging"));
    const { error } = await supabase.functions.invoke("ping-server", {
      body: { server_id: id },
    });
    if (error) return toast.error(error.message);
    await load();
    toast.success(t("servers.statusUpdated"));
  };

  return (
    <div className="min-h-screen relative">
      <SEO title={t("servers.seoTitle")} description={t("servers.seoDesc")} />
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        {/* DISCORD SERVERS */}
        {discords.length > 0 && (
          <section className="mb-12">
            <div className="mb-5">
              <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">
                Komunita
              </p>
              <h2 className="font-display font-black text-3xl md:text-4xl mt-2">
                Discord servery
              </h2>
              <p className="text-muted-foreground mt-2 max-w-xl">
                Připoj se k naší komunitě na Discordu.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {discords.map((d) => (
                <a
                  key={d.id}
                  href={d.invite_url}
                  target="_blank"
                  rel="noreferrer"
                  className="glass border border-border rounded-xl p-5 hover:border-[#5865F2]/60 transition-all hover:translate-y-[-2px] group block"
                >
                  <div className="flex items-start gap-3 mb-2">
                    {d.icon_url ? (
                      <img
                        src={d.icon_url}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center">
                        <MessageCircle className="h-5 w-5 text-[#5865F2]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold truncate group-hover:text-[#5865F2] transition-colors">
                        {d.name}
                      </h3>
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> Připojit se
                      </span>
                    </div>
                  </div>
                  {d.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {d.description}
                    </p>
                  )}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* GAME SERVERS */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">Server List</p>
            <h2 className="font-display font-black text-3xl md:text-4xl mt-2">Herní servery</h2>
            <p className="text-muted-foreground mt-2 max-w-xl">
              Vyber si server podle hry. Připoj se přes IP nebo invite kód.
            </p>
          </div>
          {canAdd && (
            <Button
              onClick={() => {
                setEditing(null);
                setOpenForm(true);
              }}
              className="bg-primary text-primary-foreground hover:bg-primary-glow"
            >
              <Plus className="h-4 w-4 mr-1" /> Přidat server
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant={activeGame === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveGame("all")}
          >
            Vše ({servers.length})
          </Button>
          {games.map((g) => {
            const count = servers.filter((s) => s.game_id === g.id).length;
            return (
              <Button
                key={g.id}
                variant={activeGame === g.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveGame(g.id)}
              >
                {g.icon_url && <img src={g.icon_url} alt="" className="h-4 w-4 mr-1 rounded" />}
                {g.name} ({count})
              </Button>
            );
          })}
        </div>

        <Input
          placeholder="Hledat server…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-6 max-w-md"
        />

        {filtered.length === 0 ? (
          <Card className="glass border-border p-10 text-center">
            <ServerIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Žádné servery zde zatím nejsou.</p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((s) => {
              const game = gameById(s.game_id);
              const isOwner = user?.id === s.owner_id;
              const canEdit = isOwner || isAdmin || isEditor;
              const addr =
                game?.connection_type === "ip_port"
                  ? `${s.ip ?? ""}${s.port ? `:${s.port}` : ""}`
                  : s.invite_code ?? "";

              return (
                <Card
                  key={s.id}
                  className="glass border-border p-5 hover:border-primary/60 transition-all hover:translate-y-[-2px] group"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {game?.icon_url ? (
                        <img src={game.icon_url} alt="" className="h-8 w-8 rounded" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-primary/10 border border-primary/30 flex items-center justify-center">
                          <ServerIcon className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-display font-bold truncate">{s.name}</h3>
                        <p className="text-xs text-muted-foreground">{game?.name}</p>
                      </div>
                    </div>
                    {game?.connection_type === "ip_port" ? (
                      s.is_online ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/40 gap-1">
                          <Wifi className="h-3 w-3" /> Online
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground gap-1">
                          <WifiOff className="h-3 w-3" /> Offline
                        </Badge>
                      )
                    ) : (
                      <Badge variant="outline" className="text-primary border-primary/40">
                        Invite
                      </Badge>
                    )}
                  </div>

                  {s.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{s.description}</p>
                  )}

                  {addr && (
                    <button
                      onClick={() => copy(addr, s.id)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-background/60 border border-border hover:border-primary/50 transition font-mono text-sm"
                    >
                      <span className="truncate">{addr}</span>
                      {copied === s.id ? (
                        <Check className="h-4 w-4 text-green-400 shrink-0" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </button>
                  )}

                  {(s.players_online != null || s.website_url || s.discord_url) && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {s.players_online != null && (
                        <span>
                          👥 {s.players_online}
                          {s.players_max ? `/${s.players_max}` : ""}
                        </span>
                      )}
                      {s.website_url && (
                        <a
                          href={s.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-primary inline-flex items-center gap-1"
                        >
                          <Globe className="h-3 w-3" /> Web
                        </a>
                      )}
                      {s.discord_url && (
                        <a
                          href={s.discord_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-primary"
                        >
                          Discord
                        </a>
                      )}
                    </div>
                  )}

                  {canEdit && (
                    <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                      {game?.connection_type === "ip_port" && (
                        <Button size="sm" variant="ghost" onClick={() => pingNow(s.id)}>
                          Ping
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(s);
                          setOpenForm(true);
                        }}
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Upravit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive ml-auto"
                        onClick={() => handleDelete(s)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <ServerFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        games={games}
        editing={editing}
        onSaved={load}
      />
    </div>
  );
};

export default Servers;
