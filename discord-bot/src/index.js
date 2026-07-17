import { Client, GatewayIntentBits, Partials } from 'discord.js';
import 'dotenv/config';
import { runAutomod } from './automod.js';
import { runAntiScam, runAntiBot } from './antiScam.js';
import { handleCommand } from './commands.js';
import { sendWelcome } from './welcome.js';
import { handleInteraction, setupTicketPanel, startTicketsConfigRealtime } from './tickets.js';
import { startOutboundWorker } from './outbound.js';
import { startHeartbeat } from './heartbeat.js';
import { registerGuild, syncAllGuilds, isGuildApproved, invalidateGuildCache } from './guilds.js';
import { verifySupabaseConnection } from './supabase.js';
import { registerGuildSlashCommands, handleSlashCommand } from './slashCommands.js';
import { startCommandsRealtime } from './commandsRealtime.js';
import { startServerStats } from './serverStats.js';
import { startTwitchChat } from './twitchChat.js';
import { startYouTubeChat } from './youtubeChat.js';
import { initVoicePoints, handleVoiceStateUpdate } from './voicePoints.js';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.Reaction, Partials.User],
});

client.once('clientReady', async () => {
  console.log(`✅ Přihlášen jako ${client.user.tag} (${client.guilds.cache.size} serverů)`);
  await syncAllGuilds(client);
  startHeartbeat(client);
  startOutboundWorker(client);
  startCommandsRealtime(client);
  startTicketsConfigRealtime(client);
  startServerStats(client);
  startTwitchChat().catch((e) => console.error('startTwitchChat', e?.message || e));
  startYouTubeChat().catch((e) => console.error('startYouTubeChat', e?.message || e));
  initVoicePoints(client).catch((e) => console.error('initVoicePoints', e?.message || e));
  // Setup ticket panels + slash commandy pro schválené guildy
  for (const guild of client.guilds.cache.values()) {
    if (await isGuildApproved(guild.id)) {
      await setupTicketPanel(client, guild.id).catch(() => {});
      await registerGuildSlashCommands(client, guild.id).catch(() => {});
    }
  }
});

// New guild → register as pending
client.on('guildCreate', async (guild) => {
  console.log(`➕ Joined guild ${guild.name} (${guild.id})`);
  await registerGuild(guild);
  // Zaregistruj slash commandy hned – fungovat začnou až po schválení v adminu
  await registerGuildSlashCommands(client, guild.id).catch(() => {});
});

client.on('channelDelete', async (channel) => {
  try {
    const { supabase } = await import('./supabase.js');
    await supabase.from('bot_open_tickets').delete().eq('channel_id', channel.id);
  } catch {}
});

client.on('guildDelete', async (guild) => {
  console.log(`➖ Left guild ${guild.name} (${guild.id})`);
  invalidateGuildCache(guild.id);
});

client.on('messageCreate', async (message) => {
  try {
    if (!message.guild) return;
    if (!(await isGuildApproved(message.guild.id))) return;
    // Anti-scam / phishing → okamžitý ban bez varování
    const scammed = await runAntiScam(message);
    if (scammed) return;
    const moderated = await runAutomod(message);
    if (moderated) return;

    // Sync messages from a web-ticket channel back to the web ticket replies
    if (!message.author.bot && message.content) {
      try {
        const { supabase } = await import('./supabase.js');
        const { data: openRow } = await supabase
          .from('bot_open_tickets')
          .select('web_ticket_id')
          .eq('channel_id', message.channel.id)
          .maybeSingle();
        if (openRow?.web_ticket_id) {
          const { data: tk } = await supabase
            .from('tickets').select('user_id').eq('id', openRow.web_ticket_id).maybeSingle();
          if (tk?.user_id) {
            const tagged = `**[Discord @${message.author.tag}]**\n${message.content}`;
            await supabase.from('ticket_replies').insert({
              ticket_id: openRow.web_ticket_id,
              user_id: tk.user_id,
              content: tagged,
              is_internal: false,
            });
          }
        }
      } catch (e) { console.error('sync discord→web reply', e); }
    }

    await handleCommand(message);
  } catch (e) {
    console.error('messageCreate', e);
  }
});

// Když Discord doplní embed (rozbalený odkaz na obrázek) dodatečně, znovu spusť anti-scam
client.on('messageUpdate', async (oldMsg, newMsg) => {
  try {
    const msg = newMsg?.partial ? await newMsg.fetch().catch(() => null) : newMsg;
    if (!msg || !msg.guild || msg.author?.bot) return;
    if (!(await isGuildApproved(msg.guild.id))) return;
    const hadImages = (oldMsg?.embeds?.length || 0) + (oldMsg?.attachments?.size || 0);
    const hasImages = (msg.embeds?.length || 0) + (msg.attachments?.size || 0);
    if (hasImages <= hadImages) return; // nic nového (např. edit textu)
    await runAntiScam(msg);
  } catch (e) {
    console.error('messageUpdate antiScam', e?.message || e);
  }
});



client.on('guildMemberAdd', async (member) => {
  try {
    if (!(await isGuildApproved(member.guild.id))) return;
    // Anti-bot ochrana → ban podezřelých/čerstvých účtů
    const banned = await runAntiBot(member);
    if (banned) return;
    await sendWelcome(member);
  } catch (e) {
    console.error('guildMemberAdd', e);
  }
});

client.on('voiceStateUpdate', (oldState, newState) => {
  handleVoiceStateUpdate(oldState, newState);
});

// Translate via flag reaction → post translation into a thread, then remove the reaction
const FLAG_TO_LANG = { '🇨🇿': 'cs', '🇸🇰': 'cs', '🇬🇧': 'en', '🇺🇸': 'en' };
client.on('messageReactionAdd', async (reaction, user) => {
  try {
    if (user.bot) return;
    if (reaction.partial) { try { await reaction.fetch(); } catch (e) { console.error('reaction fetch', e?.message || e); return; } }
    const lang = FLAG_TO_LANG[reaction.emoji.name];
    if (!lang) return;
    let msg = reaction.message;
    if (msg.partial) {
      msg = await msg.fetch().catch((e) => { console.error('msg fetch', e?.message || e); return null; });
    }
    if (!msg?.guild) return;
    if (!(await isGuildApproved(msg.guild.id))) return;
    const text = (msg.content || '').trim();
    // Try to remove the user's flag reaction to keep the channel clean (fails in DMs / no perms)
    reaction.users.remove(user.id).catch(() => {});
    if (!text) return;
    const { translateText } = await import('./translate.js');
    const translation = await translateText(text, lang).catch((e) => `⚠️ Chyba překladu: ${e?.message || 'neznámá'}`);
    const header = lang === 'cs' ? '🇨🇿 Překlad do češtiny' : '🇬🇧 Translation to English';
    const body = translation.length > 1800 ? translation.slice(0, 1797) + '…' : translation;

    // Pick where to post: if message is already inside a thread, reply there.
    // Otherwise reuse existing thread on the message, or create a new one.
    let target = null;
    try {
      const ch = msg.channel;
      if (ch?.isThread?.()) {
        target = ch;
      } else if (msg.hasThread && msg.thread) {
        target = msg.thread;
      } else if (typeof msg.startThread === 'function') {
        target = await msg.startThread({
          name: `Překlad – ${(msg.content || 'zpráva').slice(0, 40)}`,
          autoArchiveDuration: 60,
        }).catch((e) => { console.error('startThread failed', e?.message || e); return null; });
      }
    } catch (e) {
      console.error('pick target failed', e?.message || e);
    }

    if (target) {
      await target.send(`${header} (požádal <@${user.id}>)\n${body}`)
        .catch((e) => console.error('translation send failed', e?.message || e));
    } else {
      // Fallback: reply directly in the channel as a reply to the message
      await msg.reply(`${header} (požádal <@${user.id}>)\n${body}`)
        .catch((e) => console.error('translation reply fallback failed', e?.message || e));
    }
  } catch (e) {
    console.error('reaction translate', e);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.guild && !(await isGuildApproved(interaction.guild.id))) return;
    if (interaction.isChatInputCommand?.()) {
      const handled = await handleSlashCommand(interaction);
      if (handled) return;
    }
    await handleInteraction(interaction);
  } catch (e) {
    console.error('interactionCreate', e);
  }
});

try {
  await verifySupabaseConnection();
  await client.login(token);
} catch (e) {
  console.error('❌ Bot se nespustil:', e?.message || e);
  process.exit(1);
}
