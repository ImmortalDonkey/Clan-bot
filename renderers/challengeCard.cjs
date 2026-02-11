const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const { getPokemonByKey, getPokemonByName } = require('../utils/sharedPokemon.cjs');

const CARD_WIDTH = 2200;
const CARD_HEIGHT = 1300;

// ───────── OUTER EDGE CONFIG (copied from report card) ─────────
const EDGE = 26;
const EDGE_RADIUS = EDGE * 4.6;

// Increased padding to create more space to the outer border
const MARGIN = 80;

// Output directory
const CARDS_DIR = path.join(__dirname, 'card-images');

if (!fs.existsSync(CARDS_DIR)) {
  fs.mkdirSync(CARDS_DIR, { recursive: true });
}

// Rarity styles (match bounty)
const rarityStyles = {
  paradox: {
    gradientFrom: '#3b82f6',
    gradientTo: '#a855f7',
    boxColor: 'rgba(15, 23, 42, 0.95)'
  },
  roamerMonth: {
    gradientFrom: '#f97316',
    gradientTo: '#ec4899',
    boxColor: 'rgba(17, 24, 39, 0.95)'
  },
  legendary: {
    gradientFrom: '#1d4ed8',
    gradientTo: '#22d3ee',
    boxColor: 'rgba(15, 23, 42, 0.95)'
  },
  rare: {
    gradientFrom: '#1d4ed8',
    gradientTo: '#22d3ee',
    boxColor: 'rgba(15, 23, 42, 0.95)'
  },
  common: {
    gradientFrom: '#16a34a',
    gradientTo: '#0f766e',
    boxColor: 'rgba(5, 46, 22, 0.95)'
  }
};

function getStyleForRarity(key) {
  return rarityStyles[key] || rarityStyles.common;
}

// Pokémon colour
const rarityTextColors = {
  common: '#ffffff',
  rare: '#60a5fa',
  legendary: '#a78bfa',
  roamerMonth: '#f87171',
  paradox: '#fde047'
};

// Rank → outline + name colour
const RANK_THEME = {
  Member: { outline: '#ef4444', name: '#ef4444' },
  Elite: { outline: '#dc2626', name: '#dc2626' },
  'Co-Leader': { outline: '#b91c1c', name: '#b91c1c' },
  Leader: { outline: '#991b1b', name: '#991b1b' }
};

function themeForRank(rankName) {
  return RANK_THEME[rankName] || RANK_THEME.Member;
}

/* ────────────────────────────── */
/* HELPERS                       */
/* ────────────────────────────── */

function roundedRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapPlainText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function wrapStyledTokens(ctx, tokens, maxWidth) {
  const lines = [];
  let current = [];
  let width = 0;

  const pushLine = () => {
    if (current.length) lines.push(current);
    current = [];
    width = 0;
  };

  for (const t of tokens) {
    const parts = String(t.text || '')
      .split(/(\s+)/)
      .filter(Boolean);

    for (const part of parts) {
      const w = ctx.measureText(part).width;
      if (width + w > maxWidth && current.length) pushLine();
      current.push({ text: part, kind: t.kind });
      width += w;
    }
  }

  pushLine();
  return lines;
}

function drawPiece(ctx, text, x, y, kind, theme) {
  ctx.textBaseline = 'top';

  if (kind === 'issuer') {
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = theme.issuerColor;
    ctx.fillText(text, x, y);
    return;
  }

  if (kind === 'pokemon') {
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = theme.pokemonColor;
    ctx.fillText(text, x, y);
    return;
  }

  if (kind === 'duration') {
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y);
    const w = ctx.measureText(text).width;
    const underlineY = y + theme.lineHeight - 10;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x, underlineY);
    ctx.lineTo(x + w, underlineY);
    ctx.stroke();
    return;
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
}

function resolveSpritePath(spritePath) {
  if (!spritePath) return null;

  if (path.isAbsolute(spritePath)) {
    return fs.existsSync(spritePath) ? spritePath : null;
  }

  const p1 = path.resolve('/home/pi/shared-data', spritePath);
  if (fs.existsSync(p1)) return p1;

  const p2 = path.resolve(process.cwd(), spritePath);
  if (fs.existsSync(p2)) return p2;

  return null;
}

async function getPokemonRow(pokemonNameOrKey) {
  let row = await getPokemonByKey(pokemonNameOrKey).catch(() => null);
  if (row) return row;
  return await getPokemonByName(pokemonNameOrKey).catch(() => null);
}

/* ────────────────────────────── */
/* MAIN                          */
/* ────────────────────────────── */

async function createChallengeCard(options) {
  const {
    challengeId,
    issuedBy,
    rankName,
    rarityKey,
    pokemonName,
    startLabel,
    endLabel,
    durationLabel,
    note,
    pointsLabel,
    backgroundPath
  } = options;

  const pokeRow = await getPokemonRow(pokemonName);
  const displayName = pokeRow?.display_name || pokemonName || 'Pokémon';
  const spritePath = resolveSpritePath(pokeRow?.sprite_path);

  const effectiveRarityKey = pokeRow?.rarity || rarityKey || 'common';
  const style = getStyleForRarity(effectiveRarityKey);
  const rankTheme = themeForRank(rankName);

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.save();
  roundedRectPath(ctx, EDGE / 2, EDGE / 2, CARD_WIDTH - EDGE, CARD_HEIGHT - EDGE, EDGE_RADIUS);
  ctx.clip();

  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bg.addColorStop(0, style.gradientFrom);
  bg.addColorStop(1, style.gradientTo);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const totalInnerWidth = CARD_WIDTH - MARGIN * 3;
  const imageSize = Math.min(totalInnerWidth * 0.4, CARD_HEIGHT - 2 * MARGIN);
  const rightX = CARD_WIDTH - MARGIN - imageSize;
  const rightY = MARGIN + ((CARD_HEIGHT - 2 * MARGIN - imageSize) / 2);

  ctx.save();
  roundedRectPath(ctx, rightX, rightY, imageSize, imageSize, 40);
  ctx.clip();

  if (spritePath) {
    const img = await loadImage(spritePath);
    const scale = Math.min(imageSize / img.width, imageSize / img.height);
    ctx.drawImage(
      img,
      rightX + (imageSize - img.width * scale) / 2,
      rightY + (imageSize - img.height * scale) / 2,
      img.width * scale,
      img.height * scale
    );
  }
  ctx.restore();

  const leftX = MARGIN;
  const leftWidth = rightX - leftX - MARGIN;
  const FONT_SIZE = 55;
  const lineHeight = FONT_SIZE * 1.25;

  ctx.font = `bold ${FONT_SIZE}px sans-serif`;

  const narrativeTokens = [
    { kind: 'issuer', text: issuedBy },
    { kind: 'normal', text: ' has issued a new challenge. Catch a ' },
    { kind: 'pokemon', text: displayName },
    { kind: 'normal', text: ' within ' },
    { kind: 'duration', text: durationLabel },
    { kind: 'normal', text: '.' }
  ];

  let y = MARGIN + 80;
  for (const line of wrapStyledTokens(ctx, narrativeTokens, leftWidth - 110)) {
    let x = leftX + 55;
    for (const p of line) {
      drawPiece(ctx, p.text, x, y, p.kind, {
        issuerColor: rankTheme.name,
        pokemonColor: rarityTextColors[effectiveRarityKey],
        lineHeight
      });
      x += ctx.measureText(p.text).width;
    }
    y += lineHeight;
  }

  y += lineHeight * 0.8;

  ctx.fillStyle = '#facc15';
  ctx.fillText('Reward:', leftX + 55, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(pointsLabel, leftX + 300, y);
  y += lineHeight * 1.4;

  ctx.fillStyle = '#facc15';
  ctx.fillText('Start time:', leftX + 55, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(startLabel, leftX + 300, y);
  y += lineHeight;

  ctx.fillStyle = '#facc15';
  ctx.fillText('End time:', leftX + 55, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(endLabel, leftX + 300, y);

  ctx.restore();

  ctx.save();
  roundedRectPath(ctx, EDGE / 2, EDGE / 2, CARD_WIDTH - EDGE, CARD_HEIGHT - EDGE, EDGE_RADIUS);
  ctx.lineWidth = EDGE;
  ctx.strokeStyle = rankTheme.outline;
  ctx.stroke();
  ctx.restore();

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(CARDS_DIR, `challenge_${challengeId}.png`), buffer);
  return buffer;
}

module.exports = { createChallengeCard };