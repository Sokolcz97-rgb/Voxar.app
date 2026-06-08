import { getConfig } from './config.js';
import { DEFAULT_BLOCKED_WORDS } from './defaultBlockedWords.js';

const spamTracker = new Map(); // userId → [timestamps]

// Normalizace: lowercase + odstranění diakritiky (aby "piča" == "pica")
function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const DEFAULT_BLOCKED_NORMALIZED = DEFAULT_BLOCKED_WORDS.map(normalize);

export async function runAutomod(message) {
  if (message.author.bot || !message.guild) return false;
  const cfg = await getConfig(message.guild.id);
  if (!cfg.automod_enabled) return false;
  if (cfg.bot_maintenance) return false;

  // Bypass role: žádná penalizace, jen volitelný alert.
  const bypassIds = cfg.bypass_role_ids || [];
  const isBypass = bypassIds.length && message.member?.roles?.cache
    ? bypassIds.some((r) => message.member.roles.cache.has(r))
    : false;

  const content = message.content || '';
  const lower = normalize(content);

  // Blocked words: výchozí (vždy) + uživatelské navíc
  const userBlocked = (cfg.automod_blocked_words || []).map(normalize);
  const blocked = [...DEFAULT_BLOCKED_NORMALIZED, ...userBlocked];
  if (blocked.some((w) => w && lower.includes(w))) {
    return await act(message, cfg, 'Blokované slovo', isBypass);
  }

  // Mentions
  const mentionCount =
    (message.mentions?.users?.size ?? 0) + (message.mentions?.roles?.size ?? 0);
  if (mentionCount > (cfg.automod_max_mentions ?? 5)) {
    return await act(message, cfg, 'Příliš mnoho zmínek', isBypass);
  }

  // Emojis (unicode + custom)
  const emojiCount =
    (content.match(/<a?:\w+:\d+>/g)?.length ?? 0) +
    (content.match(/\p{Extended_Pictographic}/gu)?.length ?? 0);
  if (emojiCount > (cfg.automod_max_emojis ?? 10)) {
    return await act(message, cfg, 'Příliš mnoho emoji', isBypass);
  }

  // Spam: N messages in 5s
  const threshold = cfg.automod_spam_threshold ?? 5;
  const now = Date.now();
  const arr = (spamTracker.get(message.author.id) || []).filter((t) => now - t < 5000);
  arr.push(now);
  spamTracker.set(message.author.id, arr);
  if (arr.length > threshold) {
    return await act(message, cfg, 'Spam', isBypass);
  }

  // NSFW protection
  if (cfg.nsfw_protection) {
    const allowed = cfg.nsfw_allowed_channels || [];
    if (!allowed.includes(message.channel.id) && hasNsfwHint(content)) {
      return await act(message, cfg, 'NSFW obsah mimo povolený kanál', isBypass);
    }
  }

  return false;
}

function hasNsfwHint(text) {
  return /\b(nsfw|porn|18\+|xxx)\b/i.test(text);
}

async function sendBypassAlert(message, cfg, reason) {
  const channelId = cfg.default_alerts_channel || cfg.default_log_channel;
  if (!channelId) return;
  const ch = await message.guild.channels.fetch(channelId).catch(() => null);
  if (!ch?.isTextBased?.()) return;
  await ch
    .send({
      content: `⚪ **Bypass role** — porušení automodu ignorováno\n• Uživatel: <@${message.author.id}> (\`${message.author.tag}\`)\n• Důvod: ${reason}\n• Kanál: <#${message.channel.id}>\n• Zpráva: ${message.url}`,
    })
    .catch(() => {});
}

async function act(message, cfg, reason, isBypass = false) {
  // Bypass: nic neprovádět, jen alert (zpráva zůstane)
  if (isBypass) {
    await sendBypassAlert(message, cfg, reason);
    return false;
  }
  const action = cfg.automod_action || 'warn';
  try {
    if (action === 'delete' || action === 'kick' || action === 'ban') {
      await message.delete().catch(() => {});
    }
    if (action === 'warn') {
      await message.reply({ content: `⚠️ ${reason}` }).catch(() => {});
    }
    if (action === 'kick') {
      await message.member?.kick(reason).catch(() => {});
    }
    if (action === 'ban') {
      await message.member?.ban({ reason }).catch(() => {});
    }
  } catch (e) {
    console.error('automod act error', e);
  }
  return true;
}
