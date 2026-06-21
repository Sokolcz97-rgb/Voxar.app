// Calls the Lovable Cloud edge function `translate-message` (uses Lovable AI).
// Hardcoded to the Lovable project's Supabase URL because the bot's own
// SUPABASE_URL env may point at a different (bot-only) Supabase project.
import 'dotenv/config';

const LOVABLE_SUPABASE_URL = 'https://rioexuvgvmdwvidfakxy.supabase.co';
const LOVABLE_PUBLISHABLE_KEY = 'sb_publishable_s0KxdrY9Wm7_j2mtI-PnJg_eYbQln9-';

function cleanEnvValue(name) {
  let value = (process.env[name] || '').trim();
  if (value.startsWith(`${name}=`)) value = value.slice(name.length + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

// Use service role key (same Lovable project) so the edge function recognises
// us as an internal trusted caller (role: service_role in the JWT).
const SERVICE_ROLE = cleanEnvValue('SUPABASE_SERVICE_ROLE_KEY');

export async function translateText(text, target) {
  if (!text || !text.trim()) return '';
  const authKey = SERVICE_ROLE || LOVABLE_PUBLISHABLE_KEY;
  const res = await fetch(`${LOVABLE_SUPABASE_URL}/functions/v1/translate-message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authKey}`,
      apikey: LOVABLE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ text, target }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data?.translation || '';
}
