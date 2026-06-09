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
  /\b(discord|steam)\s*(gift|gifts)\b/i,
  /\bclaim\s*(your)?\s*(free\s*)?(nitro|gift|reward|skin|csgo|cs2)\b/i,
  /\bairdrop\b/i,
  /\b(only|just)\s*for\s*you\b.*http/i,
  /who\s*(the\s*)?first/i,
  /\bsteamcommunity\s*\.\s*ru\b/i,
  // typické scam fráze (EN+CZ)
  /\bi\s*(found|got)\s*(a\s*)?(free|cheap)\s*(nitro|gift)/i,
  /\bnitro\s*(drop|giveaway)\b/i,
  /\b(teen|18\+|girls?|nudes?|onlyfans|leaked|sex)\b.*https?:\/\//i,
  /https?:\/\/.*\b(teen|18\+|nude|onlyfans|leak|sex)\b/i,
  /\b(trade|skins?|csgo|cs2)\b.*https?:\/\//i,
  /https?:\/\/(t\.me|telegram\.me)\/.+/i,
  /\bjoin\s*(my|this)\s*(server|discord)\b.*https?:\/\//i,
  /\bdm\s*me\b.*https?:\/\//i,
  /\bzdarma\s*(nitro|skiny?)\b/i,
  /\bdárek\b.*https?:\/\//i,
  /@everyone.*https?:\/\//i,
  /@here.*https?:\/\//i,
];

// Phishing / fake domény (běžně zneužívané pro podvody na Discordu)
const SCAM_DOMAINS = [
  'discordnitro.gift', 'discord-nitro.com', 'dlscord.com', 'dlscordapp.com',
  'discrod.com', 'discordapp.io', 'discordgift.site', 'discord-airdrop.com',
  'steamcommiunity.com', 'steancommunity.com', 'stearmcommunity.com',
  'steamcommunity.ru', 'discrod-nitro.com', 'discord-gifts.com',
  'discordsnitro.com', 'dicsord.com', 'discrodapp.com',
  'discord-airdrop.xyz', 'discordnitro.info', 'discord-nitro.info',
  'steamcommunlty.com', 'stearncommunity.com', 'steamcommunity-tradeoffer.ru',
  'csgo-skins.com', 'csgo-trade.ru', 'csgo-cases.ru',
  'bit.ly', 'tinyurl.com', 'cutt.ly', 'shorturl.at', // shortenery v kombinaci s keywordy
];

// Bezpečné domény – nikdy se neflagují
const SAFE_DOMAINS = [
  'discord.com','discord.gg','discord.media','discordapp.com','discordapp.net',
  'steamcommunity.com','steampowered.com',
  'youtube.com','youtu.be','twitch.tv',
  'twitter.com','x.com','instagram.com','facebook.com','tiktok.com',
  'github.com','google.com','wikipedia.org','reddit.com',
  'spotify.com','soundcloud.com','imgur.com','tenor.com','giphy.com',
];

// Podezřelé TLD často využívané pro podvody
const SUSPICIOUS_TLDS = ['.ru','.tk','.ml','.ga','.cf','.gq','.xyz','.top','.click','.icu','.work','.link','.zip','.mov'];

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

function isSafeHost(host) {
  return SAFE_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

export function detectScam(content, ctx = {}) {
  if (!content) return null;
  const text = content.toLowerCase();

  for (const pat of SCAM_PATTERNS) {
    if (pat.test(text)) return { type: 'pattern', match: pat.source };
  }

  const urls = extractUrls(content);
  for (const url of urls) {
    const host = getHost(url);
    if (!host) continue;
    if (isSafeHost(host)) continue;
    if (SCAM_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
      return { type: 'domain', match: host };
    }
    // Impersonation: discord/steam/nitro keyword v hostname mimo oficiální domény
    if (/discord|nitro|steam|stea?m/.test(host)) {
      return { type: 'impersonation', match: host };
    }
    if (SUSPICIOUS_TLDS.some((t) => host.endsWith(t)) && /gift|free|nitro|claim|reward|airdrop|skin|trade|drop/.test(text)) {
      return { type: 'suspicious_tld', match: host };
    }
    // @everyone / @here + jakýkoli neznámý odkaz = scam
    if (/@everyone|@here/.test(content)) {
      return { type: 'mass_mention_link', match: host };
    }
    // Odkaz od velmi nového účtu (<3 dny) na neznámou doménu
    if (ctx.accountAgeDays != null && ctx.accountAgeDays < 3) {
      return { type: 'new_account_link', match: host };
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

function hasBypassRole(member, cfg) {
  const ids = cfg?.bypass_role_ids || [];
  if (!ids.length || !member?.roles?.cache) return false;
  return ids.some((r) => member.roles.cache.has(r));
}

export async function runAntiScam(message) {
  if (message.author.bot || !message.guild) return false;
  const cfg = await getConfig(message.guild.id);
  if (cfg.bot_maintenance) return false;

  const detection = detectScam(message.content || '');
  if (!detection) return false;

  const reason = `Scam/phishing (${detection.type}: ${detection.match})`;

  // Bypass: pokud má uživatel některou z bypass rolí, zprávu nesmazat ani nebanovat – pouze alert.
  const member = message.member || (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (hasBypassRole(member, cfg)) {
    await sendAlert(message.guild, cfg, {
      user: message.author,
      reason: `${reason} → ⚪ BYPASS role (pouze upozornění)`,
      evidence: `Match: \`${detection.match}\``,
      channel: message.channel,
      messageContent: message.content,
    }).catch(() => {});
    return false;
  }

  // 1) smaz zprávu
  await message.delete().catch((e) => console.error('anti-scam delete failed', e?.message));

  // 2) ban bez varování (smaz posledních 24h zpráv) — pokud ban selže, fallback kick
  let banned = false;
  let kicked = false;
  let banErr = null;
  let kickErr = null;
  try {
    await message.guild.members.ban(message.author.id, {
      reason,
      deleteMessageSeconds: 60 * 60 * 24,
    });
    banned = true;
  } catch (e) {
    banErr = e?.message || String(e);
    console.error('anti-scam ban failed', banErr);
    try {
      const m = member || (await message.guild.members.fetch(message.author.id).catch(() => null));
      if (m && m.kickable) { await m.kick(reason); kicked = true; }
      else if (m && !m.kickable) kickErr = 'member not kickable (vyšší role než bot nebo chybí KICK_MEMBERS)';
      else kickErr = 'member nenalezen';
    } catch (e2) {
      kickErr = e2?.message || String(e2);
      console.error('anti-scam kick fallback failed', kickErr);
    }
  }

  // 3) alert
  const statusNote = banned
    ? ' → 🔨 BAN'
    : kicked
      ? ' → 👢 KICK (ban selhal)'
      : ` (ban i kick selhaly — ban: ${banErr || '?'}; kick: ${kickErr || '?'})`;
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
  if (hasBypassRole(member, cfg)) {
    await sendAlert(member.guild, cfg, {
      user: member.user,
      reason: `⚪ BYPASS role: ${reason} (žádná akce)`,
    }).catch(() => {});
    return false;
  }

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
  let kicked = false;
  try {
    await member.guild.members.ban(member.id, {
      reason: `Anti-bot: ${reason}`,
      deleteMessageSeconds: 60 * 60 * 24,
    });
    banned = true;
  } catch (e) {
    console.error('anti-bot ban failed', e?.message);
    try {
      if (member.kickable) { await member.kick(`Anti-bot: ${reason}`); kicked = true; }
    } catch (e2) { console.error('anti-bot kick fallback failed', e2?.message); }
  }

  const statusNote = banned ? ' → 🔨 BAN' : kicked ? ' → 👢 KICK (ban selhal)' : ' (ban i kick selhaly – chybí oprávnění)';
  await sendAlert(member.guild, cfg, {
    user: member.user,
    reason: `Anti-bot: ${reason}${statusNote}`,
  }).catch(() => {});

  return banned || kicked;
}

// ============================================================
// Manuální sken všech členů serveru — spouštěný z webu (bot_outbound_queue)
// Posílá souhrnný report do alerts kanálu a u tvrdých případů automaticky banuje (+kick fallback).
// ============================================================
export async function scanGuildMembers(guild) {
  const cfg = await getConfig(guild.id);
  const alertChannelId = cfg.default_alerts_channel || cfg.default_log_channel;
  const alertCh = alertChannelId
    ? await guild.channels.fetch(alertChannelId).catch(() => null)
    : null;

  await guild.members.fetch().catch((e) => console.error('scan: fetch members', e?.message));

  const suspicious = []; // { member, reason, hard }
  for (const member of guild.members.cache.values()) {
    if (member.user.id === guild.client.user.id) continue;
    const reason = detectSuspiciousAccount(member);
    if (!reason) continue;
    const hard =
      Date.now() - member.user.createdTimestamp < 1000 * 60 * 60 * 24 ||
      /free|nitro|gift|airdrop|claim/i.test(member.user.username || '') ||
      (member.user.bot && !member.user.flags?.has?.('VerifiedBot'));
    suspicious.push({ member, reason, hard });
  }

  // Akce u tvrdých případů
  const actioned = [];
  for (const s of suspicious.filter((x) => x.hard)) {
    let banned = false;
    let kicked = false;
    try {
      await guild.members.ban(s.member.id, {
        reason: `Scan anti-bot: ${s.reason}`,
        deleteMessageSeconds: 60 * 60 * 24,
      });
      banned = true;
    } catch (e) {
      try {
        if (s.member.kickable) { await s.member.kick(`Scan anti-bot: ${s.reason}`); kicked = true; }
      } catch {}
    }
    actioned.push({ ...s, banned, kicked });
  }
  const watched = suspicious.filter((x) => !x.hard);

  // Souhrnný embed
  if (alertCh?.isTextBased?.()) {
    const lines = [];
    lines.push(`**🔎 Scan členů – ${guild.memberCount} účtů prověřeno**`);
    lines.push('');
    if (actioned.length) {
      lines.push(`**🔨 Akce provedena (${actioned.length}):**`);
      for (const a of actioned.slice(0, 15)) {
        const act = a.banned ? 'BAN' : a.kicked ? 'KICK' : 'NIC (chybí oprávnění)';
        lines.push(`• <@${a.member.id}> \`${a.member.user.tag}\` — ${a.reason} → **${act}**`);
      }
      if (actioned.length > 15) lines.push(`…a dalších ${actioned.length - 15}`);
      lines.push('');
    }
    if (watched.length) {
      lines.push(`**⚠️ Podezřelí (jen sledováno, ${watched.length}):**`);
      for (const w of watched.slice(0, 20)) {
        lines.push(`• <@${w.member.id}> \`${w.member.user.tag}\` — ${w.reason}`);
      }
      if (watched.length > 20) lines.push(`…a dalších ${watched.length - 20}`);
    }
    if (!actioned.length && !watched.length) {
      lines.push('✅ Nic podezřelého nebylo nalezeno.');
    }
    const chunks = [];
    let cur = '';
    for (const ln of lines) {
      if ((cur + ln + '\n').length > 1900) { chunks.push(cur); cur = ''; }
      cur += ln + '\n';
    }
    if (cur) chunks.push(cur);
    for (const c of chunks) await alertCh.send({ content: c }).catch(() => {});
  }

  return {
    total: guild.memberCount,
    suspicious: suspicious.length,
    actioned: actioned.length,
    watched: watched.length,
  };
}
