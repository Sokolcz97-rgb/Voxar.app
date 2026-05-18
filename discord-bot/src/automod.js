import { getConfig } from './config.js';

const spamTracker = new Map(); // userId → [timestamps]

export async function runAutomod(message) {
  if (message.author.bot || !message.guild) return false;
  const cfg = await getConfig(message.guild.id);
  if (!cfg.automod_enabled) return false;
  if (cfg.bot_maintenance) return false;

  const content = message.content || '';
  const lower = content.toLowerCase();

  // Blocked words
  const blocked = (cfg.automod_blocked_words || []).map((w) => w.toLowerCase());
  if (blocked.some((w) => w && lower.includes(w))) {
    return await act(message, cfg, 'Blokované slovo');
  }

  // Mentions
  const mentionCount =
    (message.mentions?.users?.size ?? 0) + (message.mentions?.roles?.size ?? 0);
  if (mentionCount > (cfg.automod_max_mentions ?? 5)) {
    return await act(message, cfg, 'Příliš mnoho zmínek');
  }

  // Emojis (unicode + custom)
  const emojiCount =
    (content.match(/<a?:\w+:\d+>/g)?.length ?? 0) +
    (content.match(/\p{Extended_Pictographic}/gu)?.length ?? 0);
  if (emojiCount > (cfg.automod_max_emojis ?? 10)) {
    return await act(message, cfg, 'Příliš mnoho emoji');
  }

  // Spam: N messages in 5s
  const threshold = cfg.automod_spam_threshold ?? 5;
  const now = Date.now();
  const arr = (spamTracker.get(message.author.id) || []).filter((t) => now - t < 5000);
  arr.push(now);
  spamTracker.set(message.author.id, arr);
  if (arr.length > threshold) {
    return await act(message, cfg, 'Spam');
  }

  // NSFW protection
  if (cfg.nsfw_protection) {
    const allowed = cfg.nsfw_allowed_channels || [];
    if (!allowed.includes(message.channel.id) && hasNsfwHint(content)) {
      return await act(message, cfg, 'NSFW obsah mimo povolený kanál');
    }
  }

  return false;
}

function hasNsfwHint(text) {
  return /\b(nsfw|porn|18\+|xxx)\b/i.test(text);
}

async function act(message, cfg, reason) {
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
