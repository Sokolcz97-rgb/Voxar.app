import { Client, GatewayIntentBits, Partials } from 'discord.js';
import 'dotenv/config';
import { runAutomod } from './automod.js';
import { handleCommand } from './commands.js';
import { sendWelcome } from './welcome.js';
import { handleInteraction, setupTicketPanel } from './tickets.js';
import { startOutboundWorker } from './outbound.js';
import { startHeartbeat } from './heartbeat.js';

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
  startHeartbeat(client);
  startOutboundWorker(client);
  for (const guild of client.guilds.cache.values()) {
    await setupTicketPanel(client).catch(() => {});
    break; // panel je singleton config
  }
});

client.on('messageCreate', async (message) => {
  try {
    const moderated = await runAutomod(message);
    if (moderated) return;
    await handleCommand(message);
  } catch (e) {
    console.error('messageCreate', e);
  }
});

client.on('guildMemberAdd', async (member) => {
  try {
    await sendWelcome(member);
  } catch (e) {
    console.error('guildMemberAdd', e);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    await handleInteraction(interaction);
  } catch (e) {
    console.error('interactionCreate', e);
  }
});

client.login(token);
