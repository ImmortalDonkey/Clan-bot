const db = require('../../database.cjs');
const { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  ids: ['challengeclaim_modal'],

  async execute(client, interaction) {
    const { guild } = interaction;
    if (!guild) {
      return interaction.reply({ content: '❌ Must be used in a server.', ephemeral: true });
    }

    const ign = interaction.fields.getTextInputValue('ign')?.trim();
    const pokemonId = interaction.fields.getTextInputValue('pokemon_id')?.trim();
    const proof = interaction.fields.getTextInputValue('proof')?.trim();
    const challengeId = interaction.fields.getTextInputValue('challenge_id')?.trim();

    const challenge = await db.getChallengeById(challengeId);
    if (!challenge) {
      return interaction.reply({ content: '❌ Challenge not found.', ephemeral: true });
    }

    if (challenge.status !== 'open') {
      return interaction.reply({ content: '❌ Challenge is not open.', ephemeral: true });
    }

    const forumId = process.env.CLAIMS_FORUM_CHANNEL_ID;
    if (!forumId) {
      return interaction.reply({ content: '❌ Claims forum not configured.', ephemeral: true });
    }

    const forum = await client.channels.fetch(forumId).catch(() => null);
    if (!forum || forum.type !== ChannelType.GuildForum) {
      return interaction.reply({ content: '❌ Claims forum channel is invalid (must be a Forum channel).', ephemeral: true });
    }

    // auto-link IGN (first come)
    const linked = await db.getPlayerByDiscordId(interaction.user.id);
    if (!linked?.ign_norm && ign) {
      await db.upsertPlayerIgn(interaction.user.id, ign);
    }

    const thread = await forum.threads.create({
      name: `Challenge #${challengeId} claim — ${interaction.user.username}`,
      message: {
        content: `New claim submitted by <@${interaction.user.id}> for **Challenge #${challengeId}**`
      }
    });

    const claimId = await db.createChallengeClaim({
      challenge_id: challengeId,
      guild_id: guild.id,
      hunter_id: interaction.user.id,
      ign,
      ign_norm: ign ? db.normIgn(ign) : null,
      pokemon_id: pokemonId,
      proof: proof || null,
      status: 'pending',
      created_at: Date.now(),
      claim_thread_id: thread.id
    });

    const embed = new EmbedBuilder()
      .setTitle(`Claim #${claimId} — Challenge #${challengeId}`)
      .setDescription(
        [
          `**Hunter:** <@${interaction.user.id}>`,
          `**IGN:** ${ign || '—'}`,
          `**Pokemon ID:** ${pokemonId || '—'}`,
          proof ? `**Proof:** ${proof}` : null
        ].filter(Boolean).join('\n')
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`challengeclaim_approve_${claimId}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`challengeclaim_deny_${claimId}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger)
    );

    const msg = await thread.send({ embeds: [embed], components: [row] });

    await db.updateChallengeClaim(claimId, {
      claim_message_id: msg.id
    });

    await interaction.reply({
      content: `✅ Claim submitted! A clan leader will review it in the claims forum.`,
      ephemeral: true
    });
  }
};