const db = require('../../database.cjs');

const fs = require('fs');
const path = require('path');

function loadConfig() {
  const configPath = path.join(__dirname, '..', '..', 'config', 'eventRewards.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function displaySpecies(species) {
  return String(species || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function maybeAwardSetBonus(client, submission, event, logChannel) {
  const alreadyAwarded = await db.get(
    `SELECT 1 FROM set_bonuses
     WHERE event_id = ? AND discord_id = ? AND pokemon_species = ?
     LIMIT 1`,
    [submission.event_id, submission.discord_id, submission.pokemon_species]
  );

  if (alreadyAwarded) return false;

  const rows = await db.all(
    `SELECT DISTINCT pokemon_type FROM submissions
     WHERE event_id = ?
       AND discord_id = ?
       AND pokemon_species = ?
       AND status = 'VERIFIED'`,
    [submission.event_id, submission.discord_id, submission.pokemon_species]
  );

  const ownedTypes = new Set(rows.map(row => row.pokemon_type));
  const hasFullSet = FULL_SET_TYPES.every(type => ownedTypes.has(type));

  if (!hasFullSet) return false;

  await db.run(
    `INSERT INTO set_bonuses
      (event_id, guild_id, discord_id, ign, ign_norm, pokemon_species, bonus_points, awarded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      submission.event_id,
      submission.guild_id,
      submission.discord_id,
      submission.ign,
      submission.ign_norm,
      submission.pokemon_species,
      SET_BONUS_POINTS,
      db.nowMs()
    ]
  );

  await db.addEventUserPoints({
    event_id: submission.event_id,
    guild_id: submission.guild_id,
    discord_id: submission.discord_id,
    ign: submission.ign,
    points: SET_BONUS_POINTS,
    reason: `full_set:${submission.pokemon_species}`
  });

  await logChannel.send(
    `🔥 <@${submission.discord_id}> has completed the full ${displaySpecies(submission.pokemon_species)} set and earned +${SET_BONUS_POINTS} bonus points!`
  );

  console.log(`🎯 Set bonus awarded: event=${event.id} user=${submission.discord_id} species=${submission.pokemon_species}`);
  return true;
}

module.exports = {
  ids: ['verify_', 'reject_'],

  async execute(client, interaction) {
    const id = interaction.customId;
    const isVerify = id.startsWith('verify_');
    const submissionId = id.split('_')[1];

    const submission = await db.get(`SELECT * FROM submissions WHERE id = ?`, [submissionId]);
    if (!submission) return;

    if (submission.status !== 'PENDING') {
      return interaction.reply({ content: 'Already processed.', ephemeral: true });
    }

    const event = await db.getEventById(submission.event_id);

    const hasStaffRole = interaction.member?.roles?.cache?.has(event.staff_role_id);
    if (!hasStaffRole) {
      return interaction.reply({ content: 'You do not have permission to verify submissions.', ephemeral: true });
    }

    if (isVerify) {
      await db.run(
        `UPDATE submissions SET status = 'VERIFIED', verified_by = ?, verified_at = ? WHERE id = ?`,
        [interaction.user.id, db.nowMs(), submissionId]
      );

      await db.addEventUserPoints({
        event_id: submission.event_id,
        guild_id: submission.guild_id,
        discord_id: submission.discord_id,
        ign: submission.ign,
        points: submission.points_awarded,
        reason: 'pokemon'
      });

      const logChannel = await client.channels.fetch(event.log_channel_id);

      await logChannel.send(
        `<@${submission.discord_id}> found ${submission.pokemon_name} and earned ${submission.points_awarded} points.`
      );

      await maybeAwardSetBonus(client, submission, event, logChannel);

      await interaction.update({
        content: `✅ Verified by <@${interaction.user.id}>\nIGN: ${submission.ign}\nPokémon: ${submission.pokemon_name}\nID: ${submission.pokemon_id}\nPoints: ${submission.points_awarded}`,
        components: []
      });
    } else {
      await db.run(
        `UPDATE submissions SET status = 'REJECTED', rejected_by = ?, rejected_at = ? WHERE id = ?`,
        [interaction.user.id, db.nowMs(), submissionId]
      );

      const user = await client.users.fetch(submission.discord_id);
      user.send(`Your submission (${submission.pokemon_name} ${submission.pokemon_id}) was rejected.`).catch(() => {});

      await interaction.update({
        content: `❌ Rejected by <@${interaction.user.id}>\nIGN: ${submission.ign}\nPokémon: ${submission.pokemon_name}\nID: ${submission.pokemon_id}`,
        components: []
      });
    }
  }
};
