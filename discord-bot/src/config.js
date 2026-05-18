import { supabase } from './supabase.js';

let globalCache = null;
let globalCachedAt = 0;
const guildCache = new Map(); // guild_id -> { data, ts }
const TTL = 30_000;

export async function getGlobalConfig() {
  if (globalCache && Date.now() - globalCachedAt < TTL) return globalCache;
  const { data } = await supabase.from('bot_config').select('*').limit(1).maybeSingle();
  globalCache = data ?? {};
  globalCachedAt = Date.now();
  return globalCache;
}

export async function getGuildConfig(guildId) {
  if (!guildId) return getGlobalConfig();
  const cached = guildCache.get(guildId);
  if (cached && Date.now() - cached.ts < TTL) return cached.data;
  const { data } = await supabase
    .from('bot_guild_config')
    .select('*')
    .eq('guild_id', guildId)
    .maybeSingle();
  const global = await getGlobalConfig();
  // Merge: guild overrides global; null/empty falls back
  const merged = { ...global, ...(data || {}) };
  if (!merged.prefix) merged.prefix = global.prefix || '!';
  guildCache.set(guildId, { data: merged, ts: Date.now() });
  return merged;
}

// Backwards-compatible alias used by existing handlers without a guild context
export async function getConfig(guildId = null) {
  return guildId ? getGuildConfig(guildId) : getGlobalConfig();
}

export function invalidateConfig(guildId) {
  if (guildId) guildCache.delete(guildId);
  else {
    globalCache = null;
    guildCache.clear();
  }
}
