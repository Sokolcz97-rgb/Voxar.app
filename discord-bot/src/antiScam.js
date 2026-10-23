import {
  EmbedBuilder, ChannelType, AttachmentBuilder, PermissionsBitField,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} from 'discord.js';
import { getConfig } from './config.js';
import { supabase } from './supabase.js';

// ============================================================================
//  Anti-scam / anti-bot ochrana – bodový systém
//
//  Místo „první shoda = ban“ se každá zpráva ohodnotí body:
//    + podezřelé znaky (známá podvodná doména, napodobenina discord/steam,
//      podvodné fráze, @everyone bez oprávnění, stejný odkaz rozeslaný do více
//      kanálů = napadený účet, nový účet / čerstvě připojený člen…)
//    − důvěra (dlouho na serveru, má role, booster, starý účet)
//  Moderátoři a správci se nekontrolují vůbec.
//
//  Postih se stupňuje:
//    < 40   nic
//    40–69  zpráva s odkazem se skryje + krátké vlídné upozornění (bez trestu)
//    70–99  smazání + timeout 30 min + hlášení s tlačítky pro moderátory
//    ≥ 100  smazání + ban + hlášení s tlačítkem „Odbanovat“
//  Opakované prohřešky během 24 h posouvají o stupeň výš.
//  AI (text i obrázky) se volá jen u zpráv, které už vypadají podezřele.
// ============================================================================

const LEVEL = { WARN: 40, TIMEOUT: 70, BAN: 100 };
const SENSITIVITY = { low: 1.25, normal: 1, high: 0.8 }; // násobí prahy

// ---------------------------------------------------------------- domény
const OFFICIAL = {
  discord: ['discord.com', 'discord.gg', 'discordapp.com', 'discordapp.net', 'discord.media', 'discord.new', 'dis.gd', 'discordstatus.com'],
  steam: ['steamcommunity.com', 'steampowered.com', 'steamstatic.com', 'steamdeck.com', 'steamgames.com'],
  nitro: [],
  epicgames: ['epicgames.com', 'unrealengine.com', 'fortnite.com'],
  roblox: ['roblox.com', 'rbxcdn.com'],
  paypal: ['paypal.com', 'paypal.me'],
  twitch: ['twitch.tv'],
  youtube: ['youtube.com', 'youtu.be'],
  binance: ['binance.com'],
  metamask: ['metamask.io'],
};
const BRANDS = Object.keys(OFFICIAL);

// Bezpečné domény (nikdy se nehodnotí jako podvod)
const SAFE_DOMAINS = [
  ...Object.values(OFFICIAL).flat(),
  'steamdb.info', 'discordjs.guide', 'discord.js.org', 'top.gg', 'disboard.org',
  'twitter.com', 'x.com', 'instagram.com', 'facebook.com', 'tiktok.com', 'threads.net', 'bsky.app',
  'github.com', 'gitlab.com', 'google.com', 'wikipedia.org', 'reddit.com', 'medium.com',
  'spotify.com', 'soundcloud.com', 'imgur.com', 'tenor.com', 'giphy.com', 'gyazo.com',
  'microsoft.com', 'apple.com', 'mozilla.org', 'cloudflare.com', 'amazon.com',
  'seznam.cz', 'idnes.cz', 'novinky.cz', 'ceskatelevize.cz', 'alza.cz', 'mall.cz', 'csfd.cz',
  'minecraft.net', 'mojang.com', 'curseforge.com', 'modrinth.com', 'planetminecraft.com',
  'studiovoxario.com', 'lovable.app', 'voxar.app',
];

// Známé podvodné domény (rozšiřitelné z konfigurace: antiscam_blocked_domains)
const KNOWN_SCAM_DOMAINS = [
  'discordnitro.gift', 'discord-nitro.com', 'dlscord.com', 'dlscordapp.com', 'discrod.com', 'discordapp.io',
  'discordgift.site', 'discord-airdrop.com', 'discrod-nitro.com', 'discord-gifts.com', 'discordsnitro.com',
  'dicsord.com', 'discrodapp.com', 'discord-airdrop.xyz', 'discordnitro.info', 'discord-nitro.info',
  'steamcommiunity.com', 'steancommunity.com', 'stearmcommunity.com', 'steamcommunity.ru', 'steamcommunlty.com',
  'stearncommunity.com', 'steamcommunity-tradeoffer.ru', 'csgo-skins.com', 'csgo-trade.ru', 'csgo-cases.ru',
];
const SHORTENERS = ['bit.ly', 'tinyurl.com', 'cutt.ly', 'shorturl.at', 'is.gd', 'rb.gy', 't.ly', 'goo.su', 'clck.ru', 'iplogger.org', 'grabify.link'];
const SUSPICIOUS_TLDS = ['.ru', '.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.click', '.icu', '.work', '.link', '.zip', '.mov', '.live', '.shop', '.site', '.online', '.fun'];

// ---------------------------------------------------------------- fráze
// [vzor, body] – plné body jen když zpráva obsahuje odkaz / pozvánku
const PHRASES = [
  [/\bfree\s*(discord\s*)?nitro\b|\bnitro\s*(for\s*)?free\b|\bzdarma\s*nitro\b/i, 40],
  [/\b(discord|steam)\s*gifts?\b|\bgift\s*for\s*you\b|\bdárek\s*pro\s*tebe\b/i, 25],
  [/\bclaim\s*(your)?\s*(free\s*)?(nitro|gift|reward|skins?|prize)\b/i, 30],
  [/\bairdrop\b|\bgiveaway\b.*\b(nitro|skins?|crypto|nft)\b/i, 20],
  [/\b(i'?m|i\s*am)\s*(leaving|quitting)\b.*\b(cs2?|csgo|skins?|inventory)\b/i, 40],
  [/\baccident(al)?ly\s*report(ed)?\b|\bomylem\s*(jsem\s*)?nahlásil\b/i, 45],
  [/\b(onlyfans|nudes?|leaked|18\+|sex\s*cam|hot\s*girls?)\b/i, 30],
  [/\b(double|x2|x10)\s*(your)?\s*(btc|eth|crypto|money)\b|\binvest(ment)?\b.*\b(guaranteed|profit)\b/i, 35],
  [/\bverify\s*(your)?\s*(account|wallet)\b|\bověř\s*(si)?\s*účet\b/i, 25],
  [/\bsteam\s*(guard|support)\b.*\b(code|login)\b/i, 30],
];

const URL_REGEX = /\b((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const INVITE_REGEX = /(discord\.gg|discord(?:app)?\.com\/invite)\/[a-z0-9-]+/i;

function extractUrls(text) {
  if (!text) return [];
  return Array.from(text.matchAll(URL_REGEX)).map((m) => m[1]);
}
function getHost(url) {
  try { return new URL(url.startsWith('http') ? url : `http://${url}`).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return ''; }
}
const onDomain = (host, d) => host === d || host.endsWith(`.${d}`);

// Napodobeniny (typosquatting): dlscord, d1scord, steamcomunity, disc0rd…
function lev(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function squash(label) {
  return label.replace(/[0]/g, 'o').replace(/[1!|]/g, 'l').replace(/rn/g, 'm').replace(/[-_.]/g, '');
}
function impersonates(host) {
  const labels = host.split('.');
  const main = squash(labels.slice(0, -1).join(''));
  for (const brand of BRANDS) {
    if (OFFICIAL[brand].some((d) => onDomain(host, d))) return null;
    if (main.includes(brand)) return { brand, how: 'contains' };
    for (const part of labels.slice(0, -1)) {
      const p = squash(part);
      if (p.length >= 5 && p !== brand && lev(p, brand) <= (brand.length >= 7 ? 2 : 1)) return { brand, how: 'typo' };
    }
    if (brand === 'steam' && /steamc?omm?un/.test(main)) return { brand, how: 'typo' };
  }
  return null;
}

// ---------------------------------------------------------------- paměť
const recent = new Map();   // guild:user -> [{ t, channelId, sig, links }]
const strikes = new Map();  // guild:user -> [timestamps]
const DAY = 86400000;
function remember(key, entry) {
  const now = Date.now();
  const arr = (recent.get(key) || []).filter((e) => now - e.t < 60000);
  arr.push(entry);
  recent.set(key, arr);
  return arr;
}
function strikeCount(key) {
  const now = Date.now();
  const arr = (strikes.get(key) || []).filter((t) => now - t < DAY);
  strikes.set(key, arr);
  return arr.length;
}
function addStrike(key, n = 1) {
  const arr = strikes.get(key) || [];
  for (let i = 0; i < n; i++) arr.push(Date.now());
  strikes.set(key, arr);
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of recent) if (!v.some((e) => now - e.t < 60000)) recent.delete(k);
  for (const [k, v] of strikes) if (!v.some((t) => now - t < DAY)) strikes.delete(k);
}, 5 * 60000).unref?.();

// ---------------------------------------------------------------- hodnocení
const STAFF_PERMS = [
  PermissionsBitField.Flags.Administrator, PermissionsBitField.Flags.ManageGuild,
  PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.BanMembers,
  PermissionsBitField.Flags.KickMembers, PermissionsBitField.Flags.ModerateMembers,
];
function isStaff(member) {
  if (!member) return false;
  if (member.guild?.ownerId === member.id) return true;
  return STAFF_PERMS.some((p) => member.permissions?.has?.(p));
}
function hasBypassRole(member, cfg) {
  const ids = cfg?.bypass_role_ids || [];
  return !!(ids.length && member?.roles?.cache && ids.some((r) => member.roles.cache.has(r)));
}

/**
 * Ohodnotí text zprávy (bez kontextu člena). Vrací { score, reasons[], hasLink, hosts[] }.
 * Používá se i pro chaty Twitch/YouTube (streamAutomod).
 */
export function scoreContent(content, cfg = {}) {
  const reasons = [];
  let score = 0;
  const text = content || '';
  const urls = extractUrls(text);
  const hasInvite = INVITE_REGEX.test(text);
  const hasLink = urls.length > 0 || hasInvite;
  const hosts = [...new Set(urls.map(getHost).filter(Boolean))];
  const blocked = [...KNOWN_SCAM_DOMAINS, ...(cfg.antiscam_blocked_domains || [])];
  const allowed = [...SAFE_DOMAINS, ...(cfg.antiscam_allowed_domains || [])];

  for (const host of hosts) {
    if (blocked.some((d) => onDomain(host, d))) { score += 100; reasons.push(`známá podvodná doména ${host}`); continue; }
    if (allowed.some((d) => onDomain(host, d))) continue;
    const imp = impersonates(host);
    if (imp) {
      const giftish = /gift|nitro|free|claim|promo|drop|reward/.test(host);
      const pts = imp.how === 'typo' ? 80 : giftish ? 70 : 35;
      score += pts; reasons.push(`napodobenina ${imp.brand} (${host})`);
    }
    if (SHORTENERS.some((d) => onDomain(host, d))) { score += 15; reasons.push(`zkracovač odkazů ${host}`); }
    if (SUSPICIOUS_TLDS.some((t) => host.endsWith(t))) { score += 10; reasons.push(`rizikové TLD ${host}`); }
  }
  if (hasInvite && !cfg.antiscam_allow_invites) { score += 15; reasons.push('pozvánka na jiný server'); }

  let phrasePts = 0;
  for (const [re, pts] of PHRASES) if (re.test(text)) { phrasePts += pts; reasons.push(`fráze „${(text.match(re)?.[0] || '').slice(0, 40)}“`); }
  // fráze bez odkazu = málokdy podvod (nikdy samy o sobě nevedou k trestu)
  score += hasLink ? Math.min(phrasePts, 70) : Math.min(phrasePts * 0.4, 25);

  return { score, reasons, hasLink, hosts };
}

/** Zpětná kompatibilita (stream chaty): vrací objekt jen u jasně podvodných zpráv. */
export function detectScam(content, ctx = {}) {
  const r = scoreContent(content, ctx.cfg || {});
  if (ctx.accountAgeDays != null && ctx.accountAgeDays < 3 && r.hasLink) r.score += 15;
  return r.score >= LEVEL.TIMEOUT ? { type: 'score', match: r.reasons.join(', '), score: r.score } : null;
}

function scoreMember(member, user) {
  const reasons = [];
  let score = 0;
  const ageDays = (Date.now() - user.createdTimestamp) / DAY;
  if (ageDays < 1) { score += 25; reasons.push(`účet starý ${Math.max(1, Math.round(ageDays * 24))} h`); }
  else if (ageDays < 3) { score += 15; reasons.push(`účet starý ${ageDays.toFixed(1)} dne`); }
  else if (ageDays < 7) { score += 8; reasons.push('účet mladší týdne'); }
  else if (ageDays > 365) score -= 10;
  if (member?.joinedTimestamp) {
    const inGuild = Date.now() - member.joinedTimestamp;
    if (inGuild < 10 * 60000) { score += 20; reasons.push('na serveru méně než 10 min'); }
    else if (inGuild < DAY) { score += 10; reasons.push('na serveru méně než den'); }
    else if (inGuild > 90 * DAY) score -= 40;
    else if (inGuild > 30 * DAY) score -= 25;
  }
  if (member?.premiumSince) score -= 30;                       // booster
  if ((member?.roles?.cache?.size ?? 1) > 1) score -= 10;       // má nějakou roli
  return { score, reasons };
}

// ---------------------------------------------------------------- AI (jen u podezřelých)
const IMG_EXT = /\.(png|jpe?g|webp|gif|bmp)(\?.*)?$/i;
function imageUrlsFromMessage(message) {
  const urls = [];
  for (const a of message.attachments?.values?.() || []) {
    const ct = a.contentType || '';
    if (ct.startsWith('image/') || IMG_EXT.test(a.url || '')) urls.push(a.url);
  }
  for (const e of message.embeds || []) {
    if (e?.image?.url) urls.push(e.image.url);
    if (e?.thumbnail?.url && IMG_EXT.test(e.thumbnail.url)) urls.push(e.thumbnail.url);
  }
  return urls.slice(0, 4);
}
export async function moderateImages(urls) {
  if (!urls?.length) return null;
  try {
    const { data, error } = await supabase.functions.invoke('moderate-image', { body: { urls } });
    if (error) { console.error('moderate-image invoke', error.message); return null; }
    return data || null;
  } catch (e) { console.error('moderate-image exception', e?.message || e); return null; }
}
async function moderateText(content) {
  try {
    const { data } = await supabase.functions.invoke('moderate', { body: { content, useAI: true } });
    return data || null;
  } catch (e) { console.error('moderate text invoke', e?.message || e); return null; }
}

// ---------------------------------------------------------------- hlášení
async function fetchImageAttachments(urls, max = 4) {
  const out = [];
  for (const url of (urls || []).slice(0, max)) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') || '';
      if (!ct.startsWith('image/')) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 7 * 1024 * 1024) continue;
      const ext = ct.split('/')[1]?.split(';')[0] || 'png';
      out.push(new AttachmentBuilder(buf, { name: `SPOILER_dukaz-${Date.now()}.${ext}` }));
    } catch { /* ignore */ }
  }
  return out;
}

const COLORS = { info: 0x5865f2, warn: 0xfee75c, timeout: 0xf0b232, ban: 0xed4245, ok: 0x57f287 };

async function sendAlert(guild, cfg, { user, level, score, reasons, action, channel, messageContent, evidenceImages, buttons = true }) {
  const channelId = cfg.default_alerts_channel || cfg.default_log_channel;
  if (!channelId) return;
  const alertCh = await guild.channels.fetch(channelId).catch(() => null);
  if (!alertCh?.isTextBased?.()) return;

  let canAttach = true;
  try { if (alertCh.permissionsFor(guild.roles.everyone)?.has(PermissionsBitField.Flags.ViewChannel)) canAttach = false; }
  catch { canAttach = false; }

  const titles = { warn: '🟡 Zpráva skryta (bez trestu)', timeout: '🟠 Timeout 30 min', ban: '🔴 Zabanován', info: '🔵 Podezřelý účet', ok: '🟢 Jen upozornění' };
  const embed = new EmbedBuilder()
    .setColor(COLORS[level] ?? COLORS.info)
    .setAuthor({ name: `${user.tag} · ${user.id}`, iconURL: user.displayAvatarURL?.() || undefined })
    .setTitle(`🛡️ Ochrana · ${titles[level] || level}`)
    .setDescription(action || null)
    .addFields(
      { name: 'Riziko', value: `**${Math.round(score)}** bodů`, inline: true },
      { name: 'Účet vytvořen', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
    )
    .setTimestamp();
  if (channel) embed.addFields({ name: 'Kanál', value: `<#${channel.id}>`, inline: true });
  if (reasons?.length) embed.addFields({ name: 'Proč', value: reasons.slice(0, 8).map((r) => `• ${r}`).join('\n').slice(0, 1000) });
  if (messageContent) embed.addFields({ name: 'Zpráva', value: '```' + messageContent.replace(/`/g, "'").slice(0, 900) + '```' });

  let files = [];
  if (evidenceImages?.length && canAttach) files = await fetchImageAttachments(evidenceImages);

  const components = [];
  if (buttons && level !== 'ok') {
    const row = new ActionRowBuilder();
    if (level === 'ban') row.addComponents(new ButtonBuilder().setCustomId(`as:unban:${user.id}`).setLabel('Odbanovat (omyl)').setStyle(ButtonStyle.Success));
    if (level === 'timeout') row.addComponents(new ButtonBuilder().setCustomId(`as:untimeout:${user.id}`).setLabel('Zrušit timeout').setStyle(ButtonStyle.Success));
    if (level !== 'ban') row.addComponents(new ButtonBuilder().setCustomId(`as:ban:${user.id}`).setLabel('Zabanovat').setStyle(ButtonStyle.Danger));
    row.addComponents(new ButtonBuilder().setCustomId(`as:ok:${user.id}`).setLabel('Vyřízeno').setStyle(ButtonStyle.Secondary));
    row.addComponents(new ButtonBuilder().setLabel('Nahlásit Discordu').setStyle(ButtonStyle.Link).setURL('https://dis.gd/request'));
    components.push(row);
  }
  await alertCh.send({ embeds: [embed], files, components }).catch((e) => console.error('alert send', e?.message));
}

/** Tlačítka v hlášení (jen moderátoři s oprávněním). Vrací true, když interakci obsloužil. */
export async function handleAntiScamInteraction(interaction) {
  if (!interaction.isButton?.() || !interaction.customId?.startsWith('as:')) return false;
  const [, action, userId] = interaction.customId.split(':');
  const perms = interaction.memberPermissions;
  const need = action === 'untimeout' ? PermissionsBitField.Flags.ModerateMembers : action === 'ok' ? PermissionsBitField.Flags.ManageMessages : PermissionsBitField.Flags.BanMembers;
  if (!perms?.has(need)) {
    await interaction.reply({ content: 'Na tohle nemáš oprávnění.', ephemeral: true }).catch(() => {});
    return true;
  }
  const guild = interaction.guild;
  let note = '';
  try {
    if (action === 'unban') { await guild.members.unban(userId, `Omyl ochrany – ${interaction.user.tag}`); strikes.delete(`${guild.id}:${userId}`); note = `🟢 Odbanován moderátorem <@${interaction.user.id}>`; }
    else if (action === 'untimeout') { const m = await guild.members.fetch(userId).catch(() => null); await m?.timeout(null, `Omyl ochrany – ${interaction.user.tag}`); strikes.delete(`${guild.id}:${userId}`); note = `🟢 Timeout zrušen moderátorem <@${interaction.user.id}>`; }
    else if (action === 'ban') { await guild.members.ban(userId, { reason: `Potvrzeno moderátorem ${interaction.user.tag}`, deleteMessageSeconds: 3600 }); note = `🔴 Zabanován moderátorem <@${interaction.user.id}>`; }
    else if (action === 'ok') note = `✔️ Vyřízeno – <@${interaction.user.id}>`;
  } catch (e) { note = `⚠️ Akce selhala: ${e?.message || e}`; }
  const old = interaction.message.embeds?.[0];
  const embed = old ? EmbedBuilder.from(old).addFields({ name: 'Moderátor', value: note }) : null;
  await interaction.update({ embeds: embed ? [embed] : interaction.message.embeds, components: [] }).catch(async () => {
    await interaction.reply({ content: note, ephemeral: true }).catch(() => {});
  });
  return true;
}

// ---------------------------------------------------------------- zprávy
export async function runAntiScam(message) {
  if (message.author.bot || !message.guild) return false;
  const cfg = await getConfig(message.guild.id);
  if (cfg.bot_maintenance || cfg.antiscam_enabled === false) return false;

  const member = message.member || (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (isStaff(member)) return false;            // moderátoři a správci se nekontrolují
  const bypass = hasBypassRole(member, cfg);

  const key = `${message.guild.id}:${message.author.id}`;
  const content = message.content || '';
  const c = scoreContent(content, cfg);
  const m = scoreMember(member, message.author);
  let score = c.score;
  const reasons = [...c.reasons];

  // @everyone / @here bez oprávnění (Discord je stejně nepošle – samo o sobě nic, s odkazem podezřelé)
  const canEveryone = member?.permissionsIn?.(message.channel)?.has?.(PermissionsBitField.Flags.MentionEveryone);
  if (/@everyone|@here/.test(content) && !canEveryone) {
    const pts = c.hasLink ? 30 : 5;
    score += pts; if (pts > 5) reasons.push('@everyone/@here s odkazem bez oprávnění');
  }

  // napadený účet: stejný obsah / odkaz do více kanálů během minuty
  const sig = content.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
  const hist = remember(key, { t: Date.now(), channelId: message.channel.id, sig, links: c.hosts });
  if (sig.length > 8) {
    const channels = new Set(hist.filter((e) => e.sig === sig).map((e) => e.channelId));
    if (channels.size >= 3) { score += 60; reasons.push(`stejná zpráva do ${channels.size} kanálů za minutu`); }
  }
  for (const h of c.hosts) {
    const n = hist.filter((e) => e.links.includes(h)).length;
    if (n >= 3) { score += 30; reasons.push(`odkaz ${h} poslán ${n}× za minutu`); break; }
  }

  // člen se počítá jen u zpráv, které už něco podezřelého mají (důvěra neruší čisté zprávy)
  if (score > 0) { score += m.score; reasons.push(...m.reasons); }

  // obrázky: AI jen u rizikových zpráv/účtů
  let evidenceImages = [];
  const imgs = imageUrlsFromMessage(message);
  if (imgs.length && (score >= 20 || m.score >= 15)) {
    const r = await moderateImages(imgs);
    if (r?.scam) { score += 80; reasons.push(`AI: podvodný obrázek (${r.reason || 'scam'})`); evidenceImages = imgs; }
    else if (r?.nsfw || r?.severe) { score = Math.max(score, LEVEL.WARN); reasons.push(`AI: nevhodný obrázek (${r.reason || 'nsfw'})`); evidenceImages = imgs; }
  }
  // text: AI jen v šedé zóně (rozhodne mezi upozorněním a trestem)
  if (score >= 30 && score < LEVEL.BAN && content.trim().length >= 8) {
    const r = await moderateText(content);
    if (r?.severe) { score += 30; reasons.push(`AI: ${(r.reason || 'problémový obsah').slice(0, 120)}`); }
  }

  const k = SENSITIVITY[cfg.antiscam_sensitivity] ?? 1;
  if (score < LEVEL.WARN * k) return false;

  // opakování během 24 h posune o stupeň
  const prior = strikeCount(key);
  let level = score >= LEVEL.BAN * k ? 'ban' : score >= LEVEL.TIMEOUT * k ? 'timeout' : 'warn';
  if (prior >= 2 && level === 'warn') level = 'timeout';
  else if (prior >= 3 && level === 'timeout') level = 'ban';
  if (prior) reasons.push(`opakovaně (${prior}× za 24 h)`);

  if (bypass) {
    await sendAlert(message.guild, cfg, { user: message.author, level: 'ok', score, reasons, action: 'Uživatel má výjimku (bypass role) – zpráva ponechána.', channel: message.channel, messageContent: content, buttons: false });
    return false;
  }

  await message.delete().catch((e) => console.error('anti-scam delete', e?.message));

  if (level === 'warn') {
    addStrike(key, 1);
    const n = await message.channel.send({
      content: `🛡️ <@${message.author.id}>, tvoje zpráva${c.hasLink ? ' s odkazem' : ''} byla skryta ochranou proti podvodům. Nic se neděje – pokud šlo o omyl, napiš moderátorům.`,
      allowedMentions: { users: [message.author.id] },
    }).catch(() => null);
    if (n) setTimeout(() => n.delete().catch(() => {}), 15000);
    await sendAlert(message.guild, cfg, { user: message.author, level, score, reasons, action: 'Zpráva skryta, uživatel upozorněn. Žádný trest.', channel: message.channel, messageContent: content, evidenceImages });
    return true;
  }

  if (level === 'timeout') {
    addStrike(key, 2);
    let ok = false;
    try { await member?.timeout(30 * 60000, `Ochrana: ${reasons.slice(0, 3).join('; ')}`.slice(0, 500)); ok = true; } catch (e) { console.error('anti-scam timeout', e?.message); }
    await sendAlert(message.guild, cfg, { user: message.author, level, score, reasons, action: ok ? 'Zpráva smazána, timeout 30 minut. Moderátor může zrušit nebo zabanovat.' : 'Zpráva smazána. Timeout se nepovedl (chybí oprávnění Moderate Members?).', channel: message.channel, messageContent: content, evidenceImages });
    return true;
  }

  addStrike(key, 3);
  let banned = false;
  try {
    await message.guild.members.ban(message.author.id, { reason: `Ochrana: ${reasons.slice(0, 3).join('; ')}`.slice(0, 500), deleteMessageSeconds: 3600 });
    banned = true;
  } catch (e) {
    console.error('anti-scam ban', e?.message);
    try { await member?.timeout(24 * 3600000, 'Ochrana: ban selhal'); } catch { /* ignore */ }
  }
  await sendAlert(message.guild, cfg, { user: message.author, level: banned ? 'ban' : 'timeout', score, reasons, action: banned ? 'Zabanován, zprávy za poslední hodinu smazány.' : 'Ban selhal (oprávnění / vyšší role) – nastaven timeout 24 h.', channel: message.channel, messageContent: content, evidenceImages });
  return true;
}

// ---------------------------------------------------------------- příchod člena
export function detectSuspiciousAccount(member) {
  const r = scoreAccount(member);
  return r.score >= 25 ? r.reasons.join('; ') : null;
}
function scoreAccount(member) {
  const reasons = [];
  let score = 0;
  const user = member.user;
  const ageDays = (Date.now() - user.createdTimestamp) / DAY;
  if (ageDays < 1) { score += 40; reasons.push(`účet starý ${Math.max(1, Math.round(ageDays * 24))} h`); }
  else if (ageDays < 7) { score += 15; reasons.push(`účet starý ${ageDays.toFixed(1)} dne`); }
  const name = `${user.username || ''} ${user.globalName || ''}`;
  if (/free\s*nitro|nitro\s*gift|airdrop|claim|giveaway|steam\s*gift/i.test(name)) { score += 50; reasons.push(`podezřelé jméno „${name.trim()}“`); }
  if (/^[a-z]+[._]?\d{4,}$/i.test(user.username || '') && ageDays < 7) { score += 15; reasons.push('generické jméno + nový účet'); }
  if (!user.avatar && ageDays < 7) { score += 10; reasons.push('bez avataru'); }
  return { score, reasons };
}

export async function runAntiBot(member) {
  if (member.user.bot) return false; // boty přidávají správci serveru
  const cfg = await getConfig(member.guild.id);
  if (cfg.bot_maintenance || cfg.antiscam_enabled === false) return false;
  const { score, reasons } = scoreAccount(member);
  if (score < 40) return false;
  if (hasBypassRole(member, cfg)) return false;

  // jasný podvodný účet (jméno + nový) → ban; jinak „karanténa“ (timeout 12 h) a moderátor rozhodne
  if (score >= 90) {
    let banned = false;
    try { await member.guild.members.ban(member.id, { reason: `Anti-bot: ${reasons.join('; ')}`.slice(0, 500), deleteMessageSeconds: 3600 }); banned = true; }
    catch (e) { console.error('anti-bot ban', e?.message); }
    await sendAlert(member.guild, cfg, { user: member.user, level: banned ? 'ban' : 'info', score, reasons, action: banned ? 'Zabanován při příchodu.' : 'Ban selhal (oprávnění).' });
    return banned;
  }
  let ok = false;
  try { await member.timeout(12 * 3600000, `Anti-bot karanténa: ${reasons.join('; ')}`.slice(0, 500)); ok = true; } catch { /* ignore */ }
  await sendAlert(member.guild, cfg, { user: member.user, level: ok ? 'timeout' : 'info', score, reasons, action: ok ? 'Karanténa 12 h (může číst, nemůže psát). Pusť ho tlačítkem, pokud je v pořádku.' : 'Jen upozornění – timeout se nepovedl.' });
  return false;
}

// ---------------------------------------------------------------- ruční skeny z webu
export async function scanGuildMembers(guild) {
  const cfg = await getConfig(guild.id);
  const alertChannelId = cfg.default_alerts_channel || cfg.default_log_channel;
  const alertCh = alertChannelId ? await guild.channels.fetch(alertChannelId).catch(() => null) : null;
  await guild.members.fetch().catch((e) => console.error('scan: fetch members', e?.message));

  const found = [];
  for (const member of guild.members.cache.values()) {
    if (member.user.bot || isStaff(member) || hasBypassRole(member, cfg)) continue;
    const r = scoreAccount(member);
    if (r.score >= 25) found.push({ member, ...r });
  }
  found.sort((a, b) => b.score - a.score);
  const actioned = [];
  for (const f of found.filter((x) => x.score >= 90)) {
    try { await guild.members.ban(f.member.id, { reason: `Scan anti-bot: ${f.reasons.join('; ')}`.slice(0, 500), deleteMessageSeconds: 3600 }); actioned.push(f); }
    catch { /* ignore */ }
  }
  if (alertCh?.isTextBased?.()) {
    const embed = new EmbedBuilder()
      .setColor(found.length ? COLORS.warn : COLORS.ok)
      .setTitle(`🔎 Kontrola členů · ${guild.memberCount} účtů`)
      .setDescription(found.length ? `Podezřelých: **${found.length}**, zabanováno (jasné podvodné účty): **${actioned.length}**. Ostatní jsou jen k ověření.` : '✅ Nic podezřelého.')
      .setTimestamp();
    const list = found.slice(0, 20).map((f) => `${f.score >= 90 ? '🔴' : f.score >= 50 ? '🟠' : '🟡'} <@${f.member.id}> · ${f.score} b · ${f.reasons.join(', ')}`).join('\n');
    if (list) embed.addFields({ name: 'Seznam', value: list.slice(0, 1024) });
    await alertCh.send({ embeds: [embed] }).catch(() => {});
  }
  return { total: guild.memberCount, suspicious: found.length, actioned: actioned.length, watched: found.length - actioned.length };
}

export async function scanGuildMessages(guild, { perChannel = 30 } = {}) {
  const cfg = await getConfig(guild.id);
  const alertChannelId = cfg.default_alerts_channel || cfg.default_log_channel;
  const alertCh = alertChannelId ? await guild.channels.fetch(alertChannelId).catch(() => null) : null;
  await guild.channels.fetch().catch(() => {});
  const scannable = [...guild.channels.cache.values()].filter((ch) => ch?.isTextBased?.() &&
    [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildStageVoice, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread].includes(ch.type));

  const actioned = [];
  let scanned = 0;
  for (const ch of scannable) {
    let msgs;
    try { msgs = await ch.messages.fetch({ limit: perChannel }); } catch { continue; }
    for (const msg of msgs.values()) {
      if (msg.author.bot) continue;
      const member = msg.member || (await guild.members.fetch(msg.author.id).catch(() => null));
      if (isStaff(member) || hasBypassRole(member, cfg)) continue;
      const c = scoreContent(msg.content || '', cfg);
      const imgs = imageUrlsFromMessage(msg);
      let score = c.score;
      const reasons = [...c.reasons];
      if (imgs.length) {
        scanned++;
        const r = await moderateImages(imgs);
        if (r?.scam) { score += 80; reasons.push('AI: podvodný obrázek'); }
        await new Promise((res) => setTimeout(res, 250));
      }
      if (score < LEVEL.BAN) continue;
      await msg.delete().catch(() => {});
      let banned = false;
      try { await guild.members.ban(msg.author.id, { reason: `Scan: ${reasons.join('; ')}`.slice(0, 500), deleteMessageSeconds: 3600 }); banned = true; } catch { /* ignore */ }
      actioned.push({ user: msg.author, channel: ch, banned });
      await sendAlert(guild, cfg, { user: msg.author, level: banned ? 'ban' : 'info', score, reasons, action: banned ? 'Nalezeno při kontrole zpráv – zabanován.' : 'Nalezeno při kontrole zpráv – ban selhal.', channel: ch, messageContent: msg.content, evidenceImages: imgs });
    }
  }
  if (alertCh?.isTextBased?.()) {
    await alertCh.send({ embeds: [new EmbedBuilder().setColor(actioned.length ? COLORS.ban : COLORS.ok)
      .setTitle(`🖼️ Kontrola zpráv · ${scannable.length} kanálů`)
      .setDescription(actioned.length ? `Nalezeno a vyřešeno: **${actioned.length}** (zpráv s obrázky prověřeno: ${scanned}).` : `✅ Nic podvodného (zpráv s obrázky prověřeno: ${scanned}).`)
      .setTimestamp()] }).catch(() => {});
  }
  return { channels: scannable.length, scanned, actioned: actioned.length };
}
