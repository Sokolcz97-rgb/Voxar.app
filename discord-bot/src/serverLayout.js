// Snímek a přestavba rozložení Discord serveru (kategorie, kanály, oprávnění).
//
// Spouští se jen přes frontu bot_outbound_queue (zapisuje do ní pouze service role):
//   { action: 'guild_snapshot', guild_id }                 – jen čte, nic nemění
//   { action: 'guild_restructure', guild_id, confirm, plan } – provede schválený plán
//   { action: 'guild_restore', guild_id, confirm, snapshot } – vrátí rozložení ze zálohy
// Role se nikdy nemažou ani neupravují – mění se jen kategorie, pořadí a oprávnění kanálů.
import { ChannelType, PermissionFlagsBits, PermissionsBitField, OverwriteType } from 'discord.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function flagNames(bitfield) {
  return new PermissionsBitField(BigInt(bitfield)).toArray();
}

function toBits(names = []) {
  let bits = 0n;
  for (const n of names) {
    const flag = PermissionFlagsBits[n];
    if (flag === undefined) throw new Error(`neznámé oprávnění ${n}`);
    bits |= flag;
  }
  return bits;
}

export async function snapshotGuild(guild) {
  await guild.roles.fetch();
  const channels = await guild.channels.fetch();
  const me = guild.members.me ?? (await guild.members.fetchMe());
  const roles = [...guild.roles.cache.values()]
    .sort((a, b) => b.position - a.position)
    .map((r) => ({
      id: r.id, name: r.name, position: r.position, color: r.hexColor, managed: r.managed, hoist: r.hoist,
      members: r.members.size, permissions: flagNames(r.permissions.bitfield),
    }));
  const list = [...channels.values()].filter(Boolean)
    .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0))
    .map((c) => ({
      id: c.id, name: c.name, type: ChannelType[c.type] ?? c.type, parent_id: c.parentId ?? null, position: c.rawPosition,
      topic: c.topic ?? null, nsfw: !!c.nsfw, synced: c.parentId ? !!c.permissionsLocked : null,
      overwrites: [...c.permissionOverwrites.cache.values()].map((o) => ({
        id: o.id, type: o.type === OverwriteType.Role ? 'role' : 'member',
        allow: flagNames(o.allow.bitfield), deny: flagNames(o.deny.bitfield),
      })),
    }));
  const onboarding = await guild.fetchOnboarding().catch(() => null);
  return {
    taken_at: new Date().toISOString(),
    onboarding: onboarding ? {
      enabled: !!onboarding.enabled,
      default_channel_ids: [...(onboarding.defaultChannels?.keys?.() ?? [])],
      prompts: [...(onboarding.prompts?.values?.() ?? [])].map((pr) => ({
        id: pr.id, title: pr.title, required: pr.required, in_onboarding: pr.inOnboarding,
        options: [...pr.options.values()].map((o) => ({ title: o.title, channels: [...o.channels.keys()], roles: [...o.roles.keys()] })),
      })),
    } : null,
    guild: { id: guild.id, name: guild.name, owner_id: guild.ownerId, members: guild.memberCount, everyone_id: guild.roles.everyone.id },
    bot: { id: me.id, top_role: me.roles.highest?.name, permissions: flagNames(me.permissions.bitfield) },
    roles,
    channels: list,
  };
}

function resolveOverwrites(guild, overwrites = []) {
  return overwrites.map((o) => {
    const id = o.role === '@everyone' ? guild.roles.everyone.id : (o.role ?? o.id);
    if (!id) throw new Error('oprávnění bez role');
    const isMember = o.type === 'member';
    if (!isMember && !guild.roles.cache.has(id)) throw new Error(`role ${id} na serveru není`);
    return { id, type: isMember ? OverwriteType.Member : OverwriteType.Role, allow: toBits(o.allow), deny: toBits(o.deny) };
  });
}

/**
 * plan = {
 *   categories: [{ key, id?, name, overwrites? }]   – pořadí v poli = pořadí na serveru; bez id = vytvořit
 *   channels:   [{ id, category: key, name?, topic?, sync?: bool, overwrites? }]  – pořadí v poli = pořadí v kategorii
 *   create:     [{ name, type: 'text'|'voice'|'announcement'|'forum', category: key, topic?, overwrites?, sync? }]
 *   delete_empty_categories: [id]                  – smaže jen tehdy, když jsou po přesunu prázdné
 * }
 */
/** Kanály z Onboardingu musí zůstat čitelné pro @everyone (jinak je Discord odmítne). */
function keepReadableForEveryone(overwrites = []) {
  const list = overwrites.map((o) => ({ ...o, allow: [...(o.allow || [])], deny: [...(o.deny || [])] }));
  let ev = list.find((o) => o.role === '@everyone');
  if (!ev) { ev = { role: '@everyone', allow: [], deny: [] }; list.unshift(ev); }
  ev.deny = ev.deny.filter((p) => p !== 'ViewChannel' && p !== 'ReadMessageHistory');
  for (const p of ['ViewChannel', 'ReadMessageHistory']) if (!ev.allow.includes(p)) ev.allow.push(p);
  // neověření a cizí jazyk: číst ano, psát ne
  for (const o of list) if (o.role !== '@everyone') o.deny = o.deny.filter((p) => p !== 'ViewChannel');
  for (const p of ['SendMessages', 'CreatePublicThreads', 'CreatePrivateThreads', 'SendMessagesInThreads']) {
    if (!ev.allow.includes(p) && !ev.deny.includes(p)) ev.deny.push(p);
  }
  return list;
}

export async function applyLayout(guild, plan, log, created = []) {
  await guild.roles.fetch();
  await guild.channels.fetch();
  const me = guild.members.me ?? (await guild.members.fetchMe());
  if (!me.permissions.has(PermissionFlagsBits.ManageChannels) || !me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('bot potřebuje oprávnění Spravovat kanály a Spravovat role');
  }
  const catIds = {};
  // volitelně nejdřív upravit výchozí kanály Onboardingu (musí být čitelné pro všechny)
  // kanály skryté neověřeným nesmí být ani v odpovědích otázek Onboardingu (role zůstávají)
  if (Array.isArray(plan.onboarding_hide_channels) && plan.onboarding_hide_channels.length) {
    const hide = new Set(plan.onboarding_hide_channels);
    const ob = await guild.fetchOnboarding();
    let removed = 0;
    const prompts = [...ob.prompts.values()].map((pr) => ({
      id: pr.id, title: pr.title, singleSelect: pr.singleSelect, required: pr.required, inOnboarding: pr.inOnboarding, type: pr.type,
      options: [...pr.options.values()].map((o) => {
        const channels = [...o.channels.keys()].filter((id) => { const h = hide.has(id); if (h) removed += 1; return !h; });
        return { id: o.id, title: o.title, description: o.description ?? undefined, emoji: o.emoji?.id ?? o.emoji?.name ?? undefined, channels, roles: [...o.roles.keys()] };
      }),
    }));
    await guild.editOnboarding({ prompts, reason: 'Přestavba serveru – chat jen pro ověřené' });
    log(`✎ Onboarding: z otázek odebráno ${removed} odkazů na kanály (role zůstaly)`);
    await sleep(500);
  }
  if (Array.isArray(plan.onboarding_default_channels) && plan.onboarding_default_channels.length) {
    await guild.editOnboarding({ defaultChannels: plan.onboarding_default_channels, reason: 'Přestavba serveru – výchozí kanály pro nováčky' });
    log(`✎ Onboarding: výchozí kanály nastaveny (${plan.onboarding_default_channels.length})`);
    await sleep(500);
  }
  const onboarding = await guild.fetchOnboarding().catch(() => null);
  const onboardingIds = new Set(onboarding?.defaultChannels ? [...onboarding.defaultChannels.keys()] : []);
  if (onboardingIds.size) log(`ℹ Onboarding: ${onboardingIds.size} kanálů zůstane čitelných pro všechny`);
  const catOverwrites = Object.fromEntries((plan.categories || []).map((c) => [c.key, c.overwrites]));

  // 1) kategorie: vytvořit / přejmenovat / oprávnění
  for (const cat of plan.categories || []) {
    let ch = cat.id ? guild.channels.cache.get(cat.id) : null;
    const overwrites = cat.overwrites ? resolveOverwrites(guild, cat.overwrites) : undefined;
    if (!ch) {
      ch = await guild.channels.create({ name: cat.name, type: ChannelType.GuildCategory, permissionOverwrites: overwrites, reason: 'Přestavba serveru (StudioVoxario dashboard)' });
      created.push(ch.id);
      log(`+ kategorie ${cat.name}`);
    } else {
      if (cat.name && ch.name !== cat.name) { await ch.setName(cat.name, 'Přestavba serveru'); log(`~ kategorie ${ch.name}`); }
      if (overwrites) { await ch.permissionOverwrites.set(overwrites, 'Přestavba serveru'); log(`🔒 ${cat.name}`); }
    }
    catIds[cat.key] = ch.id;
    await sleep(350);
  }

  // 2) nové kanály
  const typeMap = { text: ChannelType.GuildText, voice: ChannelType.GuildVoice, announcement: ChannelType.GuildAnnouncement, forum: ChannelType.GuildForum, stage: ChannelType.GuildStageVoice };
  const newIds = [];
  for (const c of plan.create || []) {
    const parent = catIds[c.category];
    if (!parent) throw new Error(`neznámá kategorie ${c.category}`);
    const ch = await guild.channels.create({
      name: c.name, type: typeMap[c.type || 'text'], parent, topic: c.topic,
      permissionOverwrites: c.overwrites ? resolveOverwrites(guild, c.overwrites) : undefined,
      reason: 'Přestavba serveru (StudioVoxario dashboard)',
    });
    if (c.sync !== false && !c.overwrites) await ch.lockPermissions().catch(() => {});
    created.push(ch.id);
    newIds.push({ ...c, id: ch.id });
    log(`+ #${c.name}`);
    await sleep(350);
  }

  // 3) přesun a oprávnění stávajících kanálů
  for (const c of plan.channels || []) {
    const ch = guild.channels.cache.get(c.id);
    if (!ch) { log(`! kanál ${c.id} nenalezen – přeskočeno`); continue; }
    const parent = catIds[c.category];
    if (!parent) throw new Error(`neznámá kategorie ${c.category}`);
    let wanted = c.overwrites;
    if (onboardingIds.has(ch.id) && c.sync !== false) {
      wanted = keepReadableForEveryone(c.overwrites || catOverwrites[c.category] || []);
      log(`ℹ #${ch.name} je v Onboardingu – čitelný pro všechny`);
    }
    const lock = c.sync !== false && !wanted;
    if (ch.parentId !== parent) await ch.setParent(parent, { lockPermissions: lock, reason: 'Přestavba serveru' });
    else if (lock && !ch.permissionsLocked) await ch.lockPermissions();
    if (wanted) await ch.permissionOverwrites.set(resolveOverwrites(guild, wanted), 'Přestavba serveru');
    if (c.name && c.name !== ch.name) await ch.setName(c.name, 'Přestavba serveru');
    if (c.topic !== undefined && 'setTopic' in ch) await ch.setTopic(c.topic, 'Přestavba serveru').catch(() => {});
    log(`→ #${ch.name}`);
    await sleep(300);
  }

  // 4) pořadí: kategorie a kanály uvnitř podle pořadí v plánu
  const positions = [];
  (plan.categories || []).forEach((cat, i) => positions.push({ channel: catIds[cat.key], position: i }));
  const byCat = {};
  for (const c of [...(plan.channels || []), ...newIds]) (byCat[c.category] ||= []).push(c);
  for (const key of Object.keys(byCat)) {
    // textové kanály nad hlasovými (Discord je stejně řadí zvlášť)
    byCat[key].forEach((c, i) => positions.push({ channel: c.id, position: i }));
  }
  await guild.channels.setPositions(positions);
  log(`↕ pořadí ${positions.length} položek`);

  // 4b) smazat jen nově vytvořené kanály/kategorie (pojistka: vytvořené po plan.created_after)
  if (plan.delete_new && plan.created_after) {
    const after = Date.parse(plan.created_after);
    for (const id of plan.delete_new) {
      const ch = guild.channels.cache.get(id);
      if (!ch) continue;
      if (!(ch.createdTimestamp > after)) { log(`! ${ch.name} je starší – nemažu`); continue; }
      if (ch.type === ChannelType.GuildCategory && guild.channels.cache.some((x) => x.parentId === id)) { log(`! kategorie ${ch.name} není prázdná – nemažu`); continue; }
      await ch.delete('Přestavba serveru – duplicitní kanál');
      log(`- ${ch.name} (duplikát)`);
      await sleep(300);
    }
    await guild.channels.fetch();
  }

  // 5) prázdné staré kategorie
  await guild.channels.fetch();
  for (const id of plan.delete_empty_categories || []) {
    const cat = guild.channels.cache.get(id);
    if (!cat || cat.type !== ChannelType.GuildCategory) continue;
    const children = guild.channels.cache.filter((c) => c.parentId === id).size;
    if (children === 0) { await cat.delete('Přestavba serveru – prázdná kategorie'); log(`- kategorie ${cat.name}`); }
    else log(`! kategorie ${cat.name} není prázdná (${children}) – ponechána`);
    await sleep(300);
  }
  return { created };
}


/** Vrátí kategorie, pořadí a oprávnění kanálů podle snímku (role se nemění). */
export async function restoreLayout(guild, snapshot, createdIds = [], log) {
  await guild.channels.fetch();
  const snapIds = new Set(snapshot.channels.map((c) => c.id));
  for (const c of snapshot.channels) {
    const ch = guild.channels.cache.get(c.id);
    if (!ch) { log(`! ${c.name} už neexistuje`); continue; }
    if (c.type !== 'GuildCategory' && ch.parentId !== c.parent_id) await ch.setParent(c.parent_id, { lockPermissions: false });
    const ow = c.overwrites.filter((o) => o.type === 'member' || guild.roles.cache.has(o.id))
      .map((o) => ({ id: o.id, type: o.type === 'member' ? OverwriteType.Member : OverwriteType.Role, allow: toBits(o.allow), deny: toBits(o.deny) }));
    await ch.permissionOverwrites.set(ow, 'Obnova rozložení ze zálohy');
    if (ch.name !== c.name) await ch.setName(c.name);
    await sleep(250);
  }
  await guild.channels.setPositions(snapshot.channels.filter((c) => guild.channels.cache.has(c.id)).map((c) => ({ channel: c.id, position: c.position })));
  for (const id of createdIds) {
    if (snapIds.has(id)) continue;
    const ch = guild.channels.cache.get(id);
    if (ch && (ch.type !== ChannelType.GuildCategory || guild.channels.cache.filter((x) => x.parentId === id).size === 0)) {
      await ch.delete('Obnova rozložení ze zálohy').catch(() => {});
      log(`- ${ch.name}`);
    }
  }
}

/** Zpracuje úlohu z fronty; vrací true, když ji obsloužil. */
export async function handleLayoutJob(client, job, supabase) {
  const p = job.payload || {};
  if (!['guild_snapshot', 'guild_restructure', 'guild_restore'].includes(p.action)) return false;
  const done = (patch) => supabase.from('bot_outbound_queue').update({ sent_at: new Date().toISOString(), ...patch }).eq('id', job.id);
  // zamknout úlohu (fronta se kontroluje každých 5 s – dlouhá úloha se nesmí spustit znovu)
  const { data: claimed } = await supabase.from('bot_outbound_queue')
    .update({ sent_at: new Date().toISOString(), error: 'processing' })
    .eq('id', job.id).is('sent_at', null).select('id');
  if (!claimed?.length) return true;
  const guild = p.guild_id ? await client.guilds.fetch(p.guild_id).catch(() => null) : null;
  if (!guild) { await done({ error: 'guild not found' }); return true; }
  const steps = [];
  const log = (m) => { steps.push(m); console.log(`[layout ${guild.id}] ${m}`); };
  try {
    if (p.action === 'guild_snapshot') {
      await done({ error: null, payload: { ...p, result: await snapshotGuild(guild) } });
      return true;
    }
    // změny jen s výslovným potvrzením na konkrétní server
    if (p.confirm !== `${guild.id}:${guild.name}`) throw new Error('chybí potvrzení (confirm = "<guild_id>:<název serveru>")');
    if (p.action === 'guild_restructure') {
      const backup = await snapshotGuild(guild);
      const created = [];
      try {
        await applyLayout(guild, p.plan || {}, log, created);
        await done({ error: null, payload: { ...p, backup, result: { ok: true, created, steps } } });
      } catch (e) {
        log(`CHYBA: ${e?.message || e}`);
        await done({ error: String(e?.message || e), payload: { ...p, backup, result: { ok: false, created, steps } } });
      }
      return true;
    }
    if (p.action === 'guild_restore') {
      await restoreLayout(guild, p.snapshot, p.created || [], log);
      await done({ error: null, payload: { ...p, snapshot: undefined, result: { ok: true, steps } } });
      return true;
    }
  } catch (e) {
    await done({ error: String(e?.message || e), payload: { ...p, result: { ok: false, steps } } });
  }
  return true;
}
