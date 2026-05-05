const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const db = require('../../database.cjs');

const PRIVATE_REPLY = MessageFlags.Ephemeral;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('submit')
    .setDescription('Submit a caught Pokémon'),

  async execute(client, interaction) {
    const registeredIgn = await db.getRegisteredIgn(interaction.guildId, interaction.user.id);

    if (!registeredIgn) {
      return interaction.reply({
        content: 'You must register your IGN before submitting. Use /registerign first.',
        flags: PRIVATE_REPLY
      });
    }

    const modal = new ModalBuilder()
      .setCustomId('submit_pokemon_modal')
      .setTitle('Submit Pokémon');

    const name = new TextInputBuilder()
      .setCustomId('pokemon_name')
      .setLabel('Pokémon (e.g. Shadow Charizard)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const id = new TextInputBuilder()
      .setCustomId('pokemon_id')
      .setLabel('Pokémon ID (#XXXXXXXXXX)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(name),
      new ActionRowBuilder().addComponents(id)
    );

    await interaction.showModal(modal);
  }
};
