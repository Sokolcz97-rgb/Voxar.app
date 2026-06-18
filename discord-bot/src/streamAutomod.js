import { DEFAULT_BLOCKED_WORDS } from './defaultBlockedWords.js';
import { detectScam } from './antiScam.js';

const spamTracker = new Map(); // key: platform:channel:user -> [timestamps]

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
const DEFAULT_BLOCKED_NORMALIZED = DEFAULT_BLOCKED_WORDS.map(normalize);

const URL_REGEX = /\b((?:https?:\/\/|www\.)\S+|\b[\w.-]+\.[a-z]{2,}(?:\/\S*)?)/gi;

function getHost(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : `http://${url}`);
    return u.hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Evaluate a chat message against automod rules.
 * @param {object} cfg chat_bot_automod row
 * @param {string} text message text
 * @param {object} flags { isMod, isSub }
 * @returns {{action:'allow'|'warn'|'delete'|'timeout'|'ban', reason:string, timeoutSeconds?:number} }
 */
export function evaluateMessage(cfg, text, flags = {}) {
  const content = text || '';
  const lower = normalize(content);

  // Anti-scam (vždy → ban)
  const scam = detectScam(content, {});
  if (scam) {
    return { action: 'ban', reason: `scam:${scam.type}:${scam.match}` };
  }

  // Blocked words
  const userBlocked = (cfg.blocked_words || []).map(normalize);
  const blocked = [...DEFAULT_BLOCKED_NORMALIZED, ...userBlocked];
  if (blocked.some((w) => w && lower.includes(w))) {
    return decide(cfg, 'blocked_word');
  }

  // Caps
  const minLen = cfg.caps_min_length ?? 8;
  if (content.length >= minLen) {
    const letters = content.replace(/[^A-Za-zÁ-Žá-ž]/g, '');
    if (letters.length >= minLen) {
      const upper = letters.replace(/[^A-ZÁ-Ž]/g, '').length;
      const pct = Math.round((upper / letters.length) * 100);
      if (pct > (cfg.max_caps_pct ?? 70)) return decide(cfg, 'caps');
    }
  }

  // Links
  const urls = Array.from(content.matchAll(URL_REGEX)).map((m) => m[1]);
  if (urls.length > 0) {
    const allow =
      (flags.isMod && cfg.allow_links_for_mods) ||
      (flags.isSub && cfg.allow_links_for_subs);
    if (!allow) {
      const whitelist = (cfg.link_whitelist || []).map((d) => d.toLowerCase());
      const offending = urls.filter((u) => {
        const host = getHost(u);
        if (!host) return false;
        return !whitelist.some((d) => host === d || host.endsWith(`.${d}`));
      });
      if (offending.length > (cfg.max_links ?? 0)) {
        return decide(cfg, 'link');
      }
    }
  }

  // Emoji
  const emojiCount =
    (content.match(/\p{Extended_Pictographic}/gu)?.length ?? 0);
  if (emojiCount > (cfg.max_emojis ?? 10)) return decide(cfg, 'emoji');

  // Spam
  const key = `${cfg.channel_id}:${flags.userId || 'anon'}`;
  const now = Date.now();
  const windowMs = (cfg.spam_window_seconds ?? 5) * 1000;
  const arr = (spamTracker.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  spamTracker.set(key, arr);
  if (arr.length > (cfg.spam_threshold ?? 5)) return decide(cfg, 'spam');

  return { action: 'allow', reason: '' };
}

function decide(cfg, reason) {
  const a = cfg.action || 'warn';
  return {
    action: a,
    reason,
    timeoutSeconds: cfg.timeout_seconds ?? 60,
  };
}
