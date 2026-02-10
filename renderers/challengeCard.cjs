const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const CARD_WIDTH = 2200;
const CARD_HEIGHT = 1300;
const MARGIN = 40;

// Output folder
const CARDS_DIR = path.join(__dirname, 'card-images');

// Sprites live in Roaming Companion (shared)
const SPRITES_DIR = '/home/pi/discord-bot/sprites';

if (!fs.existsSync(CARDS_DIR)) {
  fs.mkdirSync(CARDS_DIR, { recursive: true });
}

const rarityStyles = {
  legendary: {
    gradientFrom: '#1d4ed8',
    gradientTo: '#22d3ee',
    boxColor: 'rgba(15, 23, 42, 0.95)'
  },
  rare: {
    gradientFrom: '#16a34a',
    gradientTo: '#0f766e',
    boxColor: 'rgba(5, 46, 22, 0.95)'
  },
  common: {
    gradientFrom: '#64748b',
    gradientTo: '#334155',
    boxColor: 'rgba(15, 23, 42, 0.95)'
  }
};

function getStyle(rarity) {
  return rarityStyles[rarity] || rarityStyles.common;
}

function roundedRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function getSpritePath(name) {
  if (!name) return null;
  return path.join(SPRITES_DIR, `${name}.png`);
}

async function drawSpriteBox(ctx, x, y, size, name) {
  ctx.save();
  roundedRect(ctx, x, y, size, size, 30);
  ctx.fillStyle = 'rgba(15,23,42,0.98)';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#f9fafb';
  ctx.stroke();

  const spritePath = getSpritePath(name);
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

async function createChallengeCard(challenge, rarityKey, rarityLabel) {
  const style = getStyle(rarityKey);
  const pokemons = JSON.parse(challenge.pokemons_json || '[]');

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background
  const g = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  g.addColorStop(0, style.gradientFrom);
  g.addColorStop(1, style.gradientTo);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Left box
  const leftX = MARGIN;
  const leftY = MARGIN;
  const leftW = CARD_WIDTH * 0.55;
  const leftH = CARD_HEIGHT - MARGIN * 2;

  roundedRect(ctx, leftX, leftY, leftW, leftH, 40);
  ctx.fillStyle = style.boxColor;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#f9fafb';
  ctx.stroke();

  ctx.font = 'bold 64px sans-serif';
  ctx.fillStyle = '#f9fafb';
  ctx.fillText(`Clan Challenge #${challenge.id}`, leftX + 60, leftY + 100);

  ctx.font = '48px sans-serif';
  ctx.fillText(`Rarity: ${rarityLabel}`, leftX + 60, leftY + 190);

  let y = leftY + 300;
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('Targets:', leftX + 60, y);

  ctx.font = '48px sans-serif';
  y += 80;
  for (const p of pokemons) {
    ctx.fillText(`• ${p}`, leftX + 90, y);
    y += 70;
  }

  // Sprites bottom-right
  const spriteSize = 260;
  const startX = CARD_WIDTH - MARGIN - spriteSize * 3 - 60;
  const spriteY = CARD_HEIGHT - MARGIN - spriteSize;

  for (let i = 0; i < Math.min(3, pokemons.length); i++) {
    await drawSpriteBox(
      ctx,
      startX + i * (spriteSize + 30),
      spriteY,
      spriteSize,
      pokemons[i]
    );
  }

  return canvas.toBuffer('image/png');
}

module.exports = { createChallengeCard };