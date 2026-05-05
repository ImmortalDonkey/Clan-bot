const db = require('../database.cjs');

let ensured = false;

async function ensureTable() {
  if (ensured) return;

  await db.run(`CREATE TABLE IF NOT EXISTS registered_igns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    discord_id TEXT NOT NULL,
    ign TEXT NOT NULL,
    ign_norm TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(guild_id, discord_id),
    UNIQUE(guild_id, ign_norm)
  )`);

  await db.run(`CREATE INDEX IF NOT EXISTS idx_registered_igns_discord
    ON registered_igns(guild_id, discord_id)`);

  ensured = true;
}

function cleanIgn(ign) {
  return String(ign || '').trim().replace(/\s+/g, ' ');
}

function validateIgn(ign) {
  const cleaned = cleanIgn(ign);

  if (!cleaned) return 'IGN is required.';
  if (cleaned.length < 2) return 'IGN must be at least 2 characters.';
  if (cleaned.length > 32) return 'IGN must be 32 characters or less.';

  return null;
}

async function getRegisteredIgn(guildId, discordId) {
  await ensureTable();

  return await db.get(
    `SELECT * FROM registered_igns
     WHERE guild_id = ? AND discord_id = ?
     LIMIT 1`,
    [guildId, discordId]
  );
}

async function upsertRegisteredIgn({ guild_id, discord_id, ign }) {
  await ensureTable();

  const cleaned = cleanIgn(ign);
  const ignNorm = db.normIgn(cleaned);
  const now = db.nowMs();

  await db.run(
    `INSERT INTO registered_igns
      (guild_id, discord_id, ign, ign_norm, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, discord_id) DO UPDATE SET
       ign = excluded.ign,
       ign_norm = excluded.ign_norm,
       updated_at = excluded.updated_at`,
    [guild_id, discord_id, cleaned, ignNorm, now, now]
  );

  return {
    guild_id,
    discord_id,
    ign: cleaned,
    ign_norm: ignNorm
  };
}

module.exports = {
  cleanIgn,
  validateIgn,
  getRegisteredIgn,
  upsertRegisteredIgn
};
