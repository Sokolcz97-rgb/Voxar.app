import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { Radar, X } from "lucide-react";
import { toast } from "sonner";

type Alert = {
  id: string;
  userId: string;
  name: string;
  avatar: string | null;
  gameName: string;
  color: string;
};

export const LfgHud = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alert, setAlert] = useState<Alert | null>(null);
  const myGames = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase.from("user_games").select("game_id").eq("user_id", user.id);
      if (!cancelled) myGames.current = new Set((data ?? []).map((r) => r.game_id));
    })();

    const channel = supabase
      .channel("lfg-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lfg_requests" },
        async (payload) => {
          const row = payload.new as { id: string; user_id: string; game_id: string };
          if (row.user_id === user.id) return;
          if (!myGames.current.has(row.game_id)) return;

          const [{ data: prof }, { data: game }] = await Promise.all([
            supabase.from("profiles").select("display_name,username,avatar_url").eq("user_id", row.user_id).maybeSingle(),
            supabase.from("games").select("name,color_tag").eq("id", row.game_id).maybeSingle(),
          ]);
          if (cancelled) return;
          setAlert({
            id: row.id,
            userId: row.user_id,
            name: prof?.display_name || prof?.username || "Hráč",
            avatar: prof?.avatar_url ?? null,
            gameName: game?.name ?? "hře",
            color: game?.color_tag ?? "#22d3ee",
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (!alert) return null;

  const accept = async () => {
    const target = alert.userId;
    setAlert(null);
    const { data, error } = await supabase.rpc("get_or_create_conversation", { _other_user: target });
    if (error) return toast.error(error.message);
    navigate(`/messages?c=${data}`);
  };

  return (
    <div className="fixed bottom-24 right-4 z-[70] w-[min(92vw,360px)] animate-fade-in">
      <div
        className="relative border bg-background/95 backdrop-blur p-4"
        style={{
          borderColor: alert.color,
          boxShadow: `0 0 32px -12px ${alert.color}`,
          clipPath: "polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)",
        }}
      >
        <button
          onClick={() => setAlert(null)}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
          aria-label="Zavřít"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em]" style={{ color: alert.color }}>
          <Radar className="h-3 w-3" /> LFG signál
        </div>

        <div className="flex items-center gap-3 mt-3">
          <UserAvatar url={alert.avatar} name={alert.name} userId={alert.userId} className="h-10 w-10" />
          <p className="text-sm leading-snug">
            <span className="font-semibold">{alert.name}</span> hledá skupinu ve hře{" "}
            <span className="font-semibold" style={{ color: alert.color }}>{alert.gameName}</span>
          </p>
        </div>

        <div className="flex gap-2 mt-4">
          <Button size="sm" className="flex-1" onClick={accept}>Přijmout</Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => setAlert(null)}>
            Odmítnout
          </Button>
        </div>
      </div>
    </div>
  );
};
