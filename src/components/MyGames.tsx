import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Gamepad2, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Game = { id: string; name: string; color_tag: string; icon_url: string | null };

export const MyGames = () => {
  const { user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: g }, { data: ug }] = await Promise.all([
        supabase.from("games").select("id,name,color_tag,icon_url").eq("is_active", true).order("position"),
        supabase.from("user_games").select("game_id").eq("user_id", user.id),
      ]);
      if (cancelled) return;
      setGames((g ?? []) as Game[]);
      setMine(new Set((ug ?? []).map((r) => r.game_id)));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const toggle = async (id: string) => {
    if (!user) return;
    setBusy(id);
    const has = mine.has(id);
    const res = has
      ? await supabase.from("user_games").delete().eq("user_id", user.id).eq("game_id", id)
      : await supabase.from("user_games").insert({ user_id: user.id, game_id: id });
    setBusy(null);
    if (res.error) return toast.error(res.error.message);
    setMine((prev) => {
      const next = new Set(prev);
      has ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Card className="glass border-border p-6">
      <div className="flex items-center gap-2 mb-1">
        <Gamepad2 className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold">Moje hry</h2>
      </div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
        Vyber hry, které aktivně hraješ — použijí se pro hledání spoluhráčů (LFG)
      </p>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : games.length === 0 ? (
        <p className="text-sm text-muted-foreground">Administrátor zatím nedefinoval žádné hry.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {games.map((g) => {
            const active = mine.has(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggle(g.id)}
                disabled={busy === g.id}
                className="group flex items-center gap-2 px-3 py-2 text-sm border transition-all disabled:opacity-50"
                style={{
                  borderColor: active ? g.color_tag : "hsl(var(--border))",
                  background: active ? `${g.color_tag}1f` : "hsl(var(--card) / 0.4)",
                  boxShadow: active ? `0 0 18px -8px ${g.color_tag}` : undefined,
                  clipPath: "polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)",
                }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: g.color_tag }} />
                <span className={active ? "font-medium" : "text-muted-foreground"}>{g.name}</span>
                {active && <Check className="h-3 w-3" style={{ color: g.color_tag }} />}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
};
