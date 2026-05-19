import { Client, GatewayIntentBits, Partials } from 'discord.js';
import 'dotenv/config';
import { runAutomod } from './automod.js';
import { handleCommand } from './commands.js';
import { sendWelcome } from './welcome.js';
import { handleInteraction, setupTicketPanel } from './tickets.js';
import { startOutboundWorker } from './outbound.js';
import { startHeartbeat } from './heartbeat.js';
import { registerGuild, syncAllGuilds, isGuildApproved, invalidateGuildCache } from './guilds.js';
import { verifySupabaseConnection } from './supabase.js';
import { registerGuildSlashCommands, handleSlashCommand } from './slashCommands.js';
import { startCommandsRealtime } from './commandsRealtime.js';

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
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

client.once('ready', async () => {
  console.log(`✅ Přihlášen jako ${client.user.tag} (${client.guilds.cache.size} serverů)`);
  await syncAllGuilds(client);
  startHeartbeat(client);
  startOutboundWorker(client);
  startCommandsRealtime(client);
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

client.on('guildDelete', async (guild) => {
  console.log(`➖ Left guild ${guild.name} (${guild.id})`);
  invalidateGuildCache(guild.id);
});

client.on('messageCreate', async (message) => {
  try {
    if (!message.guild) return;
    if (!(await isGuildApproved(message.guild.id))) return;
    const moderated = await runAutomod(message);
    if (moderated) return;
    await handleCommand(message);
  } catch (e) {
    console.error('messageCreate', e);
  }
});

client.on('guildMemberAdd', async (member) => {
  try {
    if (!(await isGuildApproved(member.guild.id))) return;
    await sendWelcome(member);
  } catch (e) {
    console.error('guildMemberAdd', e);
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
