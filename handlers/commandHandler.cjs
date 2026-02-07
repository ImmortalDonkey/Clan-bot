const path = require('path');
const fs = require('fs');

const commands = new Map();

(function load() {
  const dir = path.join(__dirname, '..', 'interactions', 'commands');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.cjs'));
  for (const f of files) {
    const mod = require(path.join(dir, f));
    commands.set(mod.data.name, mod);
  }
})();

async function handle(client, interaction) {
  const cmd = commands.get(interaction.commandName);
  if (!cmd) return;

  await cmd.execute(client, interaction);
}

module.exports = { handle };
