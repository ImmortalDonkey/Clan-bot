const fs = require('fs');
const { AttachmentBuilder } = require('discord.js');
const db = require('../database.cjs');

let renderer = null;
try {
  renderer = require('../renderers/captureCard.cjs');
} catch (err) {
  console.warn('⚠ Capture card renderer unavailable:', err.message);
}

function displaySpecies(species) {
  return String(species || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function ordinal(n) {
  const value = Number(n);
  if (!Number.isFinite(value) || value <= 0) return 'Unranked';

  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;

  switch (value % 10) {
    case 1: return `${value}st`;
    case 2: return `${value}nd`;
    case 3: return `${value}rd`;
    default: return `${value}th`;
  }
}

function rarityLabel(type) {
  const key = String(type || 'normal').toLowerCase();
  const labels = {
    normal: 'Normal',
    metallic: 'Metallic',
    mystic: 'Mystic',
    dark: 'Dark',
    shadow: 'Shadow',
    shiny: 'Shiny'
  };
  return labels[key] || displaySpecies(key);
}

async function getUserRank(eventId, discordId, ignNorm) {
  const rows = await db.all(
    `SELECT discord_id, ign_norm, points
     FROM event_users
     WHERE event_id = ?
     ORDER BY points DESC, ign COLLATE NOCASE ASC`,
    [eventId]
  );

  const index = rows.findIndex(row => {
    if (discordId && row.discord_id === discordId) return true;
    if (ignNorm && row.ign_norm === ignNorm) return true;
    return false;
  });

  return index >= 0 ? ordinal(index + 1) : 'Unranked';
}

async function resolveUsername(client, guildId, discordId, fallback) {
  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(discordId);
    return member?.displayName || member?.user?.username || fallback;
  } catch {
    try {
      const user = await client.users.fetch(discordId);
      return user?.username || fallback;
    } catch {
      return fallback;
    }
  }
}

async function sendCaptureLog(client, event, submission) {
  const channel = await client.channels.fetch(event.log_channel_id);
  if (!channel || !channel.isTextBased()) return false;

  const username = await resolveUsername(
    client,
    submission.guild_id,
    submission.discord_id,
    submission.ign || 'Unknown'
  );

  const rank = await getUserRank(event.id, submission.discord_id, submission.ign_norm);
  const speciesName = displaySpecies(submission.pokemon_species);
  const rarity = rarityLabel(submission.pokemon_type);

  const fallbackContent = `<@${submission.discord_id}> has captured a wild ${submission.pokemon_name}\n\nPoints: ${submission.points_awarded}\nRarity: ${rarity}\nRank: ${rank}`;

  if (!renderer?.createCaptureCard) {
    await channel.send(fallbackContent);
    return true;
  }

  let imagePath = null;

  try {
    const types = await renderer.resolvePokemonTypes(submission.pokemon_name, speciesName);
    imagePath = await renderer.createCaptureCard({
      username,
      ign: submission.ign,
      pokemonName: submission.pokemon_name,
      speciesName,
      points: submission.points_awarded,
      rarity,
      rank,
      types
    });

    const file = new AttachmentBuilder(imagePath, { name: 'capture-card.png' });
    await channel.send({ files: [file] });
    return true;
  } catch (err) {
    console.error('❌ Failed to send capture card:', err);
    await channel.send(fallbackContent);
    return true;
  } finally {
    if (imagePath) {
      setTimeout(() => {
        fs.unlink(imagePath, () => {});
      }, 15_000);
    }
  }
}

module.exports = {
  sendCaptureLog,
  ordinal,
  rarityLabel,
  displaySpecies
};
