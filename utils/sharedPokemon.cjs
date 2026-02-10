const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');

// 🔒 HARD-LOCKED shared DB path
const SHARED_DB_PATH = '/home/pi/shared-data/shared.db';

// Safety check
if (!fs.existsSync(SHARED_DB_PATH)) {
  throw new Error(`❌ Shared Pokémon DB not found at ${SHARED_DB_PATH}`);
}

// Open DB (read-only)
const db = new sqlite3.Database(
  SHARED_DB_PATH,
  sqlite3.OPEN_READONLY,
  (err) => {
    if (err) {
      console.error('❌ Failed to open shared Pokémon DB:', err);
    } else {
      console.log('✅ Shared Pokémon DB opened at', SHARED_DB_PATH);
    }
  }
);

// ──────────────────────────────
// Low-level helpers
// ──────────────────────────────
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

// ──────────────────────────────
// Normalisation helpers
// ──────────────────────────────
function normKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function normName(name) {
  return String(name || '').trim();
}

// ──────────────────────────────
// Public API
// ──────────────────────────────

/**
 * Fetch Pokémon by pokemon_key
 * Example key: "latios"
 */
async function getPokemonByKey(pokemonKey) {
  if (!pokemonKey) return null;

  const key = normKey(pokemonKey);

  return await get(
    `
    SELECT
      pokemon_key,
      display_name,
      rarity,
      sprite_path,
      enabled
    FROM shared_pokemon
    WHERE pokemon_key = ?
    LIMIT 1
    `,
    [key]
  );
}

/**
 * Fetch Pokémon by display_name
 * Example name: "Latios"
 */
async function getPokemonByName(displayName) {
  if (!displayName) return null;

  const name = normName(displayName);

  return await get(
    `
    SELECT
      pokemon_key,
      display_name,
      rarity,
      sprite_path,
      enabled
    FROM shared_pokemon
    WHERE display_name = ?
    LIMIT 1
    `,
    [name]
  );
}

module.exports = {
  getPokemonByKey,
  getPokemonByName
};