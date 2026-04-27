function parseNumberToken(token) {
  if (!token) return null;

  const raw = String(token).trim().toLowerCase().replace(/,/g, '');
  const match = raw.match(/^(\d+(?:\.\d+)?)([km])?$/);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;

  const suffix = match[2];
  if (suffix === 'k') return Math.round(value * 1_000);
  if (suffix === 'm') return Math.round(value * 1_000_000);
  return Math.round(value);
}

function isIgnoredLine(line) {
  const l = line.trim().toLowerCase();
  if (!l) return true;
  if (['user', 'pokemon', 'pokémon', 'exp', 'exp.', 'experience', 'wins', 'leader'].includes(l)) return true;
  if (l.startsWith('t:') || l.startsWith('s:')) return true;
  return false;
}

function parseExpTable(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => !isIgnoredLine(line));

  const rows = [];
  const seen = new Set();

  for (const line of lines) {
    const cleaned = line
      .replace(/\bT:\s*\S+/gi, '')
      .replace(/\bS:\s*\S+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) continue;

    const parts = cleaned.split(' ');
    const ign = parts[0];

    if (!/^[A-Za-z0-9_.-]{2,32}$/.test(ign)) continue;

    const numberTokens = parts.slice(1).filter(part => /^\d[\d,.]*(?:[km])?$/i.test(part));
    if (!numberTokens.length) continue;

    // The EXP column is the largest meaningful number in the row.
    // This ignores Pokémon count and wins while handling 976.3k / 1.5m / 917,800,000.
    const parsedNumbers = numberTokens
      .map(token => ({ token, value: parseNumberToken(token) }))
      .filter(item => item.value !== null);

    if (!parsedNumbers.length) continue;

    const experience = parsedNumbers.reduce((max, item) => item.value > max ? item.value : max, 0);

    const key = ign.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({ ign, ign_norm: key, experience });
  }

  return rows;
}

function calculateExpPoints(expGained) {
  const gained = Math.max(0, Number(expGained) || 0);
  const base = Math.floor(gained / 200_000);
  const bonus = Math.floor(gained / 5_000_000) * 10;
  return {
    exp_gained: gained,
    base_exp_points: base,
    bonus_exp_points: bonus,
    total_exp_points: base + bonus
  };
}

module.exports = {
  parseExpTable,
  parseNumberToken,
  calculateExpPoints
};
