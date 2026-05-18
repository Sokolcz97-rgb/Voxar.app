import { supabase } from './supabase.js';

let cache = null;
let cachedAt = 0;
const TTL = 30_000; // 30s cache

export async function getConfig() {
  if (cache && Date.now() - cachedAt < TTL) return cache;
  const { data, error } = await supabase
    .from('bot_config')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('getConfig error', error);
    return cache ?? {};
  }
  cache = data ?? {};
  cachedAt = Date.now();
  return cache;
}

export function invalidateConfig() {
  cache = null;
}
