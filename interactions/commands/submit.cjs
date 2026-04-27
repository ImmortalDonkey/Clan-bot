const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('submit')
    .setDescription('Submit a caught Pokémon'),

  async execute(client, interaction) {
    const modal = new ModalBuilder()
      .setCustomId('submit_pokemon_modal')
      .setTitle('Submit Pokémon');

    const ign = new TextInputBuilder()
      .setCustomId('ign')
      .setLabel('IGN')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

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
      new ActionRowBuilder().addComponents(ign),
      new ActionRowBuilder().addComponents(name),
      new ActionRowBuilder().addComponents(id)
    );

    await interaction.showModal(modal);
  }
};