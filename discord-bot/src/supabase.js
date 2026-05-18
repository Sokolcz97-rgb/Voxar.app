import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

function cleanEnvValue(name) {
  let value = (process.env[name] || '').trim();
  if (value.startsWith(`${name}=`)) value = value.slice(name.length + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

const url = cleanEnvValue('SUPABASE_URL');
const key = cleanEnvValue('SUPABASE_SERVICE_ROLE_KEY');

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function getJwtPayload(jwt) {
  try {
    const [, payload] = jwt.split('.');
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export async function verifySupabaseConnection() {
  const payload = getJwtPayload(key);

  if (payload?.role && payload.role !== 'service_role') {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY má roli "${payload.role}". Pro Railway bota musí být použitý service_role key, ne anon/publishable key.`
    );
  }

  const { error } = await supabase.from('bot_status').select('id').limit(1);

  if (error?.message?.toLowerCase().includes('invalid api key')) {
    const projectRef = payload?.ref ? ` pro projekt "${payload.ref}"` : '';
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY není platný${projectRef}. V Railway smaž hodnotu proměnné a vlož znovu čistý service_role key ze stejného backend projektu – bez uvozovek, bez názvu proměnné a bez mezer.`
    );
  }

  if (error) {
    throw new Error(`Backend credentials prošly, ale kontrolní dotaz selhal: ${error.message}`);
  }

  console.log('✅ Backend credentials OK');
}
