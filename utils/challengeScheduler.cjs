const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const db = require('../database.cjs');
const { createChallengeCard } = require('../renderers/challengeCard.cjs');
const { getPokemonByKey, getPokemonByName } = require('./sharedPokemon.cjs');

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
 * Points mapping (LOCKED)
 * ----------------------------------------------------------- */
function pointsForRarity(rarity) {
  switch (rarity) {
    case 'common':
      return 1;

    case 'rare':
    case 'legendary':
    case 'starter':
      return 20;

    case 'roamerMonth':
      return 30;

    case 'paradox':
      return 100;

    default:
      return 0;
  }
}

/* -----------------------------------------------------------
 * Normalize DB row → camelCase
 * ----------------------------------------------------------- */
function normalize(ch) {
  if (!ch) return null;

  const pokemon =
    typeof ch.pokemon === 'string'
      ? ch.pokemon
      : Array.isArray(ch.pokemons)
      ? ch.pokemons[0]
      : ch.pokemons_json
      ? JSON.parse(ch.pokemons_json)[0]
      : null;

  return {
    id: ch.id,
    guildId: ch.guild_id,
    issuerId: ch.issuer_id,
    issuerName: ch.issuer_name,

    pokemon,
    notes: ch.notes,

    startTime: ch.start_time,
    endTime: ch.end_time,
    durationHours: ch.duration_hours,

    status: ch.status,

    cardChannelId: ch.card_channel_id,
    cardMessageId: ch.card_message_id
  };
}

/* -----------------------------------------------------------
 * Resolve Pokémon from shared DB
 * ----------------------------------------------------------- */
async function resolvePokemon(pokemonNameOrKey) {
  if (!pokemonNameOrKey) return null;

  let row = await getPokemonByKey(pokemonNameOrKey).catch(() => null);
  if (row) return row;

  row = await getPokemonByName(pokemonNameOrKey).catch(() => null);
  return row || null;
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

  const startLabel = new Date(challenge.startTime).toLocaleString('en-GB');
  const endLabel = new Date(challenge.endTime).toLocaleString('en-GB');

  // ✅ SINGLE SOURCE OF TRUTH — FROM DB
  const durationLabel = db.formatChallengeDuration(challenge);

  // ──────────────────────────────
  // Pokémon → rarity → points
  // ──────────────────────────────
  const pokemonRow = await resolvePokemon(challenge.pokemon);

  const rarityKey = pokemonRow?.rarity || 'common';
  const rarityLabel = pokemonRow?.rarity || 'Common';

  const points = pointsForRarity(rarityKey);
  const pointsLabel = `${points} point${points === 1 ? '' : 's'}`;

  const buffer = await createChallengeCard({
    challengeId: challenge.id,
    issuedBy,
    rankName,
    rarityKey,
    rarityLabel,
    pokemonName: pokemonRow?.display_name || challenge.pokemon,
    startLabel,
    endLabel,
    durationLabel, // ← FIXED
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
    files: [{ attachment: buffer, name: `challenge_${challenge.id}.png` }],
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
      const toStart = await db.getChallengesToStart(now);

      for (const raw of toStart) {
        try {
          if (raw.status === 'open') continue;

          await postChallengeCard(client, raw);
          await db.updateChallenge(raw.id, { status: 'open' });
        } catch (err) {
          console.error('❌ Error starting challenge:', err);
        }
      }

      const toExpire = await db.getChallengesToExpire(now);

      for (const raw of toExpire) {
        try {
          const guild = client.guilds.cache.get(raw.guild_id);
          if (!guild) continue;

          if (raw.card_message_id) {
            const ch = guild.channels.cache.get(raw.card_channel_id);
            if (ch) {
              const msg = await ch.messages
                .fetch(raw.card_message_id)
                .catch(() => null);
              if (msg) await msg.delete().catch(() => {});
            }
          }

          await db.updateChallenge(raw.id, { status: 'expired' });
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