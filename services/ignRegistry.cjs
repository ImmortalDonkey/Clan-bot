const db = require('../database.cjs');

let ensured = false;

function cleanIgn(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function validateIgn(ign) {
  const value = cleanIgn(ign);

  if (!value) return 'IGN cannot be empty.';
  if (value.length > 32) return 'IGN must be 32 characters or fewer.';
  if (/[\r\n\t]/.test(String(ign || ''))) return 'IGN cannot contain tabs or line breaks.';

  return null;
}

async function ensureIgnRegistryTable() {
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

  await db.run(`CREATE INDEX IF NOT EXISTS idx_registered_igns_discord ON registered_igns(guild_id, discord_id)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_registered_igns_ign ON registered_igns(guild_id, ign_norm)`);

  ensured = true;
}

async function getRegisteredIgn(guildId, discordId) {
  await ensureIgnRegistryTable();

  return await db.get(
    `SELECT * FROM registered_igns
     WHERE guild_id = ? AND discord_id = ?
     LIMIT 1`,
    [guildId, discordId]
  );
}

async function registerIgn({ guildId, discordId, ign }) {
  await ensureIgnRegistryTable();

  const cleanedIgn = cleanIgn(ign);
  const validationError = validateIgn(cleanedIgn);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  const ignNorm = db.normIgn(cleanedIgn);
  const timestamp = db.nowMs();

  const existingIgnOwner = await db.get(
    `SELECT discord_id FROM registered_igns
     WHERE guild_id = ? AND ign_norm = ? AND discord_id != ?
     LIMIT 1`,
    [guildId, ignNorm, discordId]
  );

  if (existingIgnOwner) {
    return {
      ok: false,
      message: 'That IGN is already registered to another Discord account.'
    };
  }

  await db.run(
    `INSERT INTO registered_igns (guild_id, discord_id, ign, ign_norm, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, discord_id) DO UPDATE SET
       ign = excluded.ign,
       ign_norm = excluded.ign_norm,
       updated_at = excluded.updated_at`,
    [guildId, discordId, cleanedIgn, ignNorm, timestamp, timestamp]
  );

  const row = await getRegisteredIgn(guildId, discordId);
  return { ok: true, row };
}

module.exports = {
  cleanIgn,
  validateIgn,
  ensureIgnRegistryTable,
  getRegisteredIgn,
  registerIgn
};
