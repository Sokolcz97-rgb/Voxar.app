import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CosmeticStyle {
  id: string;
  name: string;
  description: string | null;
  image_url: string;
  storage_path: string | null;
  scale: number;
  sort_order: number;
  active: boolean;
}

let cache: CosmeticStyle[] | null = null;
let inflight: Promise<CosmeticStyle[]> | null = null;
const listeners = new Set<(s: CosmeticStyle[]) => void>();

async function fetchStyles(): Promise<CosmeticStyle[]> {
  const { data } = await supabase
    .from("cosmetic_styles")
    .select("id,name,description,image_url,storage_path,scale,sort_order,active")
    .order("sort_order")
    .order("name");
  cache = ((data ?? []) as CosmeticStyle[]).map((s) => ({ ...s, scale: Number(s.scale) }));
  listeners.forEach((l) => l(cache!));
  return cache;
}

export async function refreshCosmeticStyles() {
  inflight = fetchStyles();
  return await inflight;
}

export function getCachedCosmeticStyle(id?: string | null) {
  if (!id || !cache) return null;
  return cache.find((s) => s.id === id) ?? null;
}

export function useCosmeticStyles() {
  const [styles, setStyles] = useState<CosmeticStyle[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    listeners.add(setStyles);
    if (!cache) {
      if (!inflight) inflight = fetchStyles();
      void inflight.then(() => setLoading(false));
    }
    return () => {
      listeners.delete(setStyles);
    };
  }, []);

  return { styles, loading, refresh: refreshCosmeticStyles };
}

/** Single style lookup that loads the catalogue on demand. */
export function useCosmeticStyle(id?: string | null) {
  const { styles } = useCosmeticStyles();
  if (!id) return null;
  return styles.find((s) => s.id === id) ?? null;
}
