import { supabase } from './supabase.js';
import { getConfig } from './config.js';

export async function handleCommand(message) {
  if (message.author.bot || !message.content) return false;
  const guildId = message.guild?.id ?? null;
  const cfg = await getConfig(guildId);
  const prefix = cfg.prefix || '!';
  if (!message.content.startsWith(prefix)) return false;

  const [rawName, ...args] = message.content.slice(prefix.length).trim().split(/\s+/);
  const name = (rawName || '').toLowerCase();
  if (!name) return false;

  // Built-ins
  if (name === 'ping') {
    await message.reply('🏓 Pong!');
    return true;
  }
  if (name === 'help') {
    // List per-guild + global commands
    const { data } = await supabase
      .from('bot_commands')
      .select('name, description, guild_id')
      .eq('enabled', true)
      .or(`guild_id.eq.${guildId},guild_id.is.null`)
      .order('name');
    const lines = [`**Příkazy** (prefix \`${prefix}\`)`, `- \`ping\` – test`];
    for (const c of data || []) {
      lines.push(`- \`${c.name}\`${c.description ? ` – ${c.description}` : ''}`);
    }
    await message.reply(lines.join('\n'));
    return true;
  }

  // Custom commands — prefer guild-specific, fall back to global
  let { data: cmd } = await supabase
    .from('bot_commands')
    .select('*')
    .eq('name', name)
    .eq('enabled', true)
    .eq('guild_id', guildId)
    .maybeSingle();
  if (!cmd) {
    const r = await supabase
      .from('bot_commands')
      .select('*')
      .eq('name', name)
      .eq('enabled', true)
      .is('guild_id', null)
      .maybeSingle();
    cmd = r.data;
  }
  if (!cmd) return false;

  try {
    if (cmd.response_type === 'embed') {
      const embed = renderVars(cmd.content, message, args);
      await message.channel.send({ embeds: [embed] });
    } else {
      const text = renderVars(cmd.content?.text ?? '', message, args);
      await message.channel.send(text || '(prázdná odpověď)');
    }
  } catch (e) {
    console.error('command error', e);
  }
  return true;
}

function renderVars(value, message, args) {
  const vars = {
    '{user}': `<@${message.author.id}>`,
    '{username}': message.author.username,
    '{server}': message.guild?.name ?? '',
    '{channel}': `<#${message.channel.id}>`,
    '{args}': args.join(' '),
  };
  const replace = (s) =>
    typeof s === 'string'
      ? Object.entries(vars).reduce((acc, [k, v]) => acc.split(k).join(v), s)
      : s;
  if (typeof value === 'string') return replace(value);
  return JSON.parse(JSON.stringify(value), (_, v) => (typeof v === 'string' ? replace(v) : v));
}
