const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');

const db = require('../../database.cjs');
const { getRegisteredIgn } = require('../../services/ignRegistry.cjs');

const PRIVATE_REPLY = MessageFlags.Ephemeral;

function parseType(name) {
  const firstWord = String(name || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)[0];

  if (firstWord === 'shadow') return 'shadow';
  if (firstWord === 'shiny') return 'shiny';
  if (firstWord === 'metallic') return 'metallic';
  if (firstWord === 'mystic') return 'mystic';
  if (firstWord === 'dark') return 'dark';
  if (firstWord === 'normal') return 'normal';

  return 'normal';
}

function parseSpecies(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .slice(-1)[0]
    .toLowerCase();
}

module.exports = {
  ids: ['submit_pokemon_modal'],

  async execute(client, interaction) {
    const event = await db.getActiveEvent(interaction.guildId);
    if (!event) {
      return interaction.reply({
        content: 'No active event.',
        flags: PRIVATE_REPLY
      });
    }

    const registeredIgn = await getRegisteredIgn(interaction.guildId, interaction.user.id);
    if (!registeredIgn) {
      return interaction.reply({
        content: 'You must register your IGN before submitting. Use /registerign first.',
        flags: PRIVATE_REPLY
      });
    }

    const ign = registeredIgn.ign;
    const name = interaction.fields.getTextInputValue('pokemon_name');
    const pokemonId = interaction.fields.getTextInputValue('pokemon_id');

    if (!pokemonId.startsWith('#')) {
      return interaction.reply({
        content: 'Invalid Pokémon ID format.',
        flags: PRIVATE_REPLY
      });
    }

    const exists = await db.get(
      `SELECT 1 FROM submissions WHERE event_id = ? AND pokemon_id = ? LIMIT 1`,
      [event.id, pokemonId]
    );

    if (exists) {
      return interaction.reply({
        content: 'This Pokémon ID was already submitted.',
        flags: PRIVATE_REPLY
      });
    }

    const type = parseType(name);
    const species = parseSpecies(name);

    const pointsMap = {
      normal: 1,
      dark: 5,
      mystic: 5,
      metallic: 5,
      shiny: 10,
      shadow: 10
    };

    const points = pointsMap[type] || 1;

    const res = await db.run(
      `INSERT INTO submissions
        (event_id, guild_id, discord_id, ign, ign_norm, pokemon_name, pokemon_species, pokemon_type, pokemon_id, points_awarded, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [
        event.id,
        interaction.guildId,
        interaction.user.id,
        ign,
        registeredIgn.ign_norm,
        name,
        species,
        type,
        pokemonId,
        points,
        db.nowMs()
      ]
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`verify_${res.lastID}`)
        .setLabel('Verify')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`reject_${res.lastID}`)
        .setLabel('Reject')
        .setStyle(ButtonStyle.Danger)
    );

    const channel = await client.channels.fetch(event.verification_channel_id);

    await channel.send({
      content: `New submission\nUser: <@${interaction.user.id}>\nIGN: ${ign}\n${name}\nID: ${pokemonId}\nPoints: ${points}`,
      components: [row]
    });

    await interaction.reply({
      content: 'Submission sent for verification.',
      flags: PRIVATE_REPLY
    });
  }
};
