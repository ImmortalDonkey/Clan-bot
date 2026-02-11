const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const { getPokemonByKey, getPokemonByName } = require('../utils/sharedPokemon.cjs');

const CARD_WIDTH = 2200;
const CARD_HEIGHT = 1300;

// ───────── OUTER EDGE CONFIG (copied from report card) ─────────
const EDGE = 26;
const EDGE_RADIUS = EDGE * 4.6;

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

// Pokémon colour (copied concept from report card)
const rarityTextColors = {
  common: '#ffffff',
  rare: '#60a5fa',
  legendary: '#a78bfa',
  roamerMonth: '#f87171',
  paradox: '#fde047'
};

// Rank → outline + name colour (RED SHADES, one per rank)
const RANK_THEME = {
  Member: { outline: '#ef4444', name: '#ef4444' },     // red
  Elite: { outline: '#dc2626', name: '#dc2626' },      // deeper red
  'Co-Leader': { outline: '#b91c1c', name: '#b91c1c' },// dark red
  Leader: { outline: '#991b1b', name: '#991b1b' }      // darkest red
};

function themeForRank(rankName) {
  return RANK_THEME[rankName] || RANK_THEME.Member;
}

/* ────────────────────────────── */
/* HELPERS (from report card)     */
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
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.textBaseline = 'top';

  if (kind === 'issuer') {
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = theme.issuerColor;
    ctx.fillText(text, x, y);
    ctx.restore();
    return;
  }

  if (kind === 'pokemon') {
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = theme.pokemonColor;
    ctx.fillText(text, x, y);
    ctx.restore();
    return;
  }

  if (kind === 'duration') {
    // white text + underline
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y);

    const w = ctx.measureText(text).width;
    const underlineY = y + theme.lineHeight - 10;
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x, underlineY);
    ctx.lineTo(x + w, underlineY);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
}

// Resolve sprite path coming from shared DB
function resolveSpritePath(spritePath) {
  if (!spritePath) return null;

  if (path.isAbsolute(spritePath)) {
    return fs.existsSync(spritePath) ? spritePath : null;
  }

  const sharedBase = '/home/pi/shared-data';
  const p1 = path.resolve(sharedBase, spritePath);
  if (fs.existsSync(p1)) return p1;

  const p2 = path.resolve(process.cwd(), spritePath);
  if (fs.existsSync(p2)) return p2;

  return null;
}

async function getPokemonRow(pokemonNameOrKey) {
  if (!pokemonNameOrKey) return null;

  let row = await getPokemonByKey(pokemonNameOrKey).catch(() => null);
  if (row) return row;

  row = await getPokemonByName(pokemonNameOrKey).catch(() => null);
  return row || null;
}

/**
 * ACTIVE challenge card renderer
 * - Outer rounding + border copied from report card
 * - Inner panel & sprite border thickness copied from report card
 * - New opening paragraph with styled wrapping
 * - Rank border colour = red shade per rank
 * - Pokémon text colour = rarity based
 * - Duration underlined
 *
 * options:
 *  - backgroundPath (optional): issuer custom background image
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
    pointsLabel,
    backgroundPath // optional
  } = options;

  // Pull sprite path + display name from shared DB
  const pokeRow = await getPokemonRow(pokemonName);
  const displayName = pokeRow?.display_name || pokemonName || 'None';
  const spritePath = resolveSpritePath(pokeRow?.sprite_path);

  // Prefer rarity from shared DB if present
  const effectiveRarityKey = pokeRow?.rarity || rarityKey || 'common';
  const style = getStyleForRarity(effectiveRarityKey);

  const rankTheme = themeForRank(rankName);

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // ───────── OUTER CLIP (report card) ─────────
  ctx.save();
  roundedRectPath(
    ctx,
    EDGE / 2,
    EDGE / 2,
    CARD_WIDTH - EDGE,
    CARD_HEIGHT - EDGE,
    EDGE_RADIUS
  );
  ctx.clip();

  // ───────── BACKGROUND ─────────
  // 1) issuer custom background if provided and exists
  let usedBg = false;
  if (backgroundPath && typeof backgroundPath === 'string') {
    const abs = path.isAbsolute(backgroundPath)
      ? backgroundPath
      : path.resolve(process.cwd(), backgroundPath);

    if (fs.existsSync(abs)) {
      try {
        const bgImg = await loadImage(abs);
        ctx.drawImage(bgImg, 0, 0, CARD_WIDTH, CARD_HEIGHT);
        usedBg = true;
      } catch {
        usedBg = false;
      }
    }
  }

  // 2) fallback to rarity gradient
  if (!usedBg) {
    const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    bg.addColorStop(0, style.gradientFrom);
    bg.addColorStop(1, style.gradientTo);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // subtle overlay like bounty
    ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  }

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
  // RIGHT IMAGE — Pokémon sprite
  // Border thickness updated to match report card (20)
  // ──────────────────────────────
  ctx.save();
  try {
    if (spritePath) {
      const img = await loadImage(spritePath);

      const imgAspect = img.width / img.height;
      let drawW = imageSize;
      let drawH = imageSize;

      if (imgAspect > 1) drawH = imageSize / imgAspect;
      else drawW = imageSize * imgAspect;

      const cx = rightX + (imageSize - drawW) / 2;
      const cy = rightY + (imageSize - drawH) / 2;

      roundedRectPath(ctx, rightX, rightY, imageSize, imageSize, 40);
      ctx.clip();
      ctx.drawImage(img, cx, cy, drawW, drawH);
    } else {
      roundedRectPath(ctx, rightX, rightY, imageSize, imageSize, 40);
      ctx.clip();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(rightX, rightY, imageSize, imageSize);
      ctx.font = 'bold 42px sans-serif';
      ctx.fillStyle = '#e5e7eb';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No Sprite', rightX + imageSize / 2, rightY + imageSize / 2);
    }
  } catch {
    roundedRectPath(ctx, rightX, rightY, imageSize, imageSize, 40);
    ctx.clip();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(rightX, rightY, imageSize, imageSize);
    ctx.font = 'bold 42px sans-serif';
    ctx.fillStyle = '#e5e7eb';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No Sprite', rightX + imageSize / 2, rightY + imageSize / 2);
  }
  ctx.restore();

  // sprite border (match report card thickness)
  ctx.save();
  roundedRectPath(ctx, rightX, rightY, imageSize, imageSize, 40);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 20;
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = rankTheme.outline;
  ctx.stroke();
  ctx.restore();

  // ──────────────────────────────
  // LEFT COLUMN: info + note boxes
  // Border thickness updated to match report card (20)
  // ──────────────────────────────
  const boxGap = 40;

  const FONT_SIZE = 55;
  const lineHeight = FONT_SIZE * 1.25;
  const groupSpacing = lineHeight * 0.7;

  const labelColor = '#facc15';
  const valueColor = '#f9fafb';

  const infoPaddingX = 60;
  const infoPaddingY = 60;
  const notePaddingX = 60;
  const notePaddingY = 50;

  // ───────── Narrative paragraph (styled + wrapped) ─────────
  ctx.font = `bold ${FONT_SIZE}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const contentW = leftWidth - infoPaddingX * 2;

  const narrativeTokens = [
    { kind: 'issuer', text: String(issuedBy || 'Someone') },
    { kind: 'normal', text: ' has issued a new challenge. Catch a ' },
    { kind: 'pokemon', text: String(displayName || 'Pokémon') },
    { kind: 'normal', text: ' within ' },
    { kind: 'duration', text: String(durationLabel || 'the time limit') }
  ];

  const narrativeLines = wrapStyledTokens(ctx, narrativeTokens, contentW);
  const narrativeHeight = narrativeLines.length * lineHeight;

  // ───────── Meta rows (wrapped values where needed) ─────────
  const metaRows = [
    { label: 'Rank:', value: rankName || 'Member' },
    { label: 'Rarity:', value: rarityLabel || effectiveRarityKey || 'common' },
    { label: 'Points:', value: pointsLabel || '' },
    { spacer: true },
    { label: 'Start time:', value: startLabel || '' },
    { label: 'End time:', value: endLabel || '' }
  ];

  // Measure label width
  let maxLabelWidth = 0;
  for (const r of metaRows) {
    if (r.label) maxLabelWidth = Math.max(maxLabelWidth, ctx.measureText(r.label).width);
  }
  const labelX = leftX + infoPaddingX;
  const valueX = labelX + maxLabelWidth + 40;
  const valueW = (leftX + leftWidth - infoPaddingX) - valueX;

  // Pre-wrap meta values so we can compute total height safely
  const metaWrapped = metaRows.map(r => {
    if (r.spacer) return { spacer: true };
    const lines = wrapPlainText(ctx, r.value, valueW);
    return { label: r.label, lines };
  });

  let metaHeight = 0;
  for (const r of metaWrapped) {
    if (r.spacer) {
      metaHeight += groupSpacing;
      continue;
    }
    metaHeight += Math.max(1, r.lines.length) * lineHeight;
    if (r.label === 'Points:') metaHeight += lineHeight * 0.2;
  }

  // Note box wrap
  const noteText = note || 'Good luck!';
  const noteLines = wrapPlainText(ctx, noteText, leftWidth - notePaddingX * 2);
  const noteTextHeight = noteLines.length * lineHeight;
  const noteMinHeight = notePaddingY * 2 + lineHeight * 2;
  const noteNeededHeight = notePaddingY * 2 + noteTextHeight;
  const noteBoxHeight = Math.max(noteMinHeight, noteNeededHeight);

  // Info box height (narrative + spacing + meta)
  const infoInternalGap = lineHeight * 0.6;
  const infoTextHeight = narrativeHeight + infoInternalGap + metaHeight;
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

  // Draw info box (report thickness + rank outline colour)
  ctx.save();
  roundedRectPath(ctx, infoBoxX, infoBoxY, infoBoxW, infoBoxH, 40);
  ctx.fillStyle = style.boxColor;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 20;
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = rankTheme.outline;
  ctx.stroke();
  ctx.restore();

  // Draw narrative + meta (vertically centered as a block)
  const blockTotalHeight = infoTextHeight;
  let cursorY = infoBoxY + (infoBoxH - blockTotalHeight) / 2;

  const drawTheme = {
    issuerColor: rankTheme.name,
    pokemonColor: rarityTextColors[effectiveRarityKey] || '#ffffff',
    lineHeight
  };

  // Narrative lines
  for (const line of narrativeLines) {
    let x = labelX;
    for (const piece of line) {
      drawPiece(ctx, piece.text, x, cursorY, piece.kind, drawTheme);
      x += ctx.measureText(piece.text).width;
    }
    cursorY += lineHeight;
  }

  cursorY += infoInternalGap;

  // Meta rows
  for (const row of metaWrapped) {
    if (row.spacer) {
      cursorY += groupSpacing;
      continue;
    }

    // Label
    ctx.fillStyle = labelColor;
    ctx.fillText(row.label, labelX, cursorY);

    // Value (wrap)
    ctx.fillStyle = valueColor;
    for (const l of row.lines) {
      ctx.fillText(l, valueX, cursorY);
      cursorY += lineHeight;
    }

    if (row.label === 'Points:') cursorY += lineHeight * 0.2;
  }

  // Draw note box (report thickness + rank outline colour)
  ctx.save();
  roundedRectPath(ctx, noteBoxX, noteBoxY, noteBoxW, noteBoxH, 40);
  ctx.fillStyle = style.boxColor;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 20;
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = rankTheme.outline;
  ctx.stroke();
  ctx.restore();

  // Note text centered
  const totalNoteTextHeight = noteLines.length * lineHeight;
  let noteStartY = noteBoxY + (noteBoxH - totalNoteTextHeight) / 2;

  ctx.fillStyle = valueColor;
  for (const line of noteLines) {
    ctx.fillText(line, noteBoxX + notePaddingX, noteStartY);
    noteStartY += lineHeight;
  }

  // Restore outer clip
  ctx.restore();

  // ───────── OUTER EDGE (report card) ─────────
  ctx.save();
  roundedRectPath(
    ctx,
    EDGE / 2,
    EDGE / 2,
    CARD_WIDTH - EDGE,
    CARD_HEIGHT - EDGE,
    EDGE_RADIUS
  );
  ctx.lineWidth = EDGE;
  ctx.strokeStyle = rankTheme.outline;
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.stroke();
  ctx.restore();

  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join(CARDS_DIR, `challenge_${challengeId}.png`);
  fs.writeFileSync(filePath, buffer);

  return buffer;
}

module.exports = { createChallengeCard };
