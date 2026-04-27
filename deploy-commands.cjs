require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

function loadCommands() {
  const dir = path.join(__dirname, 'interactions', 'commands');
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.cjs'));
  const commands = [];

  for (const f of files) {
    const mod = require(path.join(dir, f));
    if (mod?.data) commands.push(mod.data.toJSON());
  }

  return commands;
}

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId || !guildId) {
    console.error('Missing DISCORD_TOKEN / CLIENT_ID / GUILD_ID in .env');
    process.exit(1);
  }

  const commands = loadCommands();

  const rest = new REST({ version: '10' }).setToken(token);

  console.log('⏳ Deploying commands...');
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
  console.log(`✅ Deployed ${commands.length} commands`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
