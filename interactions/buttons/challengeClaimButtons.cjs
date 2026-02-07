const db = require('../../database.cjs');
const { isClanLeader } = require('../../utils/permissions.cjs');
const { getHighestRarityForList, pointsForRarity, getRarityDisplayLabel } = require('../../utils/rarity.cjs');

function safeJsonParse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

module.exports = {
  ids: ['challengeclaim_approve_', 'challengeclaim_deny_'],

  async execute(client, interaction) {
    const { guild, member } = interaction;
    if (!guild || !member) {
      return interaction.reply({ content: '❌ Must be used in a server.', ephemeral: true });
    }
    if (!isClanLeader(member)) {
      return interaction.reply({ content: '❌ Clan leaders only.', ephemeral: true });
    }

    const id = interaction.customId;

    const approve = id.startsWith('challengeclaim_approve_');
    const claimId = id
      .replace('challengeclaim_approve_', '')
      .replace('challengeclaim_deny_', '');

    const claim = await db.getChallengeClaimById(claimId);
    if (!claim) {
      return interaction.reply({ content: '❌ Claim not found.', ephemeral: true });
    }
    if (claim.status !== 'pending') {
      return interaction.reply({ content: '❌ This claim is already resolved.', ephemeral: true });
    }

    const challenge = await db.getChallengeById(claim.challenge_id);
    if (!challenge) {
      return interaction.reply({ content: '❌ Challenge not found.', ephemeral: true });
    }
    if (challenge.status !== 'open') {
      return interaction.reply({ content: '❌ Challenge is not open.', ephemeral: true });
    }

    if (!approve) {
      await db.updateChallengeClaim(claimId, {
        status: 'denied',
        resolved_at: Date.now(),
        resolver_id: interaction.user.id
      });

      return interaction.reply({ content: `❌ Claim #${claimId} denied.`, ephemeral: false });
    }

    // Approve path
    const pokemons = safeJsonParse(challenge.pokemons_json, []);
    const rarityKey = getHighestRarityForList(pokemons);
    const rarityLabel = getRarityDisplayLabel(rarityKey);
    const pts = pointsForRarity(rarityKey);

    // Identity logic:
    // - If user has linked IGN -> award to IGN points
    // - else -> award to Discord points
    const player = await db.getPlayerByDiscordId(claim.hunter_id);
    const ignToUse = player?.ign || claim.ign || null;

    if (ignToUse) {
      await db.addIgnPoints(guild.id, ignToUse, pts, `Challenge #${challenge.id} (${rarityLabel})`);
      await db.incCompletedChallengeIgn(guild.id, ignToUse);
    } else {
      await db.addDiscordPoints(guild.id, claim.hunter_id, pts, `Challenge #${challenge.id} (${rarityLabel})`);
      await db.incCompletedChallengeDiscord(guild.id, claim.hunter_id);
    }

    await db.updateChallengeClaim(claimId, {
      status: 'approved',
      resolved_at: Date.now(),
      resolver_id: interaction.user.id
    });

    await db.updateChallenge(challenge.id, {
      status: 'completed',
      winner_id: claim.hunter_id,
      winner_claim_id: Number(claimId)
    });

    // delete active challenge card
    if (challenge.card_channel_id && challenge.card_message_id) {
      const channel = await client.channels.fetch(challenge.card_channel_id).catch(() => null);
      if (channel) {
        await channel.messages.delete(challenge.card_message_id).catch(() => {});
      }
    }

    return interaction.reply({
      content: `✅ Claim #${claimId} approved. Awarded **${pts} points** (${rarityLabel}).`,
      ephemeral: false
    });
  }
};