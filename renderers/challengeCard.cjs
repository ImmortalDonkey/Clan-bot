const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// 🔗 Shared Pokémon helper
const { getPokemonByName } = require('../utils/sharedPokemon.cjs');

const CARD_WIDTH = 2200;
const CARD_HEIGHT = 1300;
const MARGIN = 40;

// Output directory
const CARDS_DIR = path.join(__dirname, 'card-images');

if (!fs.existsSync(CARDS_DIR)) {
  fs.mkdirSync(CARDS_DIR, { recursive: true });
}

// Rarity styles (unchanged)
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
  return lines.length ? lines : [''];
}

/**
 * ACTIVE challenge card renderer
 */
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
    pointsLabel
  } = options;

  const style = getStyleForRarity(rarityKey);

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background
  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bg.addColorStop(0, style.gradientFrom);
  bg.addColorStop(1, style.gradientTo);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = 'rgba(0,0,0,0.20)';
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

  // ──────────────────────────────
  // RIGHT IMAGE — Pokémon sprite (FROM SHARED DB)
  // ──────────────────────────────
  ctx.save();
  roundedRectPath(ctx, rightX, rightY, imageSize, imageSize, 40);
  ctx.clip();

  let spritePath = null;

  try {
    const p = await getPokemonByName(pokemonName);
    if (p && p.enabled && p.sprite_path && fs.existsSync(p.sprite_path)) {
      spritePath = p.sprite_path;
    }
  } catch (err) {
    console.warn('⚠ Failed to fetch sprite from shared DB:', err.message);
  }

  try {
    if (spritePath) {
      const img = await loadImage(spritePath);
      const aspect = img.width / img.height;

      let w = imageSize;
      let h = imageSize;

      if (aspect > 1) h = imageSize / aspect;
      else w = imageSize * aspect;

      ctx.drawImage(
        img,
        rightX + (imageSize - w) / 2,
        rightY + (imageSize - h) / 2,
        w,
        h
      );
    } else {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(rightX, rightY, imageSize, imageSize);
    }
  } catch {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(rightX, rightY, imageSize, imageSize);
  }

  ctx.restore();

  ctx.save();
  roundedRectPath(ctx, rightX, rightY, imageSize, imageSize, 40);
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.9)';
  ctx.stroke();
  ctx.restore();

  // ──────────────────────────────
  // LEFT COLUMN (UNCHANGED)
  // ──────────────────────────────
  const boxGap = 40;
  const FONT_SIZE = 55;
  const lineHeight = FONT_SIZE * 1.25;
  const groupSpacing = lineHeight * 0.7;

  const labelColor = '#facc15';
  const valueColor = '#f9fafb';

  const infoRows = [
    { label: 'Issued by:', value: issuedBy },
    { label: 'Rank:', value: rankName },
    { spacer: true },
    { label: 'Target:', value: pokemonName || 'None' },
    { label: 'Rarity:', value: rarityLabel },
    { label: 'Points:', value: pointsLabel },
    { spacer: true },
    { label: 'Start time:', value: startLabel },
    { label: 'Ends:', value: endLabel },
    { label: 'Duration:', value: durationLabel }
  ];

  const nonSpacerRows = infoRows.filter(r => !r.spacer).length;
  const spacerCount = infoRows.filter(r => r.spacer).length;

  const infoPaddingX = 50;
  const infoPaddingY = 50;
  const notePaddingX = 50;
  const notePaddingY = 40;

  ctx.font = `bold ${FONT_SIZE}px sans-serif`;

  const noteText = note || 'Good luck!';
  const noteLines = wrapText(ctx, noteText, leftWidth - notePaddingX * 2);
  const noteTextHeight = noteLines.length * lineHeight;

  const noteBoxHeight = Math.max(
    notePaddingY * 2 + noteTextHeight,
    notePaddingY * 2 + lineHeight * 2
  );

  const infoTextHeight =
    nonSpacerRows * lineHeight + spacerCount * groupSpacing;

  const infoBoxHeight =
    infoPaddingY * 2 + infoTextHeight;

  const infoBoxX = leftX;
  const infoBoxY = leftY;
  const infoBoxW = leftWidth;
  const infoBoxH = infoBoxHeight;

  const noteBoxX = leftX;
  const noteBoxY = infoBoxY + infoBoxH + boxGap;
  const noteBoxW = leftWidth;
  const noteBoxH = leftHeight - infoBoxH - boxGap;

  ctx.save();
  roundedRectPath(ctx, infoBoxX, infoBoxY, infoBoxW, infoBoxH, 40);
  ctx.fillStyle = style.boxColor;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#f9fafb';
  ctx.stroke();
  ctx.restore();

  let maxLabelWidth = 0;
  for (const r of infoRows) {
    if (r.label) {
      maxLabelWidth = Math.max(maxLabelWidth, ctx.measureText(r.label).width);
    }
  }

  const labelX = infoBoxX + infoPaddingX;
  const valueX = labelX + maxLabelWidth + 50;

  let y = infoBoxY + (infoBoxH - infoTextHeight) / 2;

  for (const row of infoRows) {
    if (row.spacer) {
      y += groupSpacing;
      continue;
    }
    ctx.fillStyle = labelColor;
    ctx.fillText(row.label, labelX, y);

    ctx.fillStyle = valueColor;
    ctx.fillText(row.value || '', valueX, y);

    y += lineHeight;
  }

  ctx.save();
  roundedRectPath(ctx, noteBoxX, noteBoxY, noteBoxW, noteBoxH, 40);
  ctx.fillStyle = style.boxColor;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#f9fafb';
  ctx.stroke();
  ctx.restore();

  let ny = noteBoxY + (noteBoxH - noteTextHeight) / 2;
  for (const line of noteLines) {
    ctx.fillStyle = valueColor;
    ctx.fillText(line, noteBoxX + notePaddingX, ny);
    ny += lineHeight;
  }

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(
    path.join(CARDS_DIR, `challenge_${challengeId}.png`),
    buffer
  );

  return buffer;
}

module.exports = { createChallengeCard };