// renderers/challengeCard.cjs
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const { getPokemonByKey, getPokemonByName } = require('../utils/sharedPokemon.cjs');

const CARD_WIDTH = 2200;
const CARD_HEIGHT = 1300;
const MARGIN = 40;

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

// Simple word-wrap helper (match bounty style)
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

// Resolve sprite path coming from shared DB
function resolveSpritePath(spritePath) {
  if (!spritePath) return null;

  // Absolute path stored in DB
  if (path.isAbsolute(spritePath)) {
    return fs.existsSync(spritePath) ? spritePath : null;
  }

  // Relative path stored in DB:
  // 1) try relative to shared-data dir
  const sharedBase = '/home/pi/shared-data';
  const p1 = path.resolve(sharedBase, spritePath);
  if (fs.existsSync(p1)) return p1;

  // 2) try relative to project root
  const p2 = path.resolve(process.cwd(), spritePath);
  if (fs.existsSync(p2)) return p2;

  return null;
}

async function getPokemonRow(pokemonNameOrKey) {
  if (!pokemonNameOrKey) return null;

  // Try key first (latios)
  let row = await getPokemonByKey(pokemonNameOrKey).catch(() => null);
  if (row) return row;

  // Then display name (Latios)
  row = await getPokemonByName(pokemonNameOrKey).catch(() => null);
  return row || null;
}

/**
 * ACTIVE challenge card renderer (mirrors bounty active card)
 */
async function createChallengeCard(options) {
  const {
    challengeId,
    issuedBy,
    rankName,
    rarityKey,
    rarityLabel,
    pokemonName, // single pokemon (key or name)
    startLabel,
    endLabel,
    durationLabel,
    note,
    pointsLabel
  } = options;

  const style = getStyleForRarity(rarityKey);

  // Pull sprite path + display name from shared DB
  const pokeRow = await getPokemonRow(pokemonName);
  const displayName = pokeRow?.display_name || pokemonName || 'None';
  const spritePath = resolveSpritePath(pokeRow?.sprite_path);

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bg.addColorStop(0, style.gradientFrom);
  bg.addColorStop(1, style.gradientTo);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Dark overlay (match bounty)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Layout: left text column (~60%), right image column (~40%)
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
  // RIGHT IMAGE — Pokémon sprite (replaces profile picture)
  // ──────────────────────────────
  ctx.save();
  try {
    if (spritePath) {
      const img = await loadImage(spritePath);

      const imgAspect = img.width / img.height;
      let drawW = imageSize;
      let drawH = imageSize;

      if (imgAspect > 1) {
        drawH = imageSize / imgAspect;
      } else {
        drawW = imageSize * imgAspect;
      }

      const cx = rightX + (imageSize - drawW) / 2;
      const cy = rightY + (imageSize - drawH) / 2;

      roundedRectPath(ctx, rightX, rightY, imageSize, imageSize, 40);
      ctx.clip();
      ctx.drawImage(img, cx, cy, drawW, drawH);

      ctx.restore();
      ctx.save();
      roundedRectPath(ctx, rightX, rightY, imageSize, imageSize, 40);
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.9)';
      ctx.stroke();
    } else {
      // Fallback (match bounty no-image behavior)
      roundedRectPath(ctx, rightX, rightY, imageSize, imageSize, 40);
      ctx.clip();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(rightX, rightY, imageSize, imageSize);

      ctx.font = 'bold 42px sans-serif';
      ctx.fillStyle = '#e5e7eb';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No Sprite', rightX + imageSize / 2, rightY + imageSize / 2);

      ctx.restore();
      ctx.save();
      roundedRectPath(ctx, rightX, rightY, imageSize, imageSize, 40);
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.9)';
      ctx.stroke();
    }
  } catch {
    ctx.restore();
    ctx.save();
    roundedRectPath(ctx, rightX, rightY, imageSize, imageSize, 40);
    ctx.clip();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(rightX, rightY, imageSize, imageSize);

    ctx.font = 'bold 42px sans-serif';
    ctx.fillStyle = '#e5e7eb';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No Sprite', rightX + imageSize / 2, rightY + imageSize / 2);

    ctx.restore();
    ctx.save();
    roundedRectPath(ctx, rightX, rightY, imageSize, imageSize, 40);
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.9)';
    ctx.stroke();
  }
  ctx.restore();

  // ──────────────────────────────
  // LEFT COLUMN: info + note boxes (stacked) — matches bounty layout
  // ──────────────────────────────
  const boxGap = 40;
  const FONT_SIZE = 55;
  const lineHeight = FONT_SIZE * 1.25;
  const groupSpacing = lineHeight * 0.7;
  const labelColor = '#facc15';
  const valueColor = '#f9fafb';

  const infoRows = [];
  infoRows.push({ label: 'Issued by:', value: issuedBy });
  infoRows.push({ label: 'Rank:', value: rankName });
  infoRows.push({ spacer: true });

  infoRows.push({ label: 'Target:', value: displayName });
  infoRows.push({ label: 'Rarity:', value: rarityLabel });
  infoRows.push({ label: 'Points:', value: pointsLabel });
  infoRows.push({ spacer: true });

  infoRows.push({ label: 'Start time:', value: startLabel });
  infoRows.push({ label: 'Ends:', value: endLabel });
  infoRows.push({ label: 'Duration:', value: durationLabel });

  const nonSpacerRows = infoRows.filter(r => !r.spacer).length;
  const spacerCount = infoRows.filter(r => r.spacer).length;

  const infoPaddingX = 50;
  const infoPaddingY = 50;
  const notePaddingX = 50;
  const notePaddingY = 40;

  // Wrap note text first
  const noteText = note || 'Good luck!';
  ctx.font = `bold ${FONT_SIZE}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const maxNoteTextWidth = leftWidth - notePaddingX * 2;
  const noteLines = wrapText(ctx, noteText, maxNoteTextWidth);
  const noteTextHeight = noteLines.length * lineHeight;

  const noteMinHeight = notePaddingY * 2 + lineHeight * 2;
  const noteNeededHeight = notePaddingY * 2 + noteTextHeight;
  const noteBoxHeight = Math.max(noteMinHeight, noteNeededHeight);

  const infoTextHeight = nonSpacerRows * lineHeight + spacerCount * groupSpacing;
  const infoNeededHeight = infoPaddingY * 2 + infoTextHeight;

  const leftAvailableForInfo = leftHeight - boxGap - noteBoxHeight;
  const infoBoxHeight = Math.max(
    infoNeededHeight,
    Math.min(leftAvailableForInfo, leftHeight * 0.9)
  );

  const infoBoxX = leftX;
  const infoBoxY = leftY;
  const infoBoxW = leftWidth;
  const infoBoxH = infoBoxHeight;

  const noteBoxX = leftX;
  const noteBoxY = infoBoxY + infoBoxH + boxGap;
  const noteBoxW = leftWidth;
  const noteBoxH = leftHeight - infoBoxH - boxGap;

  // Draw top info box
  ctx.save();
  roundedRectPath(ctx, infoBoxX, infoBoxY, infoBoxW, infoBoxH, 40);
  ctx.fillStyle = style.boxColor;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#f9fafb';
  ctx.stroke();
  ctx.restore();

  // Compute label column width (match bounty)
  ctx.font = `bold ${FONT_SIZE}px sans-serif`;
  const labelsToMeasure = infoRows
    .filter(r => !r.spacer && r.label)
    .map(r => r.label);

  let maxLabelWidth = 0;
  for (const lab of labelsToMeasure) {
    const w = ctx.measureText(lab).width;
    if (w > maxLabelWidth) maxLabelWidth = w;
  }

  const labelGap = 50;
  const labelX = infoBoxX + infoPaddingX;
  const valueX = labelX + maxLabelWidth + labelGap;

  // Vertically centre text inside top info box
  const infoTextTotalHeight = nonSpacerRows * lineHeight + spacerCount * groupSpacing;
  const centeredStartY = infoBoxY + (infoBoxH - infoTextTotalHeight) / 2;
  let currentY = centeredStartY;

  for (const row of infoRows) {
    if (row.spacer) {
      currentY += groupSpacing;
      continue;
    }

    ctx.fillStyle = labelColor;
    ctx.font = `bold ${FONT_SIZE}px sans-serif`;
    ctx.fillText(row.label, labelX, currentY);

    ctx.fillStyle = valueColor;
    ctx.fillText(row.value || '', valueX, currentY);

    currentY += lineHeight;
  }

  // Draw note box
  ctx.save();
  roundedRectPath(ctx, noteBoxX, noteBoxY, noteBoxW, noteBoxH, 40);
  ctx.fillStyle = style.boxColor;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#f9fafb';
  ctx.stroke();
  ctx.restore();

  // Note text
  ctx.font = `bold ${FONT_SIZE}px sans-serif`;
  ctx.fillStyle = valueColor;
  ctx.textAlign = 'left';

  const totalNoteTextHeight = noteLines.length * lineHeight;
  let noteStartY = noteBoxY + (noteBoxH - totalNoteTextHeight) / 2;

  for (const line of noteLines) {
    ctx.fillText(line, noteBoxX + notePaddingX, noteStartY);
    noteStartY += lineHeight;
  }

  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join(CARDS_DIR, `challenge_${challengeId}.png`);
  fs.writeFileSync(filePath, buffer);

  return buffer;
}

module.exports = { createChallengeCard };