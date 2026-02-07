require('dotenv').config();

const { REST, Routes } = require('discord.js');

const commands = [
  require('./interactions/commands/challengeissue.cjs').data.toJSON()
];

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId || !guildId) {
    console.error('Missing DISCORD_TOKEN / CLIENT_ID / GUILD_ID in .env');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(token);

  console.log('⏳ Deploying commands...');
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
  console.log('✅ Commands deployed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
