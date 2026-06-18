import { google } from 'googleapis';
import { supabase } from './supabase.js';
import { evaluateMessage } from './streamAutomod.js';

function envClean(name) {
  let v = (process.env[name] || '').trim();
  if (v.startsWith(`${name}=`)) v = v.slice(name.length + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

const apiKey = envClean('YOUTUBE_API_KEY');
const clientId = envClean('YOUTUBE_BOT_CLIENT_ID');
const clientSecret = envClean('YOUTUBE_BOT_CLIENT_SECRET');
const refreshToken = envClean('YOUTUBE_BOT_REFRESH_TOKEN');

let oauthClient = null;
let youtubeRead = null;   // anon (API key) reads
let youtubeWrite = null;  // OAuth — required to insert & to read live chat reliably
const activeStreams = new Map(); // channelRowId -> { liveChatId, nextPageToken, intervalToken, videoId }
const greeted = new Map(); // channelRowId -> Set(authorChannelId)
setInterval(() => greeted.clear(), 12 * 60 * 60 * 1000).unref?.();

async function loadChannels() {
  const { data, error } = await supabase
    .from('chat_bot_channels')
    .select('*, automod:chat_bot_automod(*), commands:chat_bot_commands(*)')
    .eq('platform', 'youtube')
    .eq('enabled', true);
  if (error) {
    console.error('youtube loadChannels', error.message);
    return [];
  }
  return data || [];
}

async function logAction(row) {
  try { await supabase.from('chat_bot_log').insert(row); }
  catch (e) { console.error('chat_bot_log insert', e?.message); }
}

async function resolveChannelId(handle) {
  if (handle.startsWith('UC') && handle.length >= 20) return handle;
  // Try fetching channel page and parsing
  const url = handle.startsWith('http')
    ? handle
    : `https://www.youtube.com/${handle.startsWith('@') ? handle : '@' + handle}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const m = html.match(/"channelId":"(UC[\w-]{20,})"/) ||
              html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{20,})"/);
    return m?.[1] || null;
  } catch (e) {
    console.error('resolveChannelId', handle, e?.message);
    return null;
  }
}

async function findLiveVideoId(channelId) {
  // Use search API – costs quota. Only call when we don't have an active stream.
  try {
    const res = await youtubeRead.search.list({
      part: ['id'],
      channelId,
      eventType: 'live',
      type: ['video'],
      maxResults: 1,
    });
    return res.data.items?.[0]?.id?.videoId || null;
  } catch (e) {
    console.error('search.list', e?.message);
    return null;
  }
}

async function getLiveChatId(videoId) {
  try {
    const res = await youtubeRead.videos.list({
      part: ['liveStreamingDetails'],
      id: [videoId],
    });
    return res.data.items?.[0]?.liveStreamingDetails?.activeLiveChatId || null;
  } catch (e) {
    console.error('videos.list', e?.message);
    return null;
  }
}

async function sendChat(liveChatId, text) {
  if (!youtubeWrite) return;
  try {
    await youtubeWrite.liveChatMessages.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          liveChatId,
          type: 'textMessageEvent',
          textMessageDetails: { messageText: text.slice(0, 200) },
        },
      },
    });
  } catch (e) {
    console.error('liveChatMessages.insert', e?.message);
  }
}

async function deleteChat(messageId) {
  if (!youtubeWrite) return;
  try { await youtubeWrite.liveChatMessages.delete({ id: messageId }); }
  catch (e) { console.error('liveChat delete', e?.message); }
}

async function banUser(liveChatId, channelId, seconds = 0) {
  if (!youtubeWrite) return;
  try {
    await youtubeWrite.liveChatBans.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          liveChatId,
          type: seconds > 0 ? 'temporary' : 'permanent',
          banDurationSeconds: seconds > 0 ? seconds : undefined,
          bannedUserDetails: { channelId },
        },
      },
    });
  } catch (e) {
    console.error('liveChatBans', e?.message);
  }
}

function renderResponse(text, ctx) {
  return (text || '')
    .replaceAll('{user}', ctx.user || '')
    .replaceAll('{username}', ctx.user || '')
    .replaceAll('{channel}', ctx.channel || '')
    .replaceAll('{game}', ctx.game || '');
}

const cooldowns = new Map();

async function pollLiveChat(row) {
  const state = activeStreams.get(row.id);
  if (!state) return;
  let res;
  try {
    res = await (youtubeWrite || youtubeRead).liveChatMessages.list({
      liveChatId: state.liveChatId,
      part: ['snippet', 'authorDetails'],
      pageToken: state.nextPageToken,
      maxResults: 200,
    });
  } catch (e) {
    console.error('liveChatMessages.list', e?.message);
    activeStreams.delete(row.id); // stream skončil
    return;
  }
  state.nextPageToken = res.data.nextPageToken;
  const items = res.data.items || [];
  const automod = Array.isArray(row.automod) ? row.automod[0] : row.automod;
  const commands = Array.isArray(row.commands) ? row.commands : [];

  for (const it of items) {
    const text = it.snippet?.displayMessage || it.snippet?.textMessageDetails?.messageText || '';
    const author = it.authorDetails || {};
    const isMod = author.isChatModerator || author.isChatOwner;
    const isSub = author.isChatSponsor;
    const userName = author.displayName;
    const userId = author.channelId;
    if (!text || !userId) continue;
    if (state.botChannelId && userId === state.botChannelId) continue;

    // Welcome
    if (row.welcome_enabled && row.welcome_message) {
      let set = greeted.get(row.id);
      if (!set) { set = new Set(); greeted.set(row.id, set); }
      if (!set.has(userId)) {
        set.add(userId);
        await sendChat(state.liveChatId, renderResponse(row.welcome_message, { user: userName, channel: row.display_name || row.handle }));
      }
    }

    // Automod
    if (row.automod_enabled && automod && !isMod) {
      const v = evaluateMessage(automod, text, { isMod, isSub, userId });
      if (v.action !== 'allow') {
        try {
          if (v.action === 'delete') await deleteChat(it.id);
          else if (v.action === 'warn') await sendChat(state.liveChatId, `@${userName} ⚠️ ${v.reason}`);
          else if (v.action === 'timeout') await banUser(state.liveChatId, userId, v.timeoutSeconds || 60);
          else if (v.action === 'ban') await banUser(state.liveChatId, userId, 0);
        } catch (e) { console.error('youtube automod action', e?.message); }
        await logAction({
          channel_id: row.id,
          platform: 'youtube',
          viewer_name: userName,
          viewer_id: userId,
          action: v.action,
          reason: v.reason,
          message: text,
        });
        if (v.action !== 'warn') continue;
      }
    }

    // Commands
    if (!text.startsWith('!')) continue;
    const trigger = text.slice(1).trim().split(/\s+/)[0]?.toLowerCase();
    const cmd = commands.find((c) => c.enabled && c.trigger.toLowerCase() === trigger);
    if (!cmd) continue;
    if (cmd.mods_only && !isMod) continue;
    const cdKey = `${row.id}:${cmd.trigger}`;
    const now = Date.now();
    if (now - (cooldowns.get(cdKey) || 0) < (cmd.cooldown_seconds ?? 5) * 1000) continue;
    cooldowns.set(cdKey, now);
    await sendChat(state.liveChatId, renderResponse(cmd.response, { user: userName, channel: row.display_name || row.handle }));
    await supabase.from('chat_bot_commands').update({ uses: (cmd.uses ?? 0) + 1 }).eq('id', cmd.id);
  }

  // Re-schedule using polling interval suggested by API
  const intervalMs = Math.max(parseInt(res.data.pollingIntervalMillis || '10000', 10), 5000);
  state.intervalToken = setTimeout(() => pollLiveChat(row).catch(() => {}), intervalMs);
}

async function reconcile() {
  const channels = await loadChannels();
  const ids = new Set(channels.map((c) => c.id));

  for (const row of channels) {
    if (activeStreams.has(row.id)) continue;

    let channelId = row.channel_id;
    if (!channelId) {
      channelId = await resolveChannelId(row.handle);
      if (channelId) {
        await supabase.from('chat_bot_channels').update({ channel_id: channelId }).eq('id', row.id);
        row.channel_id = channelId;
      }
    }
    if (!channelId) continue;

    const videoId = await findLiveVideoId(channelId);
    if (!videoId) continue;
    const liveChatId = await getLiveChatId(videoId);
    if (!liveChatId) continue;

    // Bot's own channel id (so we don't react to ourselves)
    let botChannelId = null;
    if (youtubeWrite) {
      try {
        const me = await youtubeWrite.channels.list({ part: ['id'], mine: true });
        botChannelId = me.data.items?.[0]?.id || null;
      } catch {}
    }

    activeStreams.set(row.id, { liveChatId, videoId, nextPageToken: undefined, intervalToken: null, botChannelId });
    console.log(`🔴 YouTube: připojeno k live chatu ${row.handle} (video ${videoId})`);
    await supabase.from('chat_bot_channels').update({
      last_connected_at: new Date().toISOString(),
      last_status: 'connected',
    }).eq('id', row.id);
    pollLiveChat(row).catch((e) => console.error('pollLiveChat', e?.message));
  }

  for (const [rowId, state] of activeStreams) {
    if (!ids.has(rowId)) {
      if (state.intervalToken) clearTimeout(state.intervalToken);
      activeStreams.delete(rowId);
    }
  }
}

export async function startYouTubeChat() {
  if (!apiKey) {
    console.warn('⚠️  YouTube chat bot: chybí YOUTUBE_API_KEY — modul přeskočen.');
    return;
  }
  youtubeRead = google.youtube({ version: 'v3', auth: apiKey });

  if (clientId && clientSecret && refreshToken) {
    oauthClient = new google.auth.OAuth2(clientId, clientSecret);
    oauthClient.setCredentials({ refresh_token: refreshToken });
    youtubeWrite = google.youtube({ version: 'v3', auth: oauthClient });
    console.log('🔴 YouTube chat bot: OAuth ready (psaní + moderace povoleno)');
  } else {
    console.warn('⚠️  YouTube chat bot: chybí YOUTUBE_BOT_* OAuth — pouze čtení (žádné posílání/banování).');
  }

  await reconcile().catch((e) => console.error('youtube reconcile', e?.message));
  // Search/list quota: poll new lives only every 5 min
  setInterval(() => reconcile().catch(() => {}), 5 * 60 * 1000).unref?.();

  supabase
    .channel('chat-bot-channels-youtube')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_bot_channels' }, () => {
      reconcile().catch(() => {});
    })
    .subscribe();
}
