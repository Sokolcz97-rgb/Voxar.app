import { EmbedBuilder } from 'discord.js';
import { getConfig } from './config.js';

// ============================================================
// Anti-scam: detekce podvodných odkazů / phishingu / scamů
// Anti-bot: detekce čerstvě vytvořených / podezřelých účtů
// Akce: okamžitý smaz + ban bez varování + alert do alerts kanálu
// ============================================================

// Známé scam vzory (free nitro, steam gifty, crypto, fake login, atp.)
const SCAM_PATTERNS = [
  /\bfree\s*(discord\s*)?nitro\b/i,
  /\bnitro\s*(for\s*)?free\b/i,
  /\bsteam\s*gift\b/i,
  /\bclaim\s*your\s*(free\s*)?(nitro|gift|reward)\b/i,
  /\bairdrop\b.*\b(crypto|eth|btc|nft)\b/i,
  /\b(only|just)\s*for\s*you\b.*http/i,
  /who\s*(the\s*)?first/i,
  /\bsteamcommunity\s*\.\s*ru\b/i,
];

// Phishing / fake domény (běžně zneužívané pro podvody na Discordu)
const SCAM_DOMAINS = [
  'discordnitro.gift',
  'discord-nitro.com',
  'dlscord.com',
  'dlscordapp.com',
  'discrod.com',
  'discordapp.io',
  'discordgift.site',
  'discord-airdrop.com',
  'steamcommiunity.com',
  'steancommunity.com',
  'stearmcommunity.com',
  'steamcommunity.ru',
  'discrod-nitro.com',
  'discord-gifts.com',
  'discordsnitro.com',
  'dicsord.com',
  'discrodapp.com',
];

// Podezřelé TLD často využívané pro podvody
const SUSPICIOUS_TLDS = ['.ru', '.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.click'];

const URL_REGEX = /\b((?:https?:\/\/|www\.)[^\s<>"']+)/gi;

function extractUrls(text) {
  if (!text) return [];
  return Array.from(text.matchAll(URL_REGEX)).map((m) => m[1]);
}

function getHost(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : `http://${url}`);
    return u.hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function detectScam(content) {
  if (!content) return null;
  const text = content.toLowerCase();

  for (const pat of SCAM_PATTERNS) {
    if (pat.test(text)) return { type: 'pattern', match: pat.source };
  }

  const urls = extractUrls(content);
  for (const url of urls) {
    const host = getHost(url);
    if (!host) continue;
    if (SCAM_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
      return { type: 'domain', match: host };
    }
    // Podezřelé: discord/steam keyword v hostname, ale není to oficiální doména
    if (
      /discord|nitro|steam/.test(host) &&
      !/(^|\.)discord\.(com|gg|media)$|(^|\.)discordapp\.(com|net)$|(^|\.)steamcommunity\.com$|(^|\.)steampowered\.com$/.test(
        host
      )
    ) {
      return { type: 'impersonation', match: host };
    }
    if (SUSPICIOUS_TLDS.some((t) => host.endsWith(t)) && /gift|free|nitro|claim|reward|airdrop/.test(text)) {
      return { type: 'suspicious_tld', match: host };
    }
  }

  return null;
}

// Anti-bot heuristika pro nově příchozí účet
export function detectSuspiciousAccount(member) {
  const reasons = [];
  const ageMs = Date.now() - member.user.createdTimestamp;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays < 2) reasons.push(`účet starý jen ${ageDays.toFixed(1)} dne`);

  const name = member.user.username || '';
  // typický scam-bot pattern: jméno + spousta čísel, nebo "nitro/free" v nicku
  if (/free|nitro|gift|airdrop|claim/i.test(name)) reasons.push(`podezřelý nick "${name}"`);
  if (/^[a-z]+\d{4,}$/i.test(name) && ageDays < 7) reasons.push(`generický nick + nový účet`);

  if (member.user.bot && !member.user.flags?.has?.('VerifiedBot')) {
    reasons.push('neoficiální bot');
  }

  return reasons.length ? reasons.join('; ') : null;
}

async function sendAlert(guild, cfg, { user, reason, evidence, channel, messageContent }) {
  const channelId = cfg.default_alerts_channel || cfg.default_log_channel;
  if (!channelId) return;
  const alertCh = await guild.channels.fetch(channelId).catch(() => null);
  if (!alertCh?.isTextBased?.()) return;

  const reportUrl = `https://dis.gd/request`;
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🛡️ Anti-scam / Anti-bot ochrana')
    .setDescription(`**Uživatel byl automaticky zabanován bez varování.**`)
    .addFields(
      { name: 'Uživatel', value: `${user.tag} (\`${user.id}\`)\n<@${user.id}>`, inline: false },
      { name: 'ID účtu', value: `\`${user.id}\``, inline: true },
      {
        name: 'Účet vytvořen',
        value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
        inline: true,
      },
      { name: 'Důvod', value: reason, inline: false }
    )
    .setThumbnail(user.displayAvatarURL?.() || null)
    .setTimestamp();

  if (evidence) embed.addFields({ name: 'Důkaz', value: evidence.slice(0, 1000) });
  if (channel) embed.addFields({ name: 'Kanál', value: `<#${channel.id}>`, inline: true });
  if (messageContent) {
    embed.addFields({
      name: 'Obsah zprávy',
      value: '```' + messageContent.replace(/`/g, "'").slice(0, 900) + '```',
    });
  }
  embed.addFields({
    name: 'Nahlásit Discordu',
    value: `[Otevřít formulář pro nahlášení](${reportUrl})\nZkopíruj ID účtu: \`${user.id}\``,
  });

  await alertCh.send({ embeds: [embed] }).catch((e) => console.error('alert send', e?.message));
}

export async function runAntiScam(message) {
  if (message.author.bot || !message.guild) return false;
  const cfg = await getConfig(message.guild.id);
  if (cfg.bot_maintenance) return false;

  const detection = detectScam(message.content || '');
  if (!detection) return false;

  const reason = `Scam/phishing (${detection.type}: ${detection.match})`;

  // 1) smaz zprávu
  await message.delete().catch(() => {});

  // 2) ban bez varování (smaz posledních 24h zpráv) — pokud ban selže, fallback kick
  let banned = false;
  let kicked = false;
  try {
    await message.guild.members.ban(message.author.id, {
      reason,
      deleteMessageSeconds: 60 * 60 * 24,
    });
    banned = true;
  } catch (e) {
    console.error('anti-scam ban failed', e?.message);
    try {
      const m = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (m && m.kickable) { await m.kick(reason); kicked = true; }
    } catch (e2) { console.error('anti-scam kick fallback failed', e2?.message); }
  }

  // 3) alert
  const statusNote = banned ? ' → 🔨 BAN' : kicked ? ' → 👢 KICK (ban selhal)' : ' (ban i kick selhaly – chybí oprávnění)';
  await sendAlert(message.guild, cfg, {
    user: message.author,
    reason: `${reason}${statusNote}`,
    evidence: `Match: \`${detection.match}\``,
    channel: message.channel,
    messageContent: message.content,
  }).catch(() => {});

  return true;
}

export async function runAntiBot(member) {
  const cfg = await getConfig(member.guild.id);
  if (cfg.bot_maintenance) return false;

  const reason = detectSuspiciousAccount(member);
  if (!reason) return false;

  // Banuj jen tvrdé případy: účet < 1 den, nebo nitro/scam v nicku, nebo neoficiální bot
  const hard =
    Date.now() - member.user.createdTimestamp < 1000 * 60 * 60 * 24 ||
    /free|nitro|gift|airdrop|claim/i.test(member.user.username || '') ||
    (member.user.bot && !member.user.flags?.has?.('VerifiedBot'));

  if (!hard) {
    // jen log do alerts
    await sendAlert(member.guild, cfg, {
      user: member.user,
      reason: `⚠️ Podezřelý účet (bez banu): ${reason}`,
    }).catch(() => {});
    return false;
  }

  let banned = false;
  try {
    await member.guild.members.ban(member.id, {
      reason: `Anti-bot: ${reason}`,
      deleteMessageSeconds: 60 * 60 * 24,
    });
    banned = true;
  } catch (e) {
    console.error('anti-bot ban failed', e?.message);
  }

  await sendAlert(member.guild, cfg, {
    user: member.user,
    reason: `Anti-bot: ${reason}${banned ? '' : ' (ban se nezdařil – chybí oprávnění?)'}`,
  }).catch(() => {});

  return banned;
}
