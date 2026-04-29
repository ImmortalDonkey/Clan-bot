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
  caterpie: ['bug'],
  metapod: ['bug'],
  butterfree: ['bug', 'flying'],
  weedle: ['bug', 'poison'],
  kakuna: ['bug', 'poison'],
  beedrill: ['bug', 'poison'],
  pidgey: ['normal', 'flying'],
  pidgeotto: ['normal', 'flying'],
  pidgeot: ['normal', 'flying'],
  rattata: ['normal'],
  raticate: ['normal'],
  spearow: ['normal', 'flying'],
  fearow: ['normal', 'flying'],
  ekans: ['poison'],
  arbok: ['poison'],
  pikachu: ['electric'],
  raichu: ['electric'],
  sandshrew: ['ground'],
  sandslash: ['ground'],
  nidoran: ['poison'],
  nidorina: ['poison'],
  nidoqueen: ['poison', 'ground'],
  nidorino: ['poison'],
  nidoking: ['poison', 'ground'],
  clefairy: ['fairy'],
  clefable: ['fairy'],
  vulpix: ['fire'],
  ninetales: ['fire'],
  jigglypuff: ['normal', 'fairy'],
  wigglytuff: ['normal', 'fairy'],
  zubat: ['poison', 'flying'],
  golbat: ['poison', 'flying'],
  oddish: ['grass', 'poison'],
  gloom: ['grass', 'poison'],
  vileplume: ['grass', 'poison'],
  paras: ['bug', 'grass'],
  parasect: ['bug', 'grass'],
  venonat: ['bug', 'poison'],
  venomoth: ['bug', 'poison'],
  diglett: ['ground'],
  dugtrio: ['ground'],
  meowth: ['normal'],
  persian: ['normal'],
  psyduck: ['water'],
  golduck: ['water'],
  mankey: ['fighting'],
  primeape: ['fighting'],
  growlithe: ['fire'],
  arcanine: ['fire'],
  poliwag: ['water'],
  poliwhirl: ['water'],
  poliwrath: ['water', 'fighting'],
  abra: ['psychic'],
  kadabra: ['psychic'],
  alakazam: ['psychic'],
  machop: ['fighting'],
  machoke: ['fighting'],
  machamp: ['fighting'],
  bellsprout: ['grass', 'poison'],
  weepinbell: ['grass', 'poison'],
  victreebel: ['grass', 'poison'],
  tentacool: ['water', 'poison'],
  tentacruel: ['water', 'poison'],
  geodude: ['rock', 'ground'],
  graveler: ['rock', 'ground'],
  golem: ['rock', 'ground'],
  ponyta: ['fire'],
  rapidash: ['fire'],
  slowpoke: ['water', 'psychic'],
  slowbro: ['water', 'psychic'],
  magnemite: ['electric', 'steel'],
  magneton: ['electric', 'steel'],
  farfetchd: ['normal', 'flying'],
  doduo: ['normal', 'flying'],
  dodrio: ['normal', 'flying'],
  seel: ['water'],
  dewgong: ['water', 'ice'],
  grimer: ['poison'],
  muk: ['poison'],
  shellder: ['water'],
  cloyster: ['water', 'ice'],
  gastly: ['ghost', 'poison'],
  haunter: ['ghost', 'poison'],
  gengar: ['ghost', 'poison'],
  onix: ['rock', 'ground'],
  drowzee: ['psychic'],
  hypno: ['psychic'],
  krabby: ['water'],
  kingler: ['water'],
  voltorb: ['electric'],
  electrode: ['electric'],
  exeggcute: ['grass', 'psychic'],
  exeggutor: ['grass', 'psychic'],
  cubone: ['ground'],
  marowak: ['ground'],
  hitmonlee: ['fighting'],
  hitmonchan: ['fighting'],
  lickitung: ['normal'],
  koffing: ['poison'],
  weezing: ['poison'],
  rhyhorn: ['ground', 'rock'],
  rhydon: ['ground', 'rock'],
  chansey: ['normal'],
  tangela: ['grass'],
  kangaskhan: ['normal'],
  horsea: ['water'],
  seadra: ['water'],
  goldeen: ['water'],
  seaking: ['water'],
  staryu: ['water'],
  starmie: ['water', 'psychic'],
  mrmime: ['psychic', 'fairy'],
  scyther: ['bug', 'flying'],
  jynx: ['ice', 'psychic'],
  electabuzz: ['electric'],
  magmar: ['fire'],
  pinsir: ['bug'],
  tauros: ['normal'],
  magikarp: ['water'],
  gyarados: ['water', 'flying'],
  lapras: ['water', 'ice'],
  ditto: ['normal'],
  eevee: ['normal'],
  vaporeon: ['water'],
  jolteon: ['electric'],
  flareon: ['fire'],
  porygon: ['normal'],
  omanyte: ['rock', 'water'],
  omastar: ['rock', 'water'],
  kabuto: ['rock', 'water'],
  kabutops: ['rock', 'water'],
  aerodactyl: ['rock', 'flying'],
  snorlax: ['normal'],
  articuno: ['ice', 'flying'],
  zapdos: ['electric', 'flying'],
  moltres: ['fire', 'flying'],
  dratini: ['dragon'],
  dragonair: ['dragon'],
  dragonite: ['dragon', 'flying'],
  mewtwo: ['psychic'],
  mew: ['psychic'],
  cyclizar: ['dragon', 'normal'],
  rayquaza: ['dragon', 'flying'],
  kyogre: ['water'],
  groudon: ['ground'],
  lugia: ['psychic', 'flying'],
  hooh: ['fire', 'flying'],
  dialga: ['steel', 'dragon'],
  palkia: ['water', 'dragon'],
  giratina: ['ghost', 'dragon'],
  arceus: ['normal'],
  walkingwake: ['water', 'dragon'],
  irontreads: ['ground', 'steel'],
  ironbundle: ['ice', 'water'],
  ironhands: ['fighting', 'electric'],
  ironjugulis: ['dark', 'flying'],
  ironmoth: ['fire', 'poison'],
  ironthorns: ['rock', 'electric'],
  ironvaliant: ['fairy', 'fighting']
};

const VORTEX_VARIANTS = ['shadow', 'shiny', 'metallic', 'mystic', 'dark', 'normal'];

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

function toPokeApiSlug(name) {
  return stripVortexVariant(name)
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
  const species = stripVortexVariant(speciesName || pokemonName);
  const key = normaliseKey(species);

  if (TYPE_FALLBACKS[key]) return TYPE_FALLBACKS[key];

  const cache = readTypeCache();
  if (Array.isArray(cache[key]) && cache[key].length) {
    return cache[key].filter(type => TYPE_COLORS[type]).slice(0, 2);
  }

  try {
    const fetched = await fetchPokemonTypes(species);
    if (fetched?.length) {
      cache[key] = fetched;
      writeTypeCache(cache);
      return fetched;
    }
  } catch (err) {
    console.warn(`Failed to resolve Pokémon types for ${species}:`, err.message);
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

function findBackgroundPath(types) {
  const safeTypes = (types || ['normal']).filter(Boolean);
  const candidates = [];

  if (safeTypes.length >= 2) {
    candidates.push(`${safeTypes[0]}-${safeTypes[1]}.png`);
    candidates.push(`${safeTypes[1]}-${safeTypes[0]}.png`);
  }

  if (safeTypes[0]) candidates.push(`${safeTypes[0]}.png`);
  candidates.push('default.png');

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

  const type1 = types[0] || 'normal';
  const type2 = types[1] || type1;
  const c1 = TYPE_COLORS[type1] || '#222222';
  const c2 = TYPE_COLORS[type2] || c1;

  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bg.addColorStop(0, rgbaFromHex(c1, 0.95));
  bg.addColorStop(0.52, '#1f2937');
  bg.addColorStop(1, rgbaFromHex(c2, 0.95));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 42; i += 1) {
    const x = (i * 197) % CARD_WIDTH;
    const y = (i * 113) % CARD_HEIGHT;
    const size = 24 + ((i * 17) % 72);
    roundedRectPath(ctx, x, y, size, size, 12);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(0,0,0,0.30)';
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
  const candidates = [displayName(pokemonName), titleCase(stripVortexVariant(speciesName || pokemonName))]
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

function fitFont(ctx, text, startSize, minSize, maxWidth, weight = 'bold') {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  }
  return size;
}

function drawOutlinedText(ctx, text, x, y, fill, stroke = 'rgba(0,0,0,0.70)', lineWidth = 8) {
  ctx.save();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawMetaRow(ctx, label, value, x, y, labelW, valueW) {
  const fontSize = 64;
  const lineHeight = Math.round(fontSize * 1.25);

  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  drawOutlinedText(ctx, label, x, y, '#facc15', 'rgba(0,0,0,0.65)', 7);

  ctx.fillStyle = '#ffffff';
  const lines = wrapText(ctx, value, valueW);
  for (let i = 0; i < lines.length; i += 1) {
    drawOutlinedText(ctx, lines[i], x + labelW + 42, y + i * lineHeight, '#ffffff', 'rgba(0,0,0,0.65)', 6);
  }

  return Math.max(1, lines.length) * lineHeight;
}

function typeLabel(types) {
  return (types || ['normal'])
    .map(type => String(type || '').toUpperCase())
    .join(' / ');
}

async function createCaptureCard(capture) {
  const username = displayName(capture.username || capture.ign || 'Unknown');
  const pokemonName = displayName(capture.pokemonName || capture.pokemon || 'Unknown');
  const speciesName = displayName(capture.speciesName || stripVortexVariant(pokemonName));
  const points = Number.isFinite(Number(capture.points)) ? Number(capture.points) : 0;
  const rarity = displayName(capture.rarity || capture.rarityLabel || 'Normal');
  const rank = displayName(capture.rank || 'Unranked');
  const types = Array.isArray(capture.types) && capture.types.length
    ? capture.types.map(type => String(type).toLowerCase()).filter(type => TYPE_COLORS[type]).slice(0, 2)
    : await resolvePokemonTypes(pokemonName, speciesName);

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.save();
  roundedRectPath(ctx, EDGE / 2, EDGE / 2, CARD_WIDTH - EDGE, CARD_HEIGHT - EDGE, EDGE_RADIUS);
  ctx.clip();

  await drawBackground(ctx, types);

  const innerW = CARD_WIDTH - MARGIN * 2;
  const innerH = CARD_HEIGHT - MARGIN * 2;
  const panelX = MARGIN;
  const panelY = MARGIN;
  const barH = 126;
  const gap = 42;
  const panelH = innerH - barH - gap;
  const leftW = Math.floor(innerW * 0.56);
  const rightX = panelX + leftW + 35;
  const rightW = innerW - leftW - 35;

  const borderPaint = createTypeGradient(ctx, types, panelX, panelY, innerW, panelH);
  const primaryColor = TYPE_COLORS[types[0] || 'normal'] || '#ffffff';
  const secondaryColor = TYPE_COLORS[types[1] || types[0] || 'normal'] || primaryColor;

  ctx.save();
  roundedRectPath(ctx, panelX, panelY, innerW, panelH, 44);
  ctx.fillStyle = 'rgba(20,20,24,0.62)';
  ctx.fill();

  ctx.shadowColor = primaryColor;
  ctx.shadowBlur = 36;
  strokeRounded(ctx, panelX, panelY, innerW, panelH, 44, borderPaint, 22);

  if (types[1]) {
    ctx.shadowColor = secondaryColor;
    ctx.shadowBlur = 26;
    strokeRounded(ctx, panelX, panelY, innerW, panelH, 44, borderPaint, 14);
  }

  ctx.shadowBlur = 0;
  strokeRounded(ctx, panelX, panelY, innerW, panelH, 44, borderPaint, 10);
  ctx.restore();

  const contentX = panelX + 72;
  const contentY = panelY + 82;
  const contentW = leftW - 118;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.font = 'bold 74px sans-serif';
  drawOutlinedText(ctx, username, contentX, contentY, '#86efac', 'rgba(0,0,0,0.72)', 8);

  ctx.font = 'bold 74px sans-serif';
  drawOutlinedText(ctx, 'has captured a wild', contentX, contentY + 92, '#ffffff', 'rgba(0,0,0,0.72)', 8);

  const pokemonFontSize = fitFont(ctx, pokemonName, 118, 72, contentW, 'bold');
  ctx.font = `bold ${pokemonFontSize}px sans-serif`;
  const nameY = contentY + 214;
  const nameGradient = createTypeGradient(ctx, types, contentX, nameY, contentW, pokemonFontSize);
  ctx.save();
  ctx.shadowColor = primaryColor;
  ctx.shadowBlur = 24;
  drawOutlinedText(ctx, pokemonName, contentX, nameY, nameGradient, 'rgba(0,0,0,0.82)', 10);
  ctx.restore();

  ctx.font = 'bold 64px sans-serif';
  const labels = ['Points:', 'Rarity:', 'Rank:'];
  const labelW = Math.max(...labels.map(label => ctx.measureText(label).width));
  const valueW = contentW - labelW - 42;
  let metaY = nameY + pokemonFontSize + 72;

  metaY += drawMetaRow(ctx, 'Points:', String(points), contentX, metaY, labelW, valueW) + 20;
  metaY += drawMetaRow(ctx, 'Rarity:', rarity, contentX, metaY, labelW, valueW) + 20;
  drawMetaRow(ctx, 'Rank:', rank, contentX, metaY, labelW, valueW);

  const sprite = await loadSprite(pokemonName, speciesName);
  if (sprite) {
    const maxW = rightW - 80;
    const maxH = panelH - 150;
    const scale = Math.min(maxW / sprite.width, maxH / sprite.height);
    const w = sprite.width * scale;
    const h = sprite.height * scale;
    const x = rightX + (rightW - w) / 2;
    const y = panelY + 78 + (maxH - h) / 2;

    ctx.save();
    ctx.shadowColor = primaryColor;
    ctx.shadowBlur = 34;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, x, y, w, h);
    ctx.restore();
  }

  const barY = CARD_HEIGHT - MARGIN - barH;
  ctx.save();
  roundedRectPath(ctx, MARGIN, barY, innerW, barH, 34);
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.fill();
  ctx.shadowColor = primaryColor;
  ctx.shadowBlur = 26;
  strokeRounded(ctx, MARGIN, barY, innerW, barH, 34, borderPaint, 20);
  ctx.shadowBlur = 0;
  strokeRounded(ctx, MARGIN, barY, innerW, barH, 34, borderPaint, 8);
  ctx.restore();

  ctx.font = 'bold 74px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#111827';
  ctx.fillText(typeLabel(types), CARD_WIDTH / 2, barY + barH / 2 + 2);

  ctx.restore();

  ctx.save();
  const outerPaint = createTypeGradient(ctx, types, 0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.shadowColor = primaryColor;
  ctx.shadowBlur = 24;
  roundedRectPath(ctx, EDGE / 2, EDGE / 2, CARD_WIDTH - EDGE, CARD_HEIGHT - EDGE, EDGE_RADIUS);
  ctx.lineWidth = EDGE;
  ctx.strokeStyle = outerPaint;
  ctx.stroke();
  ctx.restore();

  const outPath = path.join(OUTPUT_DIR, `capture_${Date.now()}_${Math.floor(Math.random() * 100000)}.png`);
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  return outPath;
}

module.exports = {
  TYPE_COLORS,
  createCaptureCard,
  resolvePokemonTypes,
  stripVortexVariant
};
