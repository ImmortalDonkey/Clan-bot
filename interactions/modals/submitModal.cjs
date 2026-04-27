const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database.cjs');

function parseType(name) {
  const lower = name.toLowerCase();
  if (lower.includes('shadow')) return 'shadow';
  if (lower.includes('shiny')) return 'shiny';
  if (lower.includes('metallic')) return 'metallic';
  if (lower.includes('mystic')) return 'mystic';
  if (lower.includes('dark')) return 'dark';
  return 'normal';
}

function parseSpecies(name) {
  return name.split(' ').slice(-1)[0].toLowerCase();
}

module.exports = {
  ids: ['submit_pokemon_modal'],

  async execute(client, interaction) {
    const event = await db.getActiveEvent(interaction.guildId);
    if (!event) {
      return interaction.reply({ content: 'No active event.', ephemeral: true });
    }

    const ign = interaction.fields.getTextInputValue('ign');
    const name = interaction.fields.getTextInputValue('pokemon_name');
    const pokemonId = interaction.fields.getTextInputValue('pokemon_id');

    if (!pokemonId.startsWith('#')) {
      return interaction.reply({ content: 'Invalid Pokémon ID format.', ephemeral: true });
    }

    const exists = await db.get(
      `SELECT 1 FROM submissions WHERE event_id = ? AND pokemon_id = ? LIMIT 1`,
      [event.id, pokemonId]
    );

    if (exists) {
      return interaction.reply({ content: 'This Pokémon ID was already submitted.', ephemeral: true });
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
        db.normIgn(ign),
        name,
        species,
        type,
        pokemonId,
        points,
        db.nowMs()
      ]
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`verify_${res.lastID}`).setLabel('Verify').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`reject_${res.lastID}`).setLabel('Reject').setStyle(ButtonStyle.Danger)
    );

    const channel = await client.channels.fetch(event.verification_channel_id);

    await channel.send({
      content: `New submission\nUser: <@${interaction.user.id}>\nIGN: ${ign}\n${name}\nID: ${pokemonId}\nPoints: ${points}`,
      components: [row]
    });

    await interaction.reply({ content: 'Submission sent for verification.', ephemeral: true });
  }
};