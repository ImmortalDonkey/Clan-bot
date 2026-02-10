// utils/sharedPokemonDb.cjs
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// Absolute path to shared DB
const SHARED_DB_PATH = path.resolve(
  process.env.SHARED_DATA_DIR || '/home/pi/shared-data',
  'shared.db'
);

// Sanity check early
if (!fs.existsSync(SHARED_DB_PATH)) {
  throw new Error(`❌ Shared Pokémon DB not found at ${SHARED_DB_PATH}`);
}

// Open read-only connection
const db = new Database(SHARED_DB_PATH, {
  readonly: true,
  fileMustExist: true
});

/**
 * Get a Pokémon row by pokemon_key
 * @param {string} pokemonKey
 * @returns {object|null}
 */
function getPokemonByKey(pokemonKey) {
  if (!pokemonKey) return null;

  const row = db
    .prepare(
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
      `
    )
    .get(pokemonKey.toLowerCase());

  return row || null;
}

/**
 * Resolve absolute sprite path for a Pokémon
 * @param {string} pokemonKey
 * @returns {string|null}
 */
function getPokemonSpritePath(pokemonKey) {
  const row = getPokemonByKey(pokemonKey);
  if (!row || !row.sprite_path) return null;

  // If path is already absolute, trust it
  if (path.isAbsolute(row.sprite_path)) {
    return fs.existsSync(row.sprite_path) ? row.sprite_path : null;
  }

  // Otherwise resolve relative to project root
  const resolved = path.resolve(process.cwd(), row.sprite_path);
  return fs.existsSync(resolved) ? resolved : null;
}

/**
 * Get display-safe Pokémon name
 * @param {string} pokemonKey
 * @returns {string|null}
 */
function getPokemonDisplayName(pokemonKey) {
  const row = getPokemonByKey(pokemonKey);
  return row ? row.display_name : null;
}

/**
 * Get rarity key (as stored)
 * @param {string} pokemonKey
 * @returns {string|null}
 */
function getPokemonRarity(pokemonKey) {
  const row = getPokemonByKey(pokemonKey);
  return row ? row.rarity : null;
}

module.exports = {
  getPokemonByKey,
  getPokemonSpritePath,
  getPokemonDisplayName,
  getPokemonRarity
};