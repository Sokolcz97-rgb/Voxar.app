// Calls the Supabase edge function `translate-message` which uses Lovable AI.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
