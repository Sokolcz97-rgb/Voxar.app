import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FeaturedDiscord = {
  id: string;
  name: string;
  invite_url: string;
  icon_url: string | null;
  description: string | null;
};

export function useFeaturedDiscord() {
  const [data, setData] = useState<FeaturedDiscord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("discord_servers")
        .select("id, name, invite_url, icon_url, description")
        .eq("is_featured", true)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setData((rows as FeaturedDiscord) ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { discord: data, loading };
}

export function useAllDiscord() {
  const [data, setData] = useState<FeaturedDiscord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("discord_servers")
        .select("id, name, invite_url, icon_url, description")
        .eq("is_active", true)
        .order("is_featured", { ascending: false })
        .order("position");
      if (!cancelled) {
        setData((rows ?? []) as FeaturedDiscord[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { discords: data, loading };
}
