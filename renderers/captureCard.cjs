const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const CARD_WIDTH = 2200;
const CARD_HEIGHT = 1300;
const EDGE = 28;
const EDGE_RADIUS = EDGE * 4.6;
const MARGIN = Math.floor(CARD_WIDTH * 0.05);

const OUTPUT_DIR = path.join(__dirname, 'capture-images');
const CACHE_DIR = path.join(__dirname, '..', 'data', 'cache');
const SPRITE_CACHE_DIR = path.join(CACHE_DIR, 'pokemon-sprites');
const BG_DIR = path.join(__dirname, 'capture-bg');
const TYPE_CACHE_PATH = path.join(CACHE_DIR, 'pokemon-types.json');

const VORTEX_SPRITE_BASE = 'https://static.pokemon-vortex.com/v6/images/pokemon_front/';
const POKEAPI_BASE = 'https://pokeapi.co/api/v2/pokemon/';

const TYPE_COLORS = {
  normal: '#A8A77A',
  fire: '#EE8130',
  water: '#6390F0',
  electric: '#F7D02C',
  grass: '#7AC74C',
  ice: '#96D9D6',
  fighting: '#C22E28',
  poison: '#A33EA1',
  ground: '#E2BF65',
  flying: '#A98FF3',
  psychic: '#F95587',
  bug: '#A6B91A',
  rock: '#B6A136',
  ghost: '#735797',
  dragon: '#6F35FC',
  dark: '#705746',
  steel: '#B7B7CE',
  fairy: '#D685AD'
};

const TYPE_FALLBACKS = {
  bulbasaur: ['grass', 'poison'],
  ivysaur: ['grass', 'poison'],
  venusaur: ['grass', 'poison'],
  charmander: ['fire'],
  charmeleon: ['fire'],
  charizard: ['fire', 'flying'],
  squirtle: ['water'],
  wartortle: ['water'],
  blastoise: ['water'],

  pikachu: ['electric'],
  raichu: ['electric'],

  gastly: ['ghost', 'poison'],
  haunter: ['ghost', 'poison'],
  gengar: ['ghost', 'poison'],

  magikarp: ['water'],
  gyarados: ['water', 'flying'],

  dratini: ['dragon'],
  dragonair: ['dragon'],
  dragonite: ['dragon', 'flying'],

  mewtwo: ['psychic'],
  mew: ['psychic'],

  lugia: ['psychic', 'flying'],
  hooh: ['fire', 'flying'],
  kyogre: ['water'],
  groudon: ['ground'],
  rayquaza: ['dragon', 'flying'],

  dialga: ['steel', 'dragon'],
  palkia: ['water', 'dragon'],
  giratina: ['ghost', 'dragon'],

  arceus: ['normal'],
  cyclizar: ['dragon', 'normal'],

  walkingwake: ['water', 'dragon'],
  irontreads: ['ground', 'steel'],
  ironbundle: ['ice', 'water'],
  ironhands: ['fighting', 'electric'],
  ironjugulis: ['dark', 'flying'],
  ironmoth: ['fire', 'poison'],
  ironthorns: ['rock', 'electric'],
  ironvaliant: ['fairy', 'fighting'],

  urshifu: ['dark', 'fighting'],
  urshifusinglestrike: ['dark', 'fighting'],
  urshifusinglestrikegigantamax: ['dark', 'fighting'],
  urshifurapidstrike: ['water', 'fighting'],
  urshifurapidstrikegigantamax: ['water', 'fighting']
};

const VORTEX_VARIANTS = [
  'shadow',
  'shiny',
  'metallic',
  'mystic',
  'dark',
  'normal'
];

for (const dir of [OUTPUT_DIR, CACHE_DIR, SPRITE_CACHE_DIR, BG_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

function normaliseKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[♀]/g, 'f')
    .replace(/[♂]/g, 'm')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function displayName(value) {
  return String(value || 'Unknown')
    .trim()
    .replace(/\s+/g, ' ');
}

function titleCase(value) {
  return displayName(value)
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function stripVortexVariant(name) {
  let output = displayName(name);
  let changed = true;

  while (changed) {
    changed = false;

    for (const variant of VORTEX_VARIANTS) {
      const re = new RegExp(`^${variant}\\s+`, 'i');

      if (re.test(output)) {
        output = output.replace(re, '').trim();
        changed = true;
      }
    }
  }

  return output || displayName(name);
}

function canonicalSpeciesName(name) {
  let raw = stripVortexVariant(name);
  const lower = raw.toLowerCase();

  if (lower.includes('urshifu')) {
    if (
      lower.includes('single strike') ||
      lower.includes('(ss gigantamax)') ||
      lower.includes('(ss gmax)') ||
      lower.includes('ss gigantamax')
    ) {
      return 'urshifu single strike';
    }

    if (
      lower.includes('rapid strike') ||
      lower.includes('(rs gigantamax)') ||
      lower.includes('(rs gmax)') ||
      lower.includes('rs gigantamax')
    ) {
      return 'urshifu rapid strike';
    }

    return 'urshifu';
  }

  raw = raw
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return raw || displayName(name);
}

function toPokeApiSlug(name) {
  const canonical = canonicalSpeciesName(name);

  return canonical
    .toLowerCase()
    .replace(/♀/g, '-f')
    .replace(/♂/g, '-m')
    .replace(/[.’']/g, '')
    .replace(/:/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function safeFileName(value) {
  return normaliseKey(value) || 'unknown';
}

function readTypeCache() {
  try {
    if (!fs.existsSync(TYPE_CACHE_PATH)) return {};
    return JSON.parse(fs.readFileSync(TYPE_CACHE_PATH, 'utf-8')) || {};
  } catch {
    return {};
  }
}

function writeTypeCache(cache) {
  try {
    fs.writeFileSync(TYPE_CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.warn('Failed to write Pokémon type cache:', err.message);
  }
}

async function fetchPokemonTypes(speciesName) {
  if (typeof fetch !== 'function') return null;

  const slug = toPokeApiSlug(speciesName);
  if (!slug) return null;

  const res = await fetch(`${POKEAPI_BASE}${encodeURIComponent(slug)}`);
  if (!res.ok) return null;

  const json = await res.json();

  const types = (json.types || [])
    .sort((a, b) => a.slot - b.slot)
    .map(entry => String(entry.type?.name || '').toLowerCase())
    .filter(type => TYPE_COLORS[type]);

  return types.length ? types.slice(0, 2) : null;
}

async function resolvePokemonTypes(pokemonName, speciesName) {
  const candidates = [
    canonicalSpeciesName(pokemonName),
    canonicalSpeciesName(speciesName),
    speciesName,
    pokemonName
  ]
    .filter(Boolean)
    .map(value => displayName(value));

  for (const candidate of candidates) {
    const key = normaliseKey(candidate);
    if (TYPE_FALLBACKS[key]) return TYPE_FALLBACKS[key];
  }

  const cache = readTypeCache();

  for (const candidate of candidates) {
    const key = normaliseKey(candidate);

    if (Array.isArray(cache[key]) && cache[key].length) {
      return cache[key].filter(type => TYPE_COLORS[type]).slice(0, 2);
    }
  }

  for (const candidate of candidates) {
    try {
      const fetched = await fetchPokemonTypes(candidate);

      if (fetched?.length) {
        const key = normaliseKey(candidate);
        cache[key] = fetched;
        writeTypeCache(cache);
        return fetched;
      }
    } catch (err) {
      console.warn(`Failed to resolve Pokémon types for ${candidate}:`, err.message);
    }
  }

  return ['normal'];
}

function createTypeGradient(ctx, types, x, y, w, h) {
  const safeTypes = (types || ['normal']).filter(type => TYPE_COLORS[type]);
  const type1 = safeTypes[0] || 'normal';
  const type2 = safeTypes[1];

  if (!type2) return TYPE_COLORS[type1] || '#ffffff';

  const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
  gradient.addColorStop(0, TYPE_COLORS[type1] || '#ffffff');
  gradient.addColorStop(1, TYPE_COLORS[type2] || '#ffffff');

  return gradient;
}

function rgbaFromHex(hex, alpha) {
  const value = String(hex || '#ffffff').replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) || 255;
  const g = parseInt(value.slice(2, 4), 16) || 255;
  const b = parseInt(value.slice(4, 6), 16) || 255;

  return `rgba(${r},${g},${b},${alpha})`;
}

function strokeRounded(ctx, x, y, w, h, r, paint, lineWidth) {
  roundedRectPath(ctx, x, y, w, h, r);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = paint;
  ctx.stroke();
}

function getBackgroundType(types) {
  const safeTypes = (types || [])
    .map(type => String(type || '').toLowerCase().trim())
    .filter(Boolean);

  if (!safeTypes.length) return 'normal';
  if (safeTypes.length === 1) return safeTypes[0];

  const [type1, type2] = safeTypes;

  if (type1 === 'normal' && type2) return type2;
  if (type2 === 'normal') return type1;

  return type1;
}

function findBackgroundPath(types) {
  const bgType = getBackgroundType(types);

  const candidates = [
    `${bgType}.png`,
    'default.png'
  ];

  for (const file of candidates) {
    const fullPath = path.join(BG_DIR, file);
    if (fs.existsSync(fullPath)) return fullPath;
  }

  return null;
}

async function drawBackground(ctx, types) {
  const bgPath = findBackgroundPath(types);

  if (bgPath) {
    const bg = await loadImage(bgPath);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bg, 0, 0, CARD_WIDTH, CARD_HEIGHT);
    return;
  }

  const bgType = getBackgroundType(types);
  const c1 = TYPE_COLORS[bgType] || '#222222';
  const c2 = TYPE_COLORS[bgType] || c1;

  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bg.addColorStop(0, rgbaFromHex(c1, 0.85));
  bg.addColorStop(0.52, '#1f2937');
  bg.addColorStop(1, rgbaFromHex(c2, 0.85));

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#ffffff';

  for (let i = 0; i < 42; i += 1) {
    const x = (i * 197) % CARD_WIDTH;
    const y = (i * 113) % CARD_HEIGHT;
    const size = 24 + ((i * 17) % 72);

    roundedRectPath(ctx, x, y, size, size, 12);
    ctx.fill();
  }

  ctx.restore();

  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
}

async function fetchToFile(url, outPath) {
  if (typeof fetch !== 'function') return false;

  const res = await fetch(url);
  if (!res.ok) return false;

  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length) return false;

  fs.writeFileSync(outPath, buffer);
  return true;
}

function spriteUrl(name) {
  return `${VORTEX_SPRITE_BASE}${encodeURIComponent(displayName(name))}.png`;
}

async function loadSprite(pokemonName, speciesName) {
  const candidates = [
    displayName(pokemonName),
    titleCase(canonicalSpeciesName(pokemonName)),
    titleCase(canonicalSpeciesName(speciesName))
  ]
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);

  for (const candidate of candidates) {
    const cachePath = path.join(SPRITE_CACHE_DIR, `${safeFileName(candidate)}.png`);

    try {
      if (!fs.existsSync(cachePath)) {
        await fetchToFile(spriteUrl(candidate), cachePath);
      }

      if (fs.existsSync(cachePath)) {
        return await loadImage(cachePath);
      }
    } catch (err) {
      console.warn(`Failed to load sprite for ${candidate}:`, err.message);
    }
  }

  return null;
}

function wrapText(ctx, text, maxWidth) {
  const words = displayName(text).split(' ');
  const lines = [];
  let line = '';

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;

    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function drawOutlinedText(ctx, text, x, y, fill, stroke = 'rgba(0,0,0,0.75)', lineWidth = 7) {
  ctx.save();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function buildTextLayout(ctx, data, textWidth, textHeight) {
  const labels = ['Points:', 'Rarity:', 'Rank:'];

  for (let fontSize = 74; fontSize >= 50; fontSize -= 2) {
    ctx.font = `bold ${fontSize}px sans-serif`;

    const lineHeight = Math.round(fontSize * 1.18);
    const labelGap = 34;
    const blockGapSmall = 10;
    const blockGapMedium = 20;
    const blockGapLarge = 34;

    const usernameLines = wrapText(ctx, data.username, textWidth);
    const narrativeLines = wrapText(ctx, 'has captured a wild', textWidth);
    const pokemonLines = wrapText(ctx, data.pokemonName, textWidth);

    const labelW = Math.max(...labels.map(label => ctx.measureText(label).width));
    const valueW = textWidth - labelW - labelGap;

    if (valueW < 120) continue;

    const pointsLines = wrapText(ctx, String(data.points), valueW);
    const rarityLines = wrapText(ctx, data.rarity, valueW);
    const rankLines = wrapText(ctx, data.rank, valueW);

    const totalHeight =
      usernameLines.length * lineHeight +
      blockGapSmall +
      narrativeLines.length * lineHeight +
      blockGapMedium +
      pokemonLines.length * lineHeight +
      blockGapLarge +
      pointsLines.length * lineHeight +
      blockGapSmall +
      rarityLines.length * lineHeight +
      blockGapSmall +
      rankLines.length * lineHeight;

    if (totalHeight <= textHeight) {
      return {
        fontSize,
        lineHeight,
        labelW,
        labelGap,
        blockGapSmall,
        blockGapMedium,
        blockGapLarge,
        usernameLines,
        narrativeLines,
        pokemonLines,
        pointsLines,
        rarityLines,
        rankLines,
        totalHeight
      };
    }
  }

  // fallback smallest
  const fontSize = 50;
  ctx.font = `bold ${fontSize}px sans-serif`;

  const lineHeight = Math.round(fontSize * 1.18);
  const labelGap = 34;
  const blockGapSmall = 10;
  const blockGapMedium = 20;
  const blockGapLarge = 34;

  const usernameLines = wrapText(ctx, data.username, textWidth);
  const narrativeLines = wrapText(ctx, 'has captured a wild', textWidth);
  const pokemonLines = wrapText(ctx, data.pokemonName, textWidth);

  const labelW = Math.max(...labels.map(label => ctx.measureText(label).width));
  const valueW = textWidth - labelW - labelGap;

  const pointsLines = wrapText(ctx, String(data.points), valueW);
  const rarityLines = wrapText(ctx, data.rarity, valueW);
  const rankLines = wrapText(ctx, data.rank, valueW);

  const totalHeight =
    usernameLines.length * lineHeight +
    blockGapSmall +
    narrativeLines.length * lineHeight +
    blockGapMedium +
    pokemonLines.length * lineHeight +
    blockGapLarge +
    pointsLines.length * lineHeight +
    blockGapSmall +
    rarityLines.length * lineHeight +
    blockGapSmall +
    rankLines.length * lineHeight;

  return {
    fontSize,
    lineHeight,
    labelW,
    labelGap,
    blockGapSmall,
    blockGapMedium,
    blockGapLarge,
    usernameLines,
    narrativeLines,
    pokemonLines,
    pointsLines,
    rarityLines,
    rankLines,
    totalHeight
  };
}

function drawMetaValueLines(ctx, lines, x, y, lineHeight) {
  for (let i = 0; i < lines.length; i += 1) {
    drawOutlinedText(
      ctx,
      lines[i],
      x,
      y + i * lineHeight,
      '#ffffff',
      'rgba(0,0,0,0.72)',
      6
    );
  }

  return Math.max(1, lines.length) * lineHeight;
}

function drawMetaRow(ctx, label, lines, x, y, labelW, labelGap, lineHeight) {
  drawOutlinedText(ctx, label, x, y, '#facc15', 'rgba(0,0,0,0.72)', 6);

  return drawMetaValueLines(
    ctx,
    lines,
    x + labelW + labelGap,
    y,
    lineHeight
  );
}

async function createCaptureCard(capture) {
  const username = displayName(capture.username || capture.ign || 'Unknown');
  const pokemonName = displayName(capture.pokemonName || capture.pokemon || 'Unknown');
  const speciesName = displayName(capture.speciesName || canonicalSpeciesName(pokemonName));
  const points = Number.isFinite(Number(capture.points)) ? Number(capture.points) : 0;
  const rarity = displayName(capture.rarity || capture.rarityLabel || 'Normal');
  const rank = displayName(capture.rank || 'Unranked');

  const types = Array.isArray(capture.types) && capture.types.length
    ? capture.types.map(type => String(type).toLowerCase()).filter(type => TYPE_COLORS[type]).slice(0, 2)
    : await resolvePokemonTypes(pokemonName, speciesName);

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

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

  await drawBackground(ctx, types);

  const innerW = CARD_WIDTH - MARGIN * 2;
  const innerH = CARD_HEIGHT - MARGIN * 2;

  const textBoxX = MARGIN + 38;
  const textBoxY = MARGIN + 68;
  const textBoxW = Math.floor(innerW * 0.58);
  const textBoxH = innerH - 136;

  const spriteZoneX = textBoxX + textBoxW + 34;
  const spriteZoneW = CARD_WIDTH - MARGIN - spriteZoneX - 28;
  const spriteZoneY = MARGIN + 50;
  const spriteZoneH = innerH - 100;

  const borderPaint = createTypeGradient(ctx, types, 0, 0, CARD_WIDTH, CARD_HEIGHT);
  const primaryColor = TYPE_COLORS[types[0] || 'normal'] || '#ffffff';
  const secondaryColor = TYPE_COLORS[types[1] || types[0] || 'normal'] || primaryColor;

  // Text-only inner box
  ctx.save();
  roundedRectPath(ctx, textBoxX, textBoxY, textBoxW, textBoxH, 40);
  ctx.fillStyle = 'rgba(22,22,28,0.64)';
  ctx.fill();

  ctx.shadowColor = primaryColor;
  ctx.shadowBlur = 7;
  strokeRounded(ctx, textBoxX, textBoxY, textBoxW, textBoxH, 40, borderPaint, 12);

  if (types[1]) {
    ctx.shadowColor = secondaryColor;
    ctx.shadowBlur = 4;
    strokeRounded(ctx, textBoxX, textBoxY, textBoxW, textBoxH, 40, borderPaint, 7);
  }

  ctx.shadowBlur = 0;
  strokeRounded(ctx, textBoxX, textBoxY, textBoxW, textBoxH, 40, borderPaint, 4);
  ctx.restore();

  const contentPaddingX = 52;
  const contentPaddingY = 44;
  const contentX = textBoxX + contentPaddingX;
  const contentY = textBoxY + contentPaddingY;
  const contentW = textBoxW - contentPaddingX * 2;
  const contentH = textBoxH - contentPaddingY * 2;

  const layout = buildTextLayout(
    ctx,
    { username, pokemonName, points, rarity, rank },
    contentW,
    contentH
  );

  ctx.font = `bold ${layout.fontSize}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  let cursorY = contentY + Math.round((contentH - layout.totalHeight) / 2);

  for (const line of layout.usernameLines) {
    drawOutlinedText(ctx, line, contentX, cursorY, '#86efac', 'rgba(0,0,0,0.74)', 7);
    cursorY += layout.lineHeight;
  }

  cursorY += layout.blockGapSmall;

  for (const line of layout.narrativeLines) {
    drawOutlinedText(ctx, line, contentX, cursorY, '#ffffff', 'rgba(0,0,0,0.74)', 7);
    cursorY += layout.lineHeight;
  }

  cursorY += layout.blockGapMedium;

  const nameGradient = createTypeGradient(ctx, types, contentX, cursorY, contentW, layout.fontSize);

  for (const line of layout.pokemonLines) {
    drawOutlinedText(ctx, line, contentX, cursorY, nameGradient, 'rgba(0,0,0,0.82)', 8);
    cursorY += layout.lineHeight;
  }

  cursorY += layout.blockGapLarge;

  cursorY += drawMetaRow(
    ctx,
    'Points:',
    layout.pointsLines,
    contentX,
    cursorY,
    layout.labelW,
    layout.labelGap,
    layout.lineHeight
  );

  cursorY += layout.blockGapSmall;

  cursorY += drawMetaRow(
    ctx,
    'Rarity:',
    layout.rarityLines,
    contentX,
    cursorY,
    layout.labelW,
    layout.labelGap,
    layout.lineHeight
  );

  cursorY += layout.blockGapSmall;

  drawMetaRow(
    ctx,
    'Rank:',
    layout.rankLines,
    contentX,
    cursorY,
    layout.labelW,
    layout.labelGap,
    layout.lineHeight
  );

  // Sprite directly on the background, not inside the box
  const sprite = await loadSprite(pokemonName, speciesName);

  if (sprite) {
    const maxW = spriteZoneW - 20;
    const maxH = spriteZoneH - 20;
    const scale = Math.min(maxW / sprite.width, maxH / sprite.height);

    const w = sprite.width * scale;
    const h = sprite.height * scale;

    const x = spriteZoneX + (spriteZoneW - w) / 2;
    const y = spriteZoneY + (spriteZoneH - h) / 2;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, x, y, w, h);
    ctx.restore();
  }

  ctx.restore();

  // Outer border
  ctx.save();
  const outerPaint = createTypeGradient(ctx, types, 0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.shadowColor = primaryColor;
  ctx.shadowBlur = 6;

  roundedRectPath(
    ctx,
    EDGE / 2,
    EDGE / 2,
    CARD_WIDTH - EDGE,
    CARD_HEIGHT - EDGE,
    EDGE_RADIUS
  );

  ctx.lineWidth = EDGE;
  ctx.strokeStyle = outerPaint;
  ctx.stroke();
  ctx.restore();

  const outPath = path.join(
    OUTPUT_DIR,
    `capture_${Date.now()}_${Math.floor(Math.random() * 100000)}.png`
  );

  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));

  return outPath;
}

module.exports = {
  TYPE_COLORS,
  createCaptureCard,
  resolvePokemonTypes,
  stripVortexVariant,
  canonicalSpeciesName
};
