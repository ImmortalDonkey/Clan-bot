const db = require('../../database.cjs');
const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

module.exports = {
  ids: ['claimchallenge_'],

  async execute(client, interaction) {
    const id = interaction.customId;
    const challengeId = id.replace('claimchallenge_', '');

    const challenge = await db.getChallengeById(challengeId);
    if (!challenge) {
      return interaction.reply({ content: '❌ Challenge not found.', ephemeral: true });
    }

    if (challenge.status !== 'open') {
      return interaction.reply({ content: '❌ This challenge is not open.', ephemeral: true });
    }

    const already = await db.hasPendingClaim(challengeId, interaction.user.id);
    if (already) {
      return interaction.reply({ content: '❌ You already have a pending claim for this challenge.', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('challengeclaim_modal')
      .setTitle(`Claim Challenge #${challengeId}`);

    const ign = new TextInputBuilder()
      .setCustomId('ign')
      .setLabel('IGN (in-game name)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(32);

    const pokemonId = new TextInputBuilder()
      .setCustomId('pokemon_id')
      .setLabel('Pokemon ID (or proof reference)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(64);

    const proof = new TextInputBuilder()
      .setCustomId('proof')
      .setLabel('Proof URL (optional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(200);

    const challengeIdField = new TextInputBuilder()
      .setCustomId('challenge_id')
      .setLabel('Challenge ID (do not edit)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setValue(challengeId);

    modal.addComponents(
      new ActionRowBuilder().addComponents(ign),
      new ActionRowBuilder().addComponents(pokemonId),
      new ActionRowBuilder().addComponents(proof),
      new ActionRowBuilder().addComponents(challengeIdField)
    );

    await interaction.showModal(modal);
  }
};