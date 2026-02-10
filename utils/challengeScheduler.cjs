const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const db = require('../database.cjs');
const { createChallengeCard } = require('../renderers/challengeCard.cjs');

/* -----------------------------------------------------------
 * Role → Rank mapping (LOCKED)
 * ----------------------------------------------------------- */
const ROLE_RANKS = [
  { name: 'Leader', label: 'Leader' },
  { name: 'Co-Leader', label: 'Co-Leader' },
  { name: 'Elite', label: 'Elite' },
  { name: 'Member', label: 'Member' }
];

function getRankFromMember(member) {
  if (!member) return 'Member';

  for (const r of ROLE_RANKS) {
    if (member.roles.cache.some(role => role.name === r.name)) {
      return r.label;
    }
  }

  return 'Member';
}

/* -----------------------------------------------------------
 * Time helper — round to end of hour
 * ----------------------------------------------------------- */
function roundToEndOfHour(ts) {
  const d = new Date(ts);
  d.setMinutes(59, 59, 999);
  return d.getTime();
}

/* -----------------------------------------------------------
 * Normalize DB row → camelCase
 * ----------------------------------------------------------- */
function normalize(ch) {
  if (!ch) return null;

  return {
    id: ch.id,
    guildId: ch.guild_id || ch.guildId,
    issuerId: ch.issuer_id || ch.issuerId,
    issuerName: ch.issuer_name || ch.issuerName,

    pokemon:
      typeof ch.pokemon === 'string'
        ? ch.pokemon
        : Array.isArray(ch.pokemons)
        ? ch.pokemons[0]
        : ch.pokemons_json
        ? JSON.parse(ch.pokemons_json)[0]
        : null,

    notes: ch.notes,
    startTime: ch.start_time || ch.startTime,
    endTime: ch.end_time || ch.endTime,

    rarityKey: ch.rarity_key || ch.rarityKey,
    rarityLabel: ch.rarity_label || ch.rarityLabel,
    points: ch.points,

    status: ch.status,
    cardChannelId: ch.card_channel_id || ch.cardChannelId,
    cardMessageId: ch.card_message_id || ch.cardMessageId
  };
}

/* -----------------------------------------------------------
 * Post ACTIVE challenge card
 * ----------------------------------------------------------- */
async function postChallengeCard(client, raw) {
  const challenge = normalize(raw);
  if (!challenge) return;

  const guild = client.guilds.cache.get(challenge.guildId);
  if (!guild) {
    console.error('❌ Guild not found:', challenge.guildId);
    return;
  }

  const channel = guild.channels.cache.get(process.env.CHALLENGE_CHANNEL_ID);
  if (!channel) {
    console.error('❌ CHALLENGE_CHANNEL_ID invalid');
    return;
  }

  const member = await guild.members
    .fetch(challenge.issuerId)
    .catch(() => null);

  const issuedBy =
    member?.nickname ||
    member?.displayName ||
    member?.user?.username ||
    challenge.issuerName ||
    'Unknown';

  const rankName = getRankFromMember(member);

  const startLabel = new Date(challenge.startTime)
    .toLocaleString('en-GB');

  const roundedEnd = roundToEndOfHour(challenge.endTime);
  const endLabel = new Date(roundedEnd)
    .toLocaleString('en-GB');

  const durationLabel = 'Until end of hour';
  const pointsLabel = `${challenge.points} points`;

  const buffer = await createChallengeCard({
    challengeId: challenge.id,
    issuedBy,
    rankName,
    rarityKey: challenge.rarityKey,
    rarityLabel: challenge.rarityLabel,
    pokemonName: challenge.pokemon,
    startLabel,
    endLabel,
    durationLabel,
    note: challenge.notes || 'Good luck!',
    pointsLabel
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`claimchallenge_${challenge.id}`)
      .setLabel('Claim')
      .setStyle(ButtonStyle.Success)
  );

  const msg = await channel.send({
    files: [
      {
        attachment: buffer,
        name: `challenge_${challenge.id}.png`
      }
    ],
    components: [row]
  });

  await db.updateChallenge(challenge.id, {
    card_channel_id: channel.id,
    card_message_id: msg.id
  });

  return msg;
}

/* -----------------------------------------------------------
 * Scheduler
 * ----------------------------------------------------------- */
function startChallengeScheduler(client) {
  const INTERVAL = 60_000;

  setInterval(async () => {
    const now = Date.now();

    try {
      /* ----------------------------
       * Start scheduled challenges
       * ---------------------------- */
      const toStart = await db.getChallengesToStart(now);

      for (const raw of toStart) {
        try {
          const challenge = normalize(raw);
          if (!challenge || challenge.status === 'open') continue;

          await postChallengeCard(client, challenge);
          await db.updateChallenge(challenge.id, { status: 'open' });

        } catch (err) {
          console.error('❌ Error starting challenge:', err);
        }
      }

      /* ----------------------------
       * Expire challenges (delete active card)
       * ---------------------------- */
      const toExpire = await db.getChallengesToExpire(now);

      for (const raw of toExpire) {
        try {
          const challenge = normalize(raw);
          const guild = client.guilds.cache.get(challenge.guildId);
          if (!guild) continue;

          if (challenge.cardMessageId) {
            const ch = guild.channels.cache.get(challenge.cardChannelId);
            if (ch) {
              const msg = await ch.messages
                .fetch(challenge.cardMessageId)
                .catch(() => null);
              if (msg) await msg.delete().catch(() => {});
            }
          }

          await db.updateChallenge(challenge.id, { status: 'expired' });

        } catch (err) {
          console.error('❌ Error expiring challenge:', err);
        }
      }

    } catch (err) {
      console.error('❌ Challenge scheduler tick failed:', err);
    }
  }, INTERVAL);
}

module.exports = {
  postChallengeCard,
  startChallengeScheduler
};