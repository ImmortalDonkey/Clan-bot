const path = require('path');
const fs = require('fs');

const handlers = [];

(function load() {
  const dir = path.join(__dirname, '..', 'interactions', 'buttons');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.cjs'));
  for (const f of files) {
    handlers.push(require(path.join(dir, f)));
  }
})();

async function handle(client, interaction) {
  const id = interaction.customId || '';
  const mod = handlers.find(h => (h.ids || []).some(prefix => id.startsWith(prefix)));
  if (!mod) return;

  await mod.execute(client, interaction);
}

module.exports = { handle };
