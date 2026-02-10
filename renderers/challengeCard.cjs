// renderers/challengeCard.cjs
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const CARD_WIDTH = 2200;
const CARD_HEIGHT = 1300;
const MARGIN = 40;

// NOTE: card images saved here
const CARDS_DIR = path.join(__dirname, 'card-images');
// NOTE: sprites are in the root /sprites folder (one level up)
const SPRITES_DIR = path.join(__dirname, '..', 'sprites');

// Ensure output folder exists
if (!fs.existsSync(CARDS_DIR)) {
  fs.mkdirSync(CARDS_DIR, { recursive: true });
}

// Rarity styles: gradient + box colour
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

// Simple word-wrap helper
function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  if (!lines.length) lines.push('');
  return lines;
}

// Map Pokémon name → sprite path
function getSpritePathForPokemon(name) {
  if (!name) return null;
  return path.join(SPRITES_DIR, `${name}.png`);
}

// Draw a single sprite box
async function drawSpriteBox(ctx, x, y, size, pokemonName) {
  ctx.save();
  roundedRectPath(ctx, x, y, size, size, 30);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.98)';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#f9fafb';
  ctx.stroke();

  const spritePath = getSpritePathForPokemon(pokemonName);
  let img = null;

  try {
    if (spritePath && fs.existsSync(spritePath)) {
      img = await loadImage(spritePath);
    }
  } catch {}

  if (img) {
    const pad = size * 0.12;
    const maxW = size - pad * 2;
    const maxH = size - pad * 2;
    const aspect = img.width / img.height;

    let w = maxW;
    let h = maxH;

    if (aspect > 1) h = maxW / aspect;
    else w = maxH * aspect;

    ctx.drawImage(
      img,
      x + (size - w) / 2,
      y + (size - h) / 2,
      w,
      h
    );
  }

  ctx.restore();
}

/**
 * createChallengeCard
 *
 * Mirrors createBountyCard exactly.
 *
 * options:
 *  - challengeId
 *  - clanName
 *  - rarityKey
 *  - rarityLabel
 *  - pokemons[]
 *  - startLabel
 *  - endLabel
 *  - durationLabel
 *  - note
 *  - pointsLabel
 *  - avatarUrl
 */
async function createChallengeCard(options) {
  const {
    challengeId,
    clanName,
    rarityKey,
    rarityLabel,
    pokemons,
    startLabel,
    endLabel,
    durationLabel,
    note,
    pointsLabel,
    avatarUrl
  } = options;

  const style = getStyleForRarity(rarityKey);

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  gradient.addColorStop(0, style.gradientFrom);
  gradient.addColorStop(1, style.gradientTo);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Layout
  const totalInnerWidth = CARD_WIDTH - MARGIN * 3;
  const rightMaxWidth = totalInnerWidth * 0.4;
  const rightMaxHeight = CARD_HEIGHT - 2 * MARGIN;
  const imageSize = Math.min(rightMaxWidth, rightMaxHeight);

  const rightX = CARD_WIDTH - MARGIN - imageSize;
  const rightY = MARGIN;

  const leftX = MARGIN;
  const leftY = MARGIN;
  const leftWidth = rightX - leftX - MARGIN;
  const leftHeight = CARD_HEIGHT - 2 * MARGIN;

  // Avatar
  ctx.save();
  try {
    const img = await loadImage(avatarUrl);
    const aspect = img.width / img.height;

    let w = imageSize;
    let h = imageSize;
    if (aspect > 1) h = imageSize / aspect;
    else w = imageSize * aspect;

    roundedRectPath(ctx, rightX, rightY, imageSize, imageSize, 40);
    ctx.clip();
    ctx.drawImage(
      img,
      rightX + (imageSize - w) / 2,
      rightY + (imageSize - h) / 2,
      w,
      h
    );

    ctx.restore();
    ctx.save();
    roundedRectPath(ctx, rightX, rightY, imageSize, imageSize, 40);
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(248,250,252,0.9)';
    ctx.stroke();
  } catch {
    ctx.restore();
  }
  ctx.restore();

  // Text layout
  const FONT_SIZE = 55;
  const lineHeight = FONT_SIZE * 1.25;
  const groupSpacing = lineHeight * 0.7;

  const pokemonList = pokemons?.length ? pokemons : ['None'];

  const rows = [
    { label: 'Clan:', value: clanName || 'Clan Challenge' },
    { spacer: true },
    { label: 'Target:', value: pokemonList[0] },
    ...pokemonList.slice(1).map(p => ({ label: '', value: p })),
    { label: 'Rarity:', value: rarityLabel },
    { label: 'Points:', value: pointsLabel },
    { spacer: true },
    { label: 'Start time:', value: startLabel },
    { label: 'Ends:', value: endLabel },
    { label: 'Duration:', value: durationLabel }
  ];

  const infoPaddingX = 50;
  const infoPaddingY = 50;

  const nonSpacer = rows.filter(r => !r.spacer).length;
  const spacerCount = rows.filter(r => r.spacer).length;
  const infoTextHeight =
    nonSpacer * lineHeight + spacerCount * groupSpacing;

  const infoBoxH = infoPaddingY * 2 + infoTextHeight;

  roundedRectPath(ctx, leftX, leftY, leftWidth, infoBoxH, 40);
  ctx.fillStyle = style.boxColor;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#f9fafb';
  ctx.stroke();

  ctx.font = `bold ${FONT_SIZE}px sans-serif`;

  let maxLabelWidth = 0;
  for (const r of rows) {
    if (r.label) {
      maxLabelWidth = Math.max(
        maxLabelWidth,
        ctx.measureText(r.label).width
      );
    }
  }

  let y =
    leftY +
    (infoBoxH - infoTextHeight) / 2;

  for (const r of rows) {
    if (r.spacer) {
      y += groupSpacing;
      continue;
    }

    ctx.fillStyle = '#facc15';
    ctx.fillText(r.label, leftX + infoPaddingX, y);

    ctx.fillStyle = '#f9fafb';
    ctx.fillText(
      r.value || '',
      leftX + infoPaddingX + maxLabelWidth + 50,
      y
    );

    y += lineHeight;
  }

  // Sprites
  const spriteSize = imageSize / 3;
  const spriteY = CARD_HEIGHT - MARGIN - spriteSize;

  for (let i = 0; i < Math.min(3, pokemonList.length); i++) {
    await drawSpriteBox(
      ctx,
      rightX + i * (spriteSize + 30),
      spriteY,
      spriteSize,
      pokemonList[i]
    );
  }

  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join(CARDS_DIR, `challenge_${challengeId}.png`);
  fs.writeFileSync(filePath, buffer);

  return buffer;
}

module.exports = {
  createChallengeCard
};