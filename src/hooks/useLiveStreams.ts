import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LiveStream = {
  id: string;
  user_id: string;
  platform: "twitch" | "youtube" | "kick";
  handle: string;
  is_live: boolean;
  title: string | null;
  game_name: string | null;
  viewer_count: number;
  thumbnail_url: string | null;
  stream_url: string;
  started_at: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

export function useLiveStreams() {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from("live_streams_cache")
      .select("*")
      .eq("is_live", true)
      .order("viewer_count", { ascending: false });

    const rows = (data ?? []) as LiveStream[];
    if (rows.length) {
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", ids);
      const byId = new Map(
        (profs ?? []).map((p: any) => [
          p.user_id,
          { display_name: p.display_name ?? p.username, avatar_url: p.avatar_url },
        ]),
      );
      rows.forEach((r) => {
        const p = byId.get(r.user_id);
        if (p) {
          r.display_name = p.display_name;
          r.avatar_url = p.avatar_url;
        }
      });
    }
    setStreams(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Trigger a fresh check on mount (rate-limited via sessionStorage)
    const lastTrigger = Number(sessionStorage.getItem("lsc_last_trigger") ?? 0);
    if (Date.now() - lastTrigger > 60_000) {
      sessionStorage.setItem("lsc_last_trigger", String(Date.now()));
      supabase.functions
        .invoke("check-live-streams")
        .then(() => load())
        .catch((e) => console.warn("check-live-streams trigger failed", e));
    }
    const channel = supabase
      .channel("live_streams_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_streams_cache" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { streams, loading, refresh: load };
}
