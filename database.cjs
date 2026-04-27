const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'bot.db');

function ensureDataDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
ensureDataDir();

const db = new sqlite3.Database(
  DB_PATH,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) console.error('❌ Failed to open SQLite DB:', err);
    else console.log('✅ SQLite DB opened at', DB_PATH);
  }
);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function nowMs() {
  return Date.now();
}

function normIgn(ign) {
  return String(ign || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function init() {
  await run('PRAGMA foreign_keys = ON');

  await run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    status TEXT NOT NULL,
    announcement_channel_id TEXT NOT NULL,
    log_channel_id TEXT NOT NULL,
    verification_channel_id TEXT NOT NULL,
    staff_role_id TEXT NOT NULL,
    reward_config_json TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    ended_at INTEGER,
    finalised_at INTEGER,
    wipe_after INTEGER,
    archived_at INTEGER
  )`);

  await run(`CREATE INDEX IF NOT EXISTS idx_events_guild_status ON events(guild_id, status)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_events_start ON events(status, start_time)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_events_end ON events(status, end_time)`);

  await run(`CREATE TABLE IF NOT EXISTS event_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    guild_id TEXT NOT NULL,
    discord_id TEXT NOT NULL,
    ign TEXT NOT NULL,
    ign_norm TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(event_id, discord_id),
    UNIQUE(event_id, ign_norm),
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
  )`);

  await run(`CREATE INDEX IF NOT EXISTS idx_event_users_points ON event_users(event_id, points DESC, ign COLLATE NOCASE)`);

  await run(`CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    guild_id TEXT NOT NULL,
    discord_id TEXT NOT NULL,
    ign TEXT NOT NULL,
    ign_norm TEXT NOT NULL,
    pokemon_name TEXT NOT NULL,
    pokemon_species TEXT NOT NULL,
    pokemon_type TEXT NOT NULL,
    pokemon_id TEXT NOT NULL,
    points_awarded INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    verification_message_id TEXT,
    verified_by TEXT,
    verified_at INTEGER,
    rejected_by TEXT,
    rejected_at INTEGER,
    created_at INTEGER NOT NULL,
    UNIQUE(event_id, pokemon_id),
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
  )`);

  await run(`CREATE INDEX IF NOT EXISTS idx_submissions_event_user ON submissions(event_id, discord_id, status)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_submissions_set_bonus ON submissions(event_id, discord_id, pokemon_species, pokemon_type, status)`);

  await run(`CREATE TABLE IF NOT EXISTS set_bonuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    guild_id TEXT NOT NULL,
    discord_id TEXT NOT NULL,
    ign TEXT NOT NULL,
    ign_norm TEXT NOT NULL,
    pokemon_species TEXT NOT NULL,
    bonus_points INTEGER NOT NULL,
    awarded_at INTEGER NOT NULL,
    UNIQUE(event_id, discord_id, pokemon_species),
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
  )`);

  await run(`CREATE TABLE IF NOT EXISTS exp_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    guild_id TEXT NOT NULL,
    ign TEXT NOT NULL,
    ign_norm TEXT NOT NULL,
    snapshot_type TEXT NOT NULL,
    pokemon_count INTEGER,
    experience INTEGER NOT NULL,
    source TEXT,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(event_id, ign_norm, snapshot_type),
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
  )`);

  await run(`CREATE TABLE IF NOT EXISTS exp_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    guild_id TEXT NOT NULL,
    ign TEXT NOT NULL,
    ign_norm TEXT NOT NULL,
    start_exp INTEGER NOT NULL,
    end_exp INTEGER NOT NULL,
    exp_gained INTEGER NOT NULL,
    base_exp_points INTEGER NOT NULL,
    bonus_exp_points INTEGER NOT NULL,
    total_exp_points INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(event_id, ign_norm),
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
  )`);

  await run(`CREATE TABLE IF NOT EXISTS point_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    guild_id TEXT NOT NULL,
    discord_id TEXT,
    ign TEXT,
    ign_norm TEXT,
    points INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
  )`);
}

async function createEvent(row) {
  const res = await run(
    `INSERT INTO events
      (guild_id, name, start_time, end_time, status, announcement_channel_id, log_channel_id,
       verification_channel_id, staff_role_id, reward_config_json, created_by, created_at, wipe_after)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.guild_id,
      row.name,
      row.start_time,
      row.end_time,
      row.status,
      row.announcement_channel_id,
      row.log_channel_id,
      row.verification_channel_id,
      row.staff_role_id,
      row.reward_config_json,
      row.created_by,
      row.created_at,
      row.wipe_after || null
    ]
  );
  return res.lastID;
}

async function getEventById(id) {
  return await get(`SELECT * FROM events WHERE id = ? LIMIT 1`, [id]);
}

async function getCurrentEvent(guildId) {
  return await get(
    `SELECT * FROM events
     WHERE guild_id = ? AND status IN ('SCHEDULED', 'ACTIVE', 'PENDING_EXP')
     ORDER BY start_time ASC
     LIMIT 1`,
    [guildId]
  );
}

async function getActiveEvent(guildId) {
  return await get(
    `SELECT * FROM events WHERE guild_id = ? AND status = 'ACTIVE' LIMIT 1`,
    [guildId]
  );
}

async function getLeaderboard(eventId, limit = 35) {
  return await all(
    `SELECT ign, points FROM event_users
     WHERE event_id = ?
     ORDER BY points DESC, ign COLLATE NOCASE ASC
     LIMIT ?`,
    [eventId, limit]
  );
}

async function getEventsToStart(now) {
  return await all(`SELECT * FROM events WHERE status = 'SCHEDULED' AND start_time <= ?`, [now]);
}

async function getEventsToEnd(now) {
  return await all(`SELECT * FROM events WHERE status = 'ACTIVE' AND end_time <= ?`, [now]);
}

async function updateEvent(id, patch) {
  const keys = Object.keys(patch || {});
  if (!keys.length) return;
  const sets = keys.map((key) => `${key} = ?`).join(', ');
  const params = keys.map((key) => patch[key]);
  params.push(id);
  await run(`UPDATE events SET ${sets} WHERE id = ?`, params);
}

async function upsertEventUser({ event_id, guild_id, discord_id, ign }) {
  const ignNorm = normIgn(ign);
  const timestamp = nowMs();
  await run(
    `INSERT INTO event_users (event_id, guild_id, discord_id, ign, ign_norm, points, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT(event_id, discord_id) DO UPDATE SET
       ign = excluded.ign,
       ign_norm = excluded.ign_norm,
       updated_at = excluded.updated_at`,
    [event_id, guild_id, discord_id, ign, ignNorm, timestamp, timestamp]
  );
  return { ign, ignNorm };
}

async function addEventUserPoints({ event_id, guild_id, discord_id, ign, points, reason }) {
  const { ignNorm } = await upsertEventUser({ event_id, guild_id, discord_id, ign });
  await run(
    `UPDATE event_users SET points = points + ?, updated_at = ?
     WHERE event_id = ? AND discord_id = ?`,
    [points, nowMs(), event_id, discord_id]
  );
  await run(
    `INSERT INTO point_logs (event_id, guild_id, discord_id, ign, ign_norm, points, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [event_id, guild_id, discord_id, ign, ignNorm, points, reason, nowMs()]
  );
}

module.exports = {
  init,
  run,
  get,
  all,
  nowMs,
  normIgn,
  createEvent,
  getEventById,
  getCurrentEvent,
  getActiveEvent,
  getLeaderboard,
  getEventsToStart,
  getEventsToEnd,
  updateEvent,
  upsertEventUser,
  addEventUserPoints
};
