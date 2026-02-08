const db = require('../database.cjs');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const {
  getHighestRarityForList,
  getRarityDisplayLabel,
  pointsForRarity
} = require('./rarity.cjs');

function safeJsonParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

async function postChallengeCard(client, challenge) {
  const channelId = process.env.CHALLENGE_CHANNEL_ID;
  if (!channelId) {
    throw new Error('CHALLENGE_CHANNEL_ID missing');
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    throw new Error(`Challenge channel not found (${channelId})`);
  }

  const pokemons = safeJsonParse(challenge.pokemons_json, []);
  const rarityKey = getHighestRarityForList(pokemons);
  const rarityLabel = getRarityDisplayLabel(rarityKey);
  const pts = pointsForRarity(rarityKey);

  const startUnix = Math.floor(Number(challenge.start_time) / 1000);
  const endUnix = Math.floor(Number(challenge.end_time) / 1000);

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ Clan Challenge #${challenge.id}`)
    .setDescription(
      [
        `**Targets:** ${pokemons.map(p => `\`${p}\``).join(', ') || '—'}`,
        `**Rarity:** ${rarityLabel}`,
        `**Points:** ${pts}`,
        `**Starts:** <t:${startUnix}:f>`,
        `**Ends:** <t:${endUnix}:f>`,
        challenge.notes ? `**Notes:** ${challenge.notes}` : null
      ]
        .filter(Boolean)
        .join('\n')
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`claimchallenge_${challenge.id}`)
      .setLabel('Claim')
      .setStyle(ButtonStyle.Success)
  );

  const msg = await channel.send({
    embeds: [embed],
    components: [row]
  });

  await db.updateChallenge(challenge.id, {
    card_channel_id: msg.channel.id,
    card_message_id: msg.id
  });

  console.log(
    `🪪 Challenge card posted: #${challenge.id} → ${msg.channel.id}/${msg.id}`
  );

  return msg;
}

function startChallengeScheduler(client) {
  async function tick() {
    const now = Date.now();

    // Start scheduled challenges
    const toStart = await db.getChallengesToStart(now);
    for (const ch of toStart) {
      await db.updateChallenge(ch.id, { status: 'open' });
      await postChallengeCard(client, ch);
    }

    // Expire open challenges
    const toExpire = await db.getChallengesToExpire(now);
    for (const ch of toExpire) {
      await db.updateChallenge(ch.id, { status: 'expired' });

      const channelId = ch.card_channel_id;
      const messageId = ch.card_message_id;

      if (channelId && messageId) {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel) {
          await channel.messages.delete(messageId).catch(() => {});
        }
      }
    }
  }

  // First tick immediately, then every 60s
  tick().catch(err => {
    console.error('Challenge scheduler tick failed:', err);
  });

  setInterval(() => {
    tick().catch(err => {
      console.error('Challenge scheduler tick failed:', err);
    });
  }, 60_000);
}

module.exports = {
  startChallengeScheduler,
  postChallengeCard
};