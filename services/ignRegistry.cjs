const db = require('../database.cjs');

let ensured = false;

async function tableHasColumn(table, column) {
  const rows = await db.all(`PRAGMA table_info(${table})`);
  return rows.some(row => row.name === column);
}

async function ensureColumn(table, column, definition) {
  const exists = await tableHasColumn(table, column);
  if (!exists) {
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

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

  await db.run(`CREATE TABLE IF NOT EXISTS ign_registration_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    discord_id TEXT NOT NULL,
    requested_ign TEXT NOT NULL,
    requested_ign_norm TEXT NOT NULL,
    final_ign TEXT,
    final_ign_norm TEXT,
    status TEXT NOT NULL,
    staff_message_id TEXT,
    reviewed_by TEXT,
    reviewed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  await ensureColumn('ign_registration_requests', 'final_ign', 'TEXT');
  await ensureColumn('ign_registration_requests', 'final_ign_norm', 'TEXT');
  await ensureColumn('ign_registration_requests', 'staff_message_id', 'TEXT');
  await ensureColumn('ign_registration_requests', 'reviewed_by', 'TEXT');
  await ensureColumn('ign_registration_requests', 'reviewed_at', 'INTEGER');

  await db.run(`CREATE INDEX IF NOT EXISTS idx_ign_requests_guild_discord_status
    ON ign_registration_requests(guild_id, discord_id, status)`);

  await db.run(`CREATE INDEX IF NOT EXISTS idx_ign_requests_status
    ON ign_registration_requests(guild_id, status, created_at)`);

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

function makeIgnNorm(ign) {
  return db.normIgn(cleanIgn(ign));
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

async function getRegisteredIgnByNorm(guildId, ignNorm) {
  await ensureTable();

  return await db.get(
    `SELECT * FROM registered_igns
     WHERE guild_id = ? AND ign_norm = ?
     LIMIT 1`,
    [guildId, ignNorm]
  );
}

async function upsertRegisteredIgn({ guild_id, discord_id, ign }) {
  await ensureTable();

  const cleaned = cleanIgn(ign);
  const ignNorm = makeIgnNorm(cleaned);
  const now = db.nowMs();

  const taken = await getRegisteredIgnByNorm(guild_id, ignNorm);
  if (taken && taken.discord_id !== discord_id) {
    const err = new Error('IGN is already registered to another Discord user.');
    err.code = 'IGN_TAKEN';
    throw err;
  }

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

async function createIgnRegistrationRequest({ guild_id, discord_id, ign }) {
  await ensureTable();

  const cleaned = cleanIgn(ign);
  const validationError = validateIgn(cleaned);
  if (validationError) {
    const err = new Error(validationError);
    err.code = 'INVALID_IGN';
    throw err;
  }

  const ignNorm = makeIgnNorm(cleaned);
  const now = db.nowMs();

  const taken = await getRegisteredIgnByNorm(guild_id, ignNorm);
  if (taken && taken.discord_id !== discord_id) {
    const err = new Error('IGN is already registered to another Discord user.');
    err.code = 'IGN_TAKEN';
    throw err;
  }

  await db.run(
    `UPDATE ign_registration_requests
     SET status = 'SUPERSEDED',
         updated_at = ?
     WHERE guild_id = ?
       AND discord_id = ?
       AND status = 'PENDING'`,
    [now, guild_id, discord_id]
  );

  const res = await db.run(
    `INSERT INTO ign_registration_requests
      (guild_id, discord_id, requested_ign, requested_ign_norm, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`,
    [guild_id, discord_id, cleaned, ignNorm, now, now]
  );

  return await getIgnRegistrationRequest(res.lastID);
}

async function getIgnRegistrationRequest(id) {
  await ensureTable();

  return await db.get(
    `SELECT * FROM ign_registration_requests
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
}

async function setIgnRegistrationStaffMessageId(id, staffMessageId) {
  await ensureTable();

  await db.run(
    `UPDATE ign_registration_requests
     SET staff_message_id = ?,
         updated_at = ?
     WHERE id = ?`,
    [staffMessageId, db.nowMs(), id]
  );
}

async function approveIgnRegistrationRequest({ id, reviewer_id, final_ign }) {
  await ensureTable();

  const request = await getIgnRegistrationRequest(id);
  if (!request) {
    const err = new Error('IGN registration request not found.');
    err.code = 'REQUEST_NOT_FOUND';
    throw err;
  }

  if (request.status !== 'PENDING') {
    const err = new Error(`IGN registration request is already ${request.status}.`);
    err.code = 'REQUEST_NOT_PENDING';
    throw err;
  }

  const cleaned = cleanIgn(final_ign || request.requested_ign);
  const validationError = validateIgn(cleaned);
  if (validationError) {
    const err = new Error(validationError);
    err.code = 'INVALID_IGN';
    throw err;
  }

  const saved = await upsertRegisteredIgn({
    guild_id: request.guild_id,
    discord_id: request.discord_id,
    ign: cleaned
  });

  const now = db.nowMs();

  await db.run(
    `UPDATE ign_registration_requests
     SET status = 'APPROVED',
         final_ign = ?,
         final_ign_norm = ?,
         reviewed_by = ?,
         reviewed_at = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      saved.ign,
      saved.ign_norm,
      reviewer_id,
      now,
      now,
      id
    ]
  );

  return {
    request,
    saved
  };
}

async function rejectIgnRegistrationRequest({ id, reviewer_id }) {
  await ensureTable();

  const request = await getIgnRegistrationRequest(id);
  if (!request) {
    const err = new Error('IGN registration request not found.');
    err.code = 'REQUEST_NOT_FOUND';
    throw err;
  }

  if (request.status !== 'PENDING') {
    const err = new Error(`IGN registration request is already ${request.status}.`);
    err.code = 'REQUEST_NOT_PENDING';
    throw err;
  }

  const now = db.nowMs();

  await db.run(
    `UPDATE ign_registration_requests
     SET status = 'REJECTED',
         reviewed_by = ?,
         reviewed_at = ?,
         updated_at = ?
     WHERE id = ?`,
    [reviewer_id, now, now, id]
  );

  return request;
}

module.exports = {
  cleanIgn,
  validateIgn,
  makeIgnNorm,
  ensureTable,
  getRegisteredIgn,
  getRegisteredIgnByNorm,
  upsertRegisteredIgn,
  createIgnRegistrationRequest,
  getIgnRegistrationRequest,
  setIgnRegistrationStaffMessageId,
  approveIgnRegistrationRequest,
  rejectIgnRegistrationRequest
};
