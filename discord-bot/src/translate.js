// Calls the Lovable Cloud edge function `translate-message` which uses Lovable AI.
// Hardcoded to the Lovable project's Supabase URL because the bot's own
// SUPABASE_URL env points at a different (bot-only) Supabase project.
const LOVABLE_SUPABASE_URL = 'https://rioexuvgvmdwvidfakxy.supabase.co';
const LOVABLE_PUBLISHABLE_KEY = 'sb_publishable_s0KxdrY9Wm7_j2mtI-PnJg_eYbQln9-';

export async function translateText(text, target) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Supabase env not configured');
  if (!text || !text.trim()) return '';
  const res = await fetch(`${SUPABASE_URL}/functions/v1/translate-message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify({ text, target }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data?.translation || '';
}
