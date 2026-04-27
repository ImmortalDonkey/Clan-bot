require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const db = require('./database.cjs');

const commandHandler = require('./handlers/commandHandler.cjs');
const buttonHandler = require('./handlers/buttonHandler.cjs');
const modalHandler = require('./handlers/modalHandler.cjs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  await db.init();

  console.log('✅ Clan event system ready');
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) return commandHandler.handle(client, interaction);
    if (interaction.isButton()) return buttonHandler.handle(client, interaction);
    if (interaction.isModalSubmit()) return modalHandler.handle(client, interaction);
  } catch (err) {
    console.error('❌ interactionCreate error:', err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: '❌ Something went wrong.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Something went wrong.', ephemeral: true });
      }
    } catch {}
  }
});

client.login(process.env.DISCORD_TOKEN);
