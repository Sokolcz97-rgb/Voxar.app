import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Plus, Trash2, Search, Radio } from "lucide-react";

type Profile = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  twitch_username: string | null;
  youtube_handle: string | null;
  kick_username: string | null;
};

type Override = {
  id: string;
  user_id: string;
  is_included: boolean;
  note: string | null;
};

const AdminStreams = () => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [featuredIds, setFeaturedIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const [{ data: ovs }, { data: feat }] = await Promise.all([
      supabase.from("streamer_overrides").select("*"),
      supabase.rpc("get_featured_streamers"),
    ]);
    setOverrides((ovs ?? []) as Override[]);
    setFeaturedIds(((feat ?? []) as any[]).map((r) => r.user_id));
  };

  useEffect(() => {
    load();
  }, []);

  // Load featured user profiles automatically
  useEffect(() => {
    if (featuredIds.length === 0) return;
    supabase
      .from("profiles")
      .select(
        "user_id, display_name, username, avatar_url, twitch_username, youtube_handle, kick_username",
      )
      .in("user_id", featuredIds)
      .then(({ data }) => {
        if (data) {
          setResults((prev) => {
            const ids = new Set(prev.map((p) => p.user_id));
            const merged = [...prev];
            (data as Profile[]).forEach((p) => {
              if (!ids.has(p.user_id)) merged.push(p);
            });
            return merged;
          });
        }
      });
  }, [featuredIds]);

  const doSearch = async () => {
    if (!search.trim()) {
      load();
      return;
    }
    const q = `%${search.trim()}%`;
    const { data } = await supabase
      .from("profiles")
      .select(
        "user_id, display_name, username, avatar_url, twitch_username, youtube_handle, kick_username",
      )
      .or(
        `display_name.ilike.${q},username.ilike.${q},twitch_username.ilike.${q},youtube_handle.ilike.${q},kick_username.ilike.${q}`,
      )
      .limit(50);
    setResults((data ?? []) as Profile[]);
  };

  const overrideFor = (uid: string) => overrides.find((o) => o.user_id === uid);
  const isFeatured = (uid: string) => featuredIds.includes(uid);

  const include = async (uid: string) => {
    const ov = overrideFor(uid);
    const { error } = ov
      ? await supabase
          .from("streamer_overrides")
          .update({ is_included: true })
          .eq("id", ov.id)
      : await supabase
          .from("streamer_overrides")
          .insert({ user_id: uid, is_included: true });
    if (error) return toast.error(error.message);
    toast.success("Přidán do featured");
    load();
  };

  const exclude = async (uid: string) => {
    const ov = overrideFor(uid);
    const { error } = ov
      ? await supabase
          .from("streamer_overrides")
          .update({ is_included: false })
          .eq("id", ov.id)
      : await supabase
          .from("streamer_overrides")
          .insert({ user_id: uid, is_included: false });
    if (error) return toast.error(error.message);
    toast.success("Vyloučen z featured");
    load();
  };

  const removeOverride = async (uid: string) => {
    const ov = overrideFor(uid);
    if (!ov) return;
    const { error } = await supabase
      .from("streamer_overrides")
      .delete()
      .eq("id", ov.id);
    if (error) return toast.error(error.message);
    toast.success("Override odstraněno");
    load();
  };

  const refreshNow = async () => {
    setRefreshing(true);
    toast.info("Kontroluji live status…");
    const { data, error } = await supabase.functions.invoke(
      "check-live-streams",
    );
    setRefreshing(false);
    if (error) return toast.error(error.message);
    toast.success(
      `Hotovo: ${data?.live ?? 0} online z ${data?.checked ?? 0} kontrolovaných`,
    );
  };

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">
              Administrace
            </p>
            <h1 className="font-display font-black text-4xl md:text-5xl mt-2">
              Streamy
            </h1>
            <p className="text-muted-foreground mt-2 max-w-xl">
              Spravuj featured streamery. Uživatelé s rolí mající oprávnění{" "}
              <code className="text-xs">streams.featured</code> jsou zařazeni
              automaticky. Zde můžeš ručně přidat/vyloučit konkrétní uživatele.
            </p>
          </div>
          <Button
            onClick={refreshNow}
            disabled={refreshing}
            className="bg-primary text-primary-foreground hover:bg-primary-glow"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Kontroluji…" : "Refresh live status"}
          </Button>
        </div>

        <div className="flex gap-2 mb-6 max-w-md">
          <Input
            placeholder="Hledat uživatele nebo handle…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
          />
          <Button variant="outline" onClick={doSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {results.length === 0 ? (
          <Card className="glass border-border p-10 text-center text-muted-foreground">
            Žádní uživatelé. Vyhledej někoho podle jména nebo handle.
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((p) => {
              const ov = overrideFor(p.user_id);
              const featured = isFeatured(p.user_id);
              return (
                <Card key={p.user_id} className="glass border-border p-5">
                  <div className="flex items-start gap-3 mb-3">
                    {p.avatar_url ? (
                      <img loading="lazy" decoding="async"
                        src={p.avatar_url}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center font-bold text-primary">
                        {(p.display_name || p.username || "?")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold truncate">
                        {p.display_name || p.username || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        @{p.username}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {featured && (
                          <Badge className="bg-primary/20 text-primary border-primary/40 gap-1">
                            <Radio className="h-3 w-3" /> Featured
                          </Badge>
                        )}
                        {ov && !ov.is_included && (
                          <Badge variant="outline" className="text-destructive border-destructive/40">
                            Vyloučen
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs mb-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Twitch</span>
                      <span className="font-mono">{p.twitch_username || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">YouTube</span>
                      <span className="font-mono">{p.youtube_handle || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Kick</span>
                      <span className="font-mono">{p.kick_username || "—"}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-border">
                    {!featured ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => include(p.user_id)}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Přidat
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => exclude(p.user_id)}
                      >
                        Vyloučit
                      </Button>
                    )}
                    {ov && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto text-muted-foreground"
                        onClick={() => removeOverride(p.user_id)}
                        title="Smazat override (zpět k roli)"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminStreams;
