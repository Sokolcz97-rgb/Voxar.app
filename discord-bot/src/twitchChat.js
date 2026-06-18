import tmi from 'tmi.js';
import { supabase } from './supabase.js';
import { evaluateMessage } from './streamAutomod.js';

const cooldowns = new Map(); // channel|trigger -> ts
const joinedChannels = new Set();
let client = null;
let pollTimer = null;

function envClean(name) {
  let v = (process.env[name] || '').trim();
  if (v.startsWith(`${name}=`)) v = v.slice(name.length + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

async function loadChannels() {
  const { data, error } = await supabase
    .from('chat_bot_channels')
    .select('*, automod:chat_bot_automod(*), commands:chat_bot_commands(*)')
    .eq('platform', 'twitch')
    .eq('enabled', true);
  if (error) {
    console.error('twitch loadChannels', error.message);
    return [];
  }
  return data || [];
}

async function logAction(row) {
  try {
    await supabase.from('chat_bot_log').insert(row);
  } catch (e) {
    console.error('chat_bot_log insert', e?.message);
  }
}

async function reconcile() {
  if (!client) return;
  const channels = await loadChannels();
  const wanted = new Set(channels.map((c) => c.handle.toLowerCase()));
  // Join new
  for (const c of channels) {
    const h = c.handle.toLowerCase();
    if (!joinedChannels.has(h)) {
      try {
        await client.join(h);
        joinedChannels.add(h);
        console.log(`🟣 Twitch: joined #${h}`);
        await supabase
          .from('chat_bot_channels')
          .update({ last_connected_at: new Date().toISOString(), last_status: 'connected' })
          .eq('id', c.id);
      } catch (e) {
        console.error(`twitch join #${h} failed`, e?.message || e);
        await supabase
          .from('chat_bot_channels')
          .update({ last_status: `error: ${(e?.message || 'join failed').slice(0, 100)}` })
          .eq('id', c.id);
      }
    }
  }
  // Part removed
  for (const h of Array.from(joinedChannels)) {
    if (!wanted.has(h)) {
      await client.part(h).catch(() => {});
      joinedChannels.delete(h);
      console.log(`🟣 Twitch: parted #${h}`);
    }
  }
}

async function findChannelByHandle(handle) {
  const { data } = await supabase
    .from('chat_bot_channels')
    .select('*, automod:chat_bot_automod(*), commands:chat_bot_commands(*)')
    .eq('platform', 'twitch')
    .eq('handle', handle.toLowerCase())
    .maybeSingle();
  return data;
}

function renderResponse(text, ctx) {
  return (text || '')
    .replaceAll('{user}', ctx.user || '')
    .replaceAll('{username}', ctx.user || '')
    .replaceAll('{channel}', ctx.channel || '')
    .replaceAll('{game}', ctx.game || '');
}

const greeted = new Map(); // channel -> Set(userId) (resets daily)
function shouldGreet(channel, userId) {
  let set = greeted.get(channel);
  if (!set) { set = new Set(); greeted.set(channel, set); }
  if (set.has(userId)) return false;
  set.add(userId);
  return true;
}
// Reset greetings every 12h
setInterval(() => greeted.clear(), 12 * 60 * 60 * 1000).unref?.();

export async function startTwitchChat() {
  const username = envClean('TWITCH_BOT_USERNAME');
  const oauth = envClean('TWITCH_BOT_OAUTH');
  if (!username || !oauth) {
    console.warn('⚠️  Twitch chat bot: chybí TWITCH_BOT_USERNAME / TWITCH_BOT_OAUTH — Twitch modul přeskočen.');
    return;
  }
  const password = oauth.startsWith('oauth:') ? oauth : `oauth:${oauth}`;

  client = new tmi.Client({
    options: { debug: false, skipUpdatingEmotesets: true },
    connection: { secure: true, reconnect: true },
    identity: { username, password },
    channels: [],
  });

  client.on('connected', () => console.log(`🟣 Twitch chat bot připojen jako ${username}`));
  client.on('disconnected', (r) => console.warn('🟣 Twitch disconnected', r));

  client.on('message', async (channel, tags, message, self) => {
    if (self) return;
    const handle = channel.replace(/^#/, '').toLowerCase();
    const row = await findChannelByHandle(handle);
    if (!row || !row.enabled) return;
    const automod = Array.isArray(row.automod) ? row.automod[0] : row.automod;
    const commands = Array.isArray(row.commands) ? row.commands : [];
    const isMod = tags.mod === true || tags.badges?.broadcaster === '1';
    const isSub = tags.subscriber === true || tags.badges?.subscriber !== undefined;
    const userId = tags['user-id'];
    const userName = tags['display-name'] || tags.username;

    // Welcome
    if (row.welcome_enabled && row.welcome_message && shouldGreet(handle, userId || userName)) {
      const text = renderResponse(row.welcome_message, { user: userName, channel: handle });
      client.say(channel, text).catch(() => {});
    }

    // Automod
    if (row.automod_enabled && automod && !isMod) {
      const v = evaluateMessage(automod, message, { isMod, isSub, userId });
      if (v.action !== 'allow') {
        const msgId = tags.id;
        try {
          if (v.action === 'delete' && msgId) {
            await client.deletemessage(channel, msgId);
          } else if (v.action === 'warn') {
            await client.say(channel, `@${userName} ⚠️ ${v.reason}`);
          } else if (v.action === 'timeout') {
            await client.timeout(channel, userName, v.timeoutSeconds || 60, v.reason);
          } else if (v.action === 'ban') {
            await client.ban(channel, userName, v.reason);
          }
        } catch (e) {
          console.error('twitch automod action', e?.message);
        }
        await logAction({
          channel_id: row.id,
          platform: 'twitch',
          viewer_name: userName,
          viewer_id: userId,
          action: v.action,
          reason: v.reason,
          message,
        });
        if (v.action !== 'warn') return;
      }
    }

    // Commands
    const prefix = message.startsWith('!') ? '!' : null;
    if (!prefix) return;
    const trigger = message.slice(1).trim().split(/\s+/)[0]?.toLowerCase();
    if (!trigger) return;
    const cmd = commands.find((c) => c.enabled && c.trigger.toLowerCase() === trigger);
    if (!cmd) return;
    if (cmd.mods_only && !isMod) return;
    const cdKey = `${handle}:${cmd.trigger}`;
    const now = Date.now();
    const last = cooldowns.get(cdKey) || 0;
    if (now - last < (cmd.cooldown_seconds ?? 5) * 1000) return;
    cooldowns.set(cdKey, now);
    try {
      const text = renderResponse(cmd.response, { user: userName, channel: handle });
      await client.say(channel, text);
      await supabase.rpc?.('noop').catch(() => {}); // no-op
      await supabase
        .from('chat_bot_commands')
        .update({ uses: (cmd.uses ?? 0) + 1 })
        .eq('id', cmd.id);
    } catch (e) {
      console.error('twitch command send', e?.message);
    }
  });

  try {
    await client.connect();
  } catch (e) {
    console.error('twitch connect failed', e?.message || e);
    return;
  }

  await reconcile();
  pollTimer = setInterval(reconcile, 60_000);
  pollTimer.unref?.();

  // Realtime channel list updates
  supabase
    .channel('chat-bot-channels-twitch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_bot_channels' }, () => {
      reconcile().catch(() => {});
    })
    .subscribe();
}
