const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const { getPokemonByKey, getPokemonByName } = require('../utils/sharedPokemon.cjs');

const CARD_WIDTH = 2200;
const CARD_HEIGHT = 1300;

// ───────── OUTER EDGE CONFIG ─────────
const EDGE = 26;
const EDGE_RADIUS = EDGE * 4.6;
const MARGIN = 80;

// Output directory
const CARDS_DIR = path.join(__dirname, 'card-images');
if (!fs.existsSync(CARDS_DIR)) {
  fs.mkdirSync(CARDS_DIR, { recursive: true });
}

// ───────── STYLES ─────────
const rarityStyles = {
  paradox: { gradientFrom: '#3b82f6', gradientTo: '#a855f7', boxColor: 'rgba(15,23,42,0.95)' },
  roamerMonth: { gradientFrom: '#f97316', gradientTo: '#ec4899', boxColor: 'rgba(17,24,39,0.95)' },
  legendary: { gradientFrom: '#1d4ed8', gradientTo: '#22d3ee', boxColor: 'rgba(15,23,42,0.95)' },
  rare: { gradientFrom: '#1d4ed8', gradientTo: '#22d3ee', boxColor: 'rgba(15,23,42,0.95)' },
  common: { gradientFrom: '#16a34a', gradientTo: '#0f766e', boxColor: 'rgba(5,46,22,0.95)' }
};

const rarityTextColors = {
  common: '#ffffff',
  rare: '#60a5fa',
  legendary: '#a78bfa',
  roamerMonth: '#f87171',
  paradox: '#fde047'
};

const RANK_THEME = {
  Member: { outline: '#ef4444', name: '#ef4444' },
  Elite: { outline: '#dc2626', name: '#dc2626' },
  'Co-Leader': { outline: '#b91c1c', name: '#b91c1c' },
  Leader: { outline: '#991b1b', name: '#991b1b' }
};

function getStyleForRarity(key) {
  return rarityStyles[key] || rarityStyles.common;
}

function themeForRank(rank) {
  return RANK_THEME[rank] || RANK_THEME.Member;
}

// ───────── HELPERS ─────────
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
  return lines;
}

function wrapStyledTokens(ctx, tokens, maxWidth) {
  const lines = [];
  let current = [];
  let width = 0;

  const push = () => {
    if (current.length) lines.push(current);
    current = [];
    width = 0;
  };

  for (const t of tokens) {
    const parts = t.text.split(/(\s+)/).filter(Boolean);
    for (const p of parts) {
      const w = ctx.measureText(p).width;
      if (width + w > maxWidth && current.length) push();
      current.push({ text: p, kind: t.kind });
      width += w;
    }
  }
  push();
  return lines;
}

function drawPiece(ctx, text, x, y, kind, theme) {
  ctx.textBaseline = 'top';
  if (kind === 'issuer') {
    ctx.fillStyle = theme.issuerColor;
    ctx.fillText(text, x, y);
    return;
  }
  if (kind === 'pokemon') {
    ctx.fillStyle = theme.pokemonColor;
    ctx.fillText(text, x, y);
    return;
  }
  if (kind === 'duration') {
    ctx.fillStyle = '#fff';
    ctx.fillText(text, x, y);
    const w = ctx.measureText(text).width;
    ctx.beginPath();
    ctx.moveTo(x, y + theme.lineHeight - 8);
    ctx.lineTo(x + w, y + theme.lineHeight - 8);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 5;
    ctx.stroke();
    return;
  }
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x, y);
}

function cleanDuration(label) {
  if (/end of hour/i.test(label)) return '1 hour';
  return label.replace(/^until\s+/i, '');
}

// ───────── MAIN ─────────
async function createChallengeCard(options) {
  const {
    challengeId,
    issuedBy,
    rankName,
    rarityKey,
    rarityLabel,
    pokemonName,
    startLabel,
    endLabel,
    durationLabel,
    note,
    pointsLabel,
    backgroundPath
  } = options;

  const pokeRow =
    (await getPokemonByKey(pokemonName).catch(() => null)) ||
    (await getPokemonByName(pokemonName).catch(() => null));

  const displayName = pokeRow?.display_name || pokemonName;
  const effectiveRarity = pokeRow?.rarity || rarityKey || 'common';
  const style = getStyleForRarity(effectiveRarity);
  const rankTheme = themeForRank(rankName);

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Outer clip
  ctx.save();
  roundedRectPath(ctx, EDGE / 2, EDGE / 2, CARD_WIDTH - EDGE, CARD_HEIGHT - EDGE, EDGE_RADIUS);
  ctx.clip();

  // Background
  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bg.addColorStop(0, style.gradientFrom);
  bg.addColorStop(1, style.gradientTo);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const rightSize = Math.min((CARD_WIDTH - MARGIN * 3) * 0.4, CARD_HEIGHT - MARGIN * 2);
  const rightX = CARD_WIDTH - MARGIN - rightSize;
  const rightY = MARGIN + (CARD_HEIGHT - 2 * MARGIN - rightSize) / 2;

  // Sprite
  if (pokeRow?.sprite_path) {
    try {
      const img = await loadImage(pokeRow.sprite_path);
      const scale = Math.min(rightSize / img.width, rightSize / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, rightX + (rightSize - w) / 2, rightY + (rightSize - h) / 2, w, h);
    } catch {}
  }

  // Text boxes
  const leftX = MARGIN;
  const leftW = rightX - leftX - MARGIN;
  const FONT = 55;
  const LH = FONT * 1.25;
  ctx.font = `bold ${FONT}px sans-serif`;

  const narrative = wrapStyledTokens(ctx, [
    { kind: 'issuer', text: issuedBy },
    { kind: 'normal', text: ' has issued a new challenge. Catch a ' },
    { kind: 'pokemon', text: displayName },
    { kind: 'normal', text: ' within ' },
    { kind: 'duration', text: cleanDuration(durationLabel) },
    { kind: 'normal', text: '.' }
  ], leftW - 110);

  let y = MARGIN + 60;
  for (const line of narrative) {
    let x = leftX + 55;
    for (const p of line) {
      drawPiece(ctx, p.text, x, y, p.kind, {
        issuerColor: rankTheme.name,
        pokemonColor: rarityTextColors[effectiveRarity],
        lineHeight: LH
      });
      x += ctx.measureText(p.text).width;
    }
    y += LH;
  }

  y += LH * 0.6;

  ctx.fillStyle = '#facc15';
  ctx.fillText('Reward:', leftX + 55, y);
  ctx.fillStyle = '#fff';
  ctx.fillText(pointsLabel, leftX + 250, y);

  y += LH * 1.4;

  ctx.fillStyle = '#facc15';
  ctx.fillText('Start time:', leftX + 55, y);
  ctx.fillStyle = '#fff';
  ctx.fillText(startLabel, leftX + 300, y);

  y += LH;

  ctx.fillStyle = '#facc15';
  ctx.fillText('End time:', leftX + 55, y);
  ctx.fillStyle = '#fff';
  ctx.fillText(endLabel, leftX + 300, y);

  // Note box – exactly 2 lines
  const noteBoxH = LH * 2 + 80;
  const noteY = CARD_HEIGHT - MARGIN - noteBoxH;

  roundedRectPath(ctx, leftX, noteY, leftW, noteBoxH, 40);
  ctx.fillStyle = style.boxColor;
  ctx.fill();
  ctx.lineWidth = 20;
  ctx.strokeStyle = rankTheme.outline;
  ctx.stroke();

  const noteLines = wrapPlainText(ctx, note, leftW - 110).slice(0, 2);
  let ny = noteY + (noteBoxH - noteLines.length * LH) / 2;
  ctx.fillStyle = '#fff';
  for (const l of noteLines) {
    ctx.fillText(l, leftX + 55, ny);
    ny += LH;
  }

  ctx.restore();

  // Outer border
  roundedRectPath(ctx, EDGE / 2, EDGE / 2, CARD_WIDTH - EDGE, CARD_HEIGHT - EDGE, EDGE_RADIUS);
  ctx.lineWidth = EDGE;
  ctx.strokeStyle = rankTheme.outline;
  ctx.stroke();

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(CARDS_DIR, `challenge_${challengeId}.png`), buffer);
  return buffer;
}

module.exports = { createChallengeCard };