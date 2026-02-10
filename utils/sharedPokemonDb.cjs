// utils/sharedPokemonDb.cjs
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');

// Absolute path to shared DB
const SHARED_DB_PATH = path.resolve(
  process.env.SHARED_DATA_DIR || '/home/pi/shared-data',
  'shared.db'
);

if (!fs.existsSync(SHARED_DB_PATH)) {
  throw new Error(`❌ Shared Pokémon DB not found at ${SHARED_DB_PATH}`);
}

// Open READ-ONLY connection
const db = new sqlite3.Database(
  SHARED_DB_PATH,
  sqlite3.OPEN_READONLY,
  err => {
    if (err) {
      console.error('❌ Failed to open shared Pokémon DB:', err);
    } else {
      console.log('✅ Shared Pokémon DB connected');
    }
  }
);

/* --------------------------------------------------
 * Low-level helpers (match your style)
 * -------------------------------------------------- */
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

/* --------------------------------------------------
 * Public API
 * -------------------------------------------------- */

/**
 * Get enabled Pokémon row by key
 * @param {string} pokemonKey
 */
async function getPokemonByKey(pokemonKey) {
  if (!pokemonKey) return null;

  return await get(
    `
    SELECT
      pokemon_key,
      display_name,
      rarity,
      sprite_path
    FROM shared_pokemon
    WHERE pokemon_key = ?
      AND enabled = 1
    LIMIT 1
    `,
    [pokemonKey.toLowerCase()]
  );
}

/**
 * Resolve absolute sprite path
 * @param {string} pokemonKey
 */
async function getPokemonSpritePath(pokemonKey) {
  const row = await getPokemonByKey(pokemonKey);
  if (!row || !row.sprite_path) return null;

  // Absolute path stored
  if (path.isAbsolute(row.sprite_path)) {
    return fs.existsSync(row.sprite_path) ? row.sprite_path : null;
  }

  // Relative path → resolve from project root
  const resolved = path.resolve(process.cwd(), row.sprite_path);
  return fs.existsSync(resolved) ? resolved : null;
}

/**
 * Display name helper
 */
async function getPokemonDisplayName(pokemonKey) {
  const row = await getPokemonByKey(pokemonKey);
  return row ? row.display_name : null;
}

/**
 * Rarity helper
 */
async function getPokemonRarity(pokemonKey) {
  const row = await getPokemonByKey(pokemonKey);
  return row ? row.rarity : null;
}

module.exports = {
  getPokemonByKey,
  getPokemonSpritePath,
  getPokemonDisplayName,
  getPokemonRarity
};