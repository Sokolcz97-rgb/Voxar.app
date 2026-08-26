import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePresence } from "@/contexts/PresenceContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/UserAvatar";
import { Radar, Users, Loader2, Send, Gamepad2 } from "lucide-react";
import { toast } from "sonner";

type Game = { id: string; name: string; color_tag: string };
type Match = { user_id: string; display_name: string | null; username: string | null; avatar_url: string | null };

export const LfgWidget = () => {
  const { user } = useAuth();
  const { onlineIds } = usePresence();
  const [open, setOpen] = useState(false);
  const [myGames, setMyGames] = useState<Game[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [sending, setSending] = useState(false);

  const onlineArr = useMemo(() => Array.from(onlineIds), [onlineIds]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_games")
        .select("game_id, games(id,name,color_tag)")
        .eq("user_id", user.id);
      if (cancelled) return;
      const list = (data ?? [])
        .map((r: any) => r.games)
        .filter(Boolean) as Game[];
      setMyGames(list);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const scan = async (gameId: string) => {
    if (!user) return;
    setSelected(gameId);
    setScanning(true);
    setMatches(null);
    const others = onlineArr.filter((id) => id !== user.id);
    if (others.length === 0) {
      setMatches([]);
      setScanning(false);
      return;
    }
    const { data: ug } = await supabase
      .from("user_games")
      .select("user_id")
      .eq("game_id", gameId)
      .in("user_id", others);
    const ids = (ug ?? []).map((r) => r.user_id);
    if (ids.length === 0) {
      setMatches([]);
      setScanning(false);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id,display_name,username,avatar_url")
      .in("user_id", ids);
    setMatches((profs ?? []) as Match[]);
    setScanning(false);
  };

  const broadcast = async () => {
    if (!user || !selected) return;
    setSending(true);
    const { error } = await supabase.from("lfg_requests").insert({ user_id: user.id, game_id: selected });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Výzva vyslána — online hráči s touto hrou dostanou upozornění.");
    setOpen(false);
  };

  const game = myGames.find((g) => g.id === selected);

  return (
    <>
      <Card className="glass border-border p-6 mb-10 relative overflow-hidden">
        <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.3em] text-primary text-glow">Smart LFG</p>
            <h3 className="font-display text-xl font-bold mt-1 flex items-center gap-2">
              <Radar className="h-5 w-5 text-primary" />
              Hledání skupiny
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {myGames.length === 0
                ? "Nemáš zvolené žádné hry — přidej je v profilu (Moje hry)."
                : `${myGames.length} aktivních her · ${onlineArr.length} hráčů online`}
            </p>
            {myGames.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {myGames.map((g) => (
                  <span
                    key={g.id}
                    className="text-[11px] px-2 py-1 border"
                    style={{
                      borderColor: g.color_tag,
                      background: `${g.color_tag}1a`,
                      clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)",
                    }}
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0 flex gap-2">
            {myGames.length === 0 ? (
              <Button asChild size="lg" variant="outline">
                <Link to="/profile"><Gamepad2 className="h-4 w-4 mr-2" />Nastavit hry</Link>
              </Button>
            ) : (
              <Button size="lg" className="shadow-[var(--glow-soft)]" onClick={() => { setOpen(true); setMatches(null); setSelected(null); }}>
                <Radar className="h-4 w-4 mr-2" />
                Najít skupinu
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radar className="h-4 w-4 text-primary" /> Matchmaking terminál
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">
                Co chceš hrát právě teď?
              </p>
              <div className="flex flex-wrap gap-2">
                {myGames.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => scan(g.id)}
                    className="px-3 py-2 text-sm border transition-all"
                    style={{
                      borderColor: selected === g.id ? g.color_tag : "hsl(var(--border))",
                      background: selected === g.id ? `${g.color_tag}26` : "hsl(var(--card) / 0.4)",
                      clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)",
                    }}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>

            {selected && (
              <div className="border border-primary/20 bg-background/40 p-3">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                  <Users className="h-3 w-3" /> Online hráči — {game?.name}
                </p>
                {scanning ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" /> Skenuji síť…
                  </div>
                ) : matches && matches.length > 0 ? (
                  <ul className="space-y-2 max-h-52 overflow-y-auto">
                    {matches.map((m) => {
                      const name = m.display_name || m.username || "Hráč";
                      return (
                        <li key={m.user_id} className="flex items-center gap-3 p-2 border border-border/50 bg-card/40">
                          <UserAvatar url={m.avatar_url} name={name} userId={m.user_id} className="h-8 w-8" />
                          <span className="text-sm font-medium truncate">{name}</span>
                          <Button asChild size="sm" variant="ghost" className="ml-auto">
                            <Link to={`/profile/${m.user_id}`}>Profil</Link>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nikdo online s tímto tagem. Vyšli výzvu — dostanou ji, až budou online.
                  </p>
                )}

                <Button className="w-full mt-4" onClick={broadcast} disabled={sending}>
                  {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Vyslat LFG výzvu
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
