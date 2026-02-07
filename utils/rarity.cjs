// utils/rarity.cjs
// Keys match the existing roaming bot style, plus "starter".

const rarityGroups = {
  roamerMonth: [
    "Clone Venusaur", "Clone Charizard", "Clone Blastoise",
    "Ancient Jigglypuff", "Ancient Alakazam", "Ancient Gengar",
    "Crystal Onix", "Pink Rhyhorn", "Snorlax (Snowman)",
    "Mewtwo (Shadow)", "Golden Sudowoodo", "XD001", "Reddy",
    "Meta Groudon", "Rayquaza (Illusion)", "Dialga (Primal)", "Z2"
  ],
  paradox: [
    "Walking Wake", "Gouging Fire", "Raging Bolt",
    "Iron Leaves", "Iron Boulder", "Iron Crown"
  ],
  legendary: [
    "Raikou", "Entei", "Suicune",
    "Latias", "Latios",
    "Glastrier", "Spectrier",
    "Koraidon", "Miraidon"
  ],
  // Optional: you can populate this later
  starter: [],
  rare: ["Cyclizar", "Gimmighoul (Roaming)"],
  common: ["Zygarde (Cell)", "Bramblin", "Bombirdier", "Varoom"]
};

const rarityPriority = ['paradox', 'roamerMonth', 'legendary', 'starter', 'rare', 'common'];

function getRarity(pokemonName) {
  const name = String(pokemonName || '').toLowerCase().trim();
  for (const key of rarityPriority) {
    const list = rarityGroups[key] || [];
    if (list.some(p => String(p).toLowerCase() === name)) return key;
  }
  return 'common';
}

function getHighestRarityForList(pokemonNames = []) {
  if (!pokemonNames.length) return 'common';
  let best = 'common';
  for (const n of pokemonNames) {
    const r = getRarity(n);
    if (rarityPriority.indexOf(r) < rarityPriority.indexOf(best)) best = r;
  }
  return best;
}

function getRarityDisplayLabel(key) {
  if (key === 'paradox') return 'Paradox';
  if (key === 'roamerMonth') return 'Roamer of the Month';
  if (key === 'legendary') return 'Legendary';
  if (key === 'starter') return 'Starter';
  if (key === 'rare') return 'Rare';
  return 'Common';
}

function pointsForRarity(key) {
  if (key === 'paradox') return 100;
  if (key === 'roamerMonth') return 15;
  if (key === 'legendary' || key === 'rare' || key === 'starter') return 10;
  return 1; // common + fallback
}

module.exports = {
  rarityGroups,
  rarityPriority,
  getRarity,
  getHighestRarityForList,
  getRarityDisplayLabel,
  pointsForRarity
};