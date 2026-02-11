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
  return String(ign || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/* ────────────────────────────── */
/* INIT                           */
/* ────────────────────────────── */

async function init() {
  await run(`CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    issuer_id TEXT NOT NULL,
    issuer_name TEXT,
    pokemons_json TEXT NOT NULL,
    notes TEXT,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    duration_hours INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,

    card_channel_id TEXT,
    card_message_id TEXT,

    winner_id TEXT,
    winner_claim_id INTEGER
  )`);

  await run(`CREATE TABLE IF NOT EXISTS challenge_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    hunter_id TEXT NOT NULL,
    ign TEXT,
    ign_norm TEXT,
    pokemon_id TEXT,
    proof TEXT,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    resolved_at INTEGER,
    resolver_id TEXT,
    claim_thread_id TEXT,
    claim_message_id TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS players (
    discord_id TEXT PRIMARY KEY,
    ign TEXT,
    ign_norm TEXT,
    updated_at INTEGER
  )`);
  await run(`CREATE INDEX IF NOT EXISTS idx_players_ign_norm ON players(ign_norm)`);

  await run(`CREATE TABLE IF NOT EXISTS points (
    guild_id TEXT NOT NULL,
    discord_id TEXT NOT NULL,
    points INTEGER DEFAULT 0,
    completed_challenges INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, discord_id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS ign_points (
    guild_id TEXT NOT NULL,
    ign_norm TEXT NOT NULL,
    ign TEXT,
    points INTEGER DEFAULT 0,
    completed_challenges INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, ign_norm)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS point_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    discord_id TEXT,
    ign_norm TEXT,
    points INTEGER NOT NULL,
    reason TEXT,
    created_at INTEGER NOT NULL
  )`);
}

/* ────────────────────────────── */
/* CHALLENGE HELPERS (PATCH)      */
/* ────────────────────────────── */

/**
 * SINGLE SOURCE OF TRUTH for duration text.
 * This prevents renderer bugs permanently.
 */
function formatChallengeDuration(challenge) {
  if (!challenge) return null;

  // Preferred: explicit duration_hours
  if (Number.isInteger(challenge.duration_hours)) {
    const h = challenge.duration_hours;
    return h === 1 ? '1 hour' : `${h} hours`;
  }

  // Fallback: derive from timestamps (defensive only)
  if (challenge.start_time && challenge.end_time) {
    const diffMs = challenge.end_time - challenge.start_time;
    const hours = Math.round(diffMs / (60 * 60 * 1000));
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }

  return null;
}

/* ────────────────────────────── */
/* CHALLENGES                     */
/* ────────────────────────────── */

async function createChallenge(row) {
  if (!Number.isInteger(row.duration_hours)) {
    throw new Error('❌ duration_hours is required and must be an integer');
  }

  await run(
    `INSERT INTO challenges
      (id, guild_id, issuer_id, issuer_name, pokemons_json, notes,
       start_time, end_time, duration_hours, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.guild_id,
      row.issuer_id,
      row.issuer_name || null,
      row.pokemons_json,
      row.notes || null,
      row.start_time,
      row.end_time,
      row.duration_hours,
      row.status,
      row.created_at
    ]
  );
}

async function getChallengeById(id) {
  return await get(`SELECT * FROM challenges WHERE id = ? LIMIT 1`, [id]);
}

async function updateChallenge(id, patch) {
  const keys = Object.keys(patch || {});
  if (!keys.length) return;

  const sets = keys.map(k => `${k} = ?`).join(', ');
  const params = keys.map(k => patch[k]);
  params.push(id);

  await run(`UPDATE challenges SET ${sets} WHERE id = ?`, params);
}

async function getChallengesByStatus(status) {
  return await all(`SELECT * FROM challenges WHERE status = ?`, [status]);
}

async function getChallengesToStart(now) {
  return await all(
    `SELECT * FROM challenges
     WHERE status = 'scheduled' AND start_time <= ?`,
    [now]
  );
}

async function getChallengesToExpire(now) {
  return await all(
    `SELECT * FROM challenges
     WHERE status = 'open' AND end_time <= ?`,
    [now]
  );
}

/* ────────────────────────────── */
/* CLAIMS                         */
/* ────────────────────────────── */

async function createChallengeClaim(row) {
  const res = await run(
    `INSERT INTO challenge_claims
      (challenge_id, guild_id, hunter_id, ign, ign_norm, pokemon_id, proof, status, created_at, claim_thread_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.challenge_id,
      row.guild_id,
      row.hunter_id,
      row.ign || null,
      row.ign_norm || null,
      row.pokemon_id || null,
      row.proof || null,
      row.status,
      row.created_at,
      row.claim_thread_id || null
    ]
  );
  return res.lastID;
}

async function getChallengeClaimById(id) {
  return await get(`SELECT * FROM challenge_claims WHERE id = ? LIMIT 1`, [id]);
}

async function updateChallengeClaim(id, patch) {
  const keys = Object.keys(patch || {});
  if (!keys.length) return;

  const sets = keys.map(k => `${k} = ?`).join(', ');
  const params = keys.map(k => patch[k]);
  params.push(id);

  await run(`UPDATE challenge_claims SET ${sets} WHERE id = ?`, params);
}

async function hasPendingClaim(challengeId, hunterId) {
  const row = await get(
    `SELECT 1 FROM challenge_claims
     WHERE challenge_id = ? AND hunter_id = ? AND status = 'pending'
     LIMIT 1`,
    [challengeId, hunterId]
  );
  return !!row;
}

/* ────────────────────────────── */
/* IGN LINKS                      */
/* ────────────────────────────── */

async function upsertPlayerIgn(discordId, ign) {
  const ignNorm = normIgn(ign);
  await run(
    `INSERT INTO players (discord_id, ign, ign_norm, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(discord_id) DO UPDATE SET
       ign = excluded.ign,
       ign_norm = excluded.ign_norm,
       updated_at = excluded.updated_at`,
    [discordId, ign, ignNorm, nowMs()]
  );
  return { ign, ignNorm };
}

async function getPlayerByDiscordId(discordId) {
  return await get(`SELECT * FROM players WHERE discord_id = ? LIMIT 1`, [discordId]);
}

/* ────────────────────────────── */
/* POINTS                        */
/* ────────────────────────────── */

async function addDiscordPoints(guildId, discordId, points, reason) {
  await run(
    `INSERT INTO points (guild_id, discord_id, points, completed_challenges)
     VALUES (?, ?, ?, 0)
     ON CONFLICT(guild_id, discord_id) DO UPDATE SET
       points = points.points + excluded.points`,
    [guildId, discordId, points]
  );

  await run(
    `INSERT INTO point_logs (guild_id, discord_id, ign_norm, points, reason, created_at)
     VALUES (?, ?, NULL, ?, ?, ?)`,
    [guildId, discordId, points, reason || null, nowMs()]
  );
}

async function addIgnPoints(guildId, ign, points, reason) {
  const ignNorm = normIgn(ign);

  await run(
    `INSERT INTO ign_points (guild_id, ign_norm, ign, points, completed_challenges)
     VALUES (?, ?, ?, ?, 0)
     ON CONFLICT(guild_id, ign_norm) DO UPDATE SET
       ign = excluded.ign,
       points = ign_points.points + excluded.points`,
    [guildId, ignNorm, ign, points]
  );

  await run(
    `INSERT INTO point_logs (guild_id, discord_id, ign_norm, points, reason, created_at)
     VALUES (?, NULL, ?, ?, ?, ?)`,
    [guildId, ignNorm, points, reason || null, nowMs()]
  );
}

async function incCompletedChallengeDiscord(guildId, discordId) {
  await run(
    `INSERT INTO points (guild_id, discord_id, points, completed_challenges)
     VALUES (?, ?, 0, 1)
     ON CONFLICT(guild_id, discord_id) DO UPDATE SET
       completed_challenges = points.completed_challenges + 1`,
    [guildId, discordId]
  );
}

async function incCompletedChallengeIgn(guildId, ign) {
  const ignNorm = normIgn(ign);
  await run(
    `INSERT INTO ign_points (guild_id, ign_norm, ign, points, completed_challenges)
     VALUES (?, ?, ?, 0, 1)
     ON CONFLICT(guild_id, ign_norm) DO UPDATE SET
       completed_challenges = ign_points.completed_challenges + 1`,
    [guildId, ignNorm, ign]
  );
}

/* ────────────────────────────── */
/* EXPORTS                       */
/* ────────────────────────────── */

module.exports = {
  init,

  // challenge
  createChallenge,
  getChallengeById,
  updateChallenge,
  getChallengesByStatus,
  getChallengesToStart,
  getChallengesToExpire,
  formatChallengeDuration, // ← NEW, CANONICAL

  // claim
  createChallengeClaim,
  getChallengeClaimById,
  updateChallengeClaim,
  hasPendingClaim,

  // ign
  upsertPlayerIgn,
  getPlayerByDiscordId,

  // points
  addDiscordPoints,
  addIgnPoints,
  incCompletedChallengeDiscord,
  incCompletedChallengeIgn,

  // utils
  normIgn
};