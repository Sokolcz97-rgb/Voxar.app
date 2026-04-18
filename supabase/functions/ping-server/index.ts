// Pings game servers and updates is_online, players_online, players_max, last_pinged_at.
// Supports: Minecraft (SLP), Source engine (A2S_INFO for CS, Rust, Garry's Mod, etc.),
// and falls back to plain TCP connect for unknown games.
// Triggered by cron or manually with { server_id?: string } body.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PingResult = { online: boolean; players?: number; max?: number };

// ---------- helpers ----------
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function readN(conn: Deno.Conn, n: number, timeoutMs = 3000): Promise<Uint8Array> {
  const buf = new Uint8Array(n);
  let read = 0;
  const start = Date.now();
  while (read < n) {
    if (Date.now() - start > timeoutMs) throw new Error('read timeout');
    const chunk = new Uint8Array(n - read);
    const got = await conn.read(chunk);
    if (got === null) break;
    buf.set(chunk.subarray(0, got), read);
    read += got;
  }
  return buf.subarray(0, read);
}

// ---------- Minecraft Server List Ping (modern handshake) ----------
function writeVarInt(value: number): Uint8Array {
  const bytes: number[] = [];
  let v = value >>> 0;
  while (true) {
    if ((v & ~0x7f) === 0) { bytes.push(v); break; }
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  return new Uint8Array(bytes);
}

async function readVarInt(conn: Deno.Conn): Promise<number> {
  let numRead = 0;
  let result = 0;
  while (true) {
    const b = await readN(conn, 1);
    if (b.length === 0) throw new Error('eof');
    const value = b[0] & 0x7f;
    result |= value << (7 * numRead);
    numRead++;
    if (numRead > 5) throw new Error('VarInt too big');
    if ((b[0] & 0x80) === 0) break;
  }
  return result;
}

async function pingMinecraft(host: string, port: number): Promise<PingResult> {
  const conn = await withTimeout(
    Deno.connect({ hostname: host, port, transport: 'tcp' }),
    3000,
  );
  try {
    const hostBytes = new TextEncoder().encode(host);
    const handshake: number[] = [];
    handshake.push(0x00); // packet id
    handshake.push(...writeVarInt(-1)); // protocol version (any)
    handshake.push(...writeVarInt(hostBytes.length));
    handshake.push(...hostBytes);
    handshake.push((port >> 8) & 0xff, port & 0xff);
    handshake.push(...writeVarInt(1)); // next state: status

    const handshakePacket = new Uint8Array([
      ...writeVarInt(handshake.length),
      ...handshake,
    ]);
    await conn.write(handshakePacket);

    // status request
    await conn.write(new Uint8Array([0x01, 0x00]));

    // response: VarInt length, VarInt packet id (0x00), VarInt json length, json
    await readVarInt(conn); // packet length
    const pid = await readVarInt(conn);
    if (pid !== 0x00) throw new Error('bad packet id');
    const jsonLen = await readVarInt(conn);
    const jsonBytes = await readN(conn, jsonLen, 4000);
    const json = JSON.parse(new TextDecoder().decode(jsonBytes));
    return {
      online: true,
      players: json?.players?.online ?? undefined,
      max: json?.players?.max ?? undefined,
    };
  } finally {
    try { conn.close(); } catch { /* ignore */ }
  }
}

// ---------- Source engine A2S_INFO (UDP) ----------
async function pingSource(host: string, port: number): Promise<PingResult> {
  // Header: FF FF FF FF 54 "Source Engine Query\0"
  const payload = new Uint8Array([
    0xff, 0xff, 0xff, 0xff, 0x54,
    ...new TextEncoder().encode('Source Engine Query'),
    0x00,
  ]);

  // Resolve hostname -> IP for UDP (Deno UDP needs IP)
  let ip = host;
  try {
    const records = await Deno.resolveDns(host, 'A');
    if (records.length > 0) ip = records[0];
  } catch {
    // assume already an IP
  }

  const sock = Deno.listenDatagram({ transport: 'udp', hostname: '0.0.0.0', port: 0 });
  try {
    const addr: Deno.NetAddr = { transport: 'udp', hostname: ip, port };
    await sock.send(payload, addr);

    let data: Uint8Array;
    [data] = await withTimeout(sock.receive(), 3000);

    // Handle challenge response (since 2020): -1 -1 -1 -1 41 + 4 bytes challenge
    if (data.length >= 5 && data[4] === 0x41) {
      const challenge = data.subarray(5, 9);
      const retry = new Uint8Array(payload.length + challenge.length);
      retry.set(payload, 0);
      retry.set(challenge, payload.length);
      await sock.send(retry, addr);
      [data] = await withTimeout(sock.receive(), 3000);
    }

    // Parse A2S_INFO response
    // Skip 4 bytes (FFFFFFFF) + 1 byte header (0x49) + 1 byte protocol
    if (data.length < 6 || data[4] !== 0x49) throw new Error('bad source reply');
    let i = 6;
    // name (cstring)
    while (i < data.length && data[i] !== 0) i++; i++;
    // map (cstring)
    while (i < data.length && data[i] !== 0) i++; i++;
    // folder (cstring)
    while (i < data.length && data[i] !== 0) i++; i++;
    // game (cstring)
    while (i < data.length && data[i] !== 0) i++; i++;
    // appid (short, 2 bytes)
    i += 2;
    if (i + 2 > data.length) throw new Error('truncated');
    const players = data[i]; i++;
    const max = data[i]; i++;
    return { online: true, players, max };
  } finally {
    try { sock.close(); } catch { /* ignore */ }
  }
}

// ---------- Plain TCP fallback ----------
async function tcpPing(host: string, port: number): Promise<PingResult> {
  try {
    const conn = await withTimeout(
      Deno.connect({ hostname: host, port, transport: 'tcp' }),
      3000,
    );
    try { conn.close(); } catch { /* ignore */ }
    return { online: true };
  } catch {
    return { online: false };
  }
}

async function queryServer(gameSlug: string, host: string, port: number): Promise<PingResult> {
  const slug = (gameSlug || '').toLowerCase();
  try {
    if (slug.includes('minecraft') || slug === 'mc') {
      return await pingMinecraft(host, port);
    }
    // Source engine games
    if (
      slug.includes('cs') || slug.includes('counter') ||
      slug.includes('rust') || slug.includes('gmod') ||
      slug.includes('garry') || slug.includes('tf2') ||
      slug.includes('source') || slug.includes('valheim') ||
      slug.includes('ark') || slug.includes('squad') ||
      slug.includes('arma')
    ) {
      return await pingSource(host, port);
    }
    // Unknown — try TCP
    return await tcpPing(host, port);
  } catch {
    return { online: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let body: { server_id?: string } = {};
    try { body = await req.json(); } catch { /* no body */ }

    let query = supabase
      .from('servers')
      .select('id, ip, port, game_id, games!inner(slug, connection_type)')
      .eq('games.connection_type', 'ip_port')
      .not('ip', 'is', null)
      .not('port', 'is', null);

    if (body.server_id) query = query.eq('id', body.server_id);

    const { data: servers, error } = await query;
    if (error) throw error;

    const results = await Promise.all(
      (servers ?? []).map(async (s: any) => {
        const slug = s.games?.slug ?? '';
        const res = await queryServer(slug, s.ip, s.port);
        const update: Record<string, unknown> = {
          is_online: res.online,
          last_pinged_at: new Date().toISOString(),
        };
        if (res.players !== undefined) update.players_online = res.players;
        if (res.max !== undefined) update.players_max = res.max;
        // If offline, zero out current players (keep max as configured)
        if (!res.online) update.players_online = 0;

        await supabase.from('servers').update(update).eq('id', s.id);
        return { id: s.id, ...res };
      })
    );

    return new Response(JSON.stringify({ checked: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
