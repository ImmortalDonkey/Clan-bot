const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database.cjs');
const { isClanLeader } = require('../../utils/permissions.cjs');
const { postChallengeCard } = require('../../utils/challengeScheduler.cjs');

function genId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Build hour choices: 00:00 → 23:00
 */
function buildHourChoices() {
  const out = [];
  for (let h = 0; h < 24; h++) {
    const label = `${String(h).padStart(2, '0')}:00`;
    out.push({ name: label, value: h });
  }
  return out;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('challengeissue')
    .setDescription('Issue a clan challenge (clan leaders only)')

    // ───────── REQUIRED OPTIONS ─────────
    .addStringOption(o =>
      o
        .setName('pokemon')
        .setDescription('Target Pokémon')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o
        .setName('duration_hours')
        .setDescription('Duration in hours')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(48)
    )

    // ───────── START TIME OPTIONS ─────────
    .addBooleanOption(o =>
      o
        .setName('start_now')
        .setDescription('Start immediately?')
        .setRequired(false)
    )
    .addIntegerOption(o =>
      o
        .setName('start_hour')
        .setDescription('If not start_now, choose start hour (today)')
        .setRequired(false)
        .addChoices(...buildHourChoices())
    )

    // ───────── OPTIONAL ─────────
    .addStringOption(o =>
      o
        .setName('notes')
        .setDescription('Optional notes')
        .setRequired(false)
    ),

  async execute(client, interaction) {
    const { guild, member, user } = interaction;

    if (!guild || !member) {
      return interaction.reply({
        content: '❌ Must be used in a server.',
        ephemeral: true
      });
    }

    if (!isClanLeader(member)) {
      return interaction.reply({
        content: '❌ Clan leaders only.',
        ephemeral: true
      });
    }

    const pokemon = interaction.options.getString('pokemon', true).trim();
    const durationHours = interaction.options.getInteger('duration_hours', true);
    const startNow = interaction.options.getBoolean('start_now') ?? false;
    const startHour = interaction.options.getInteger('start_hour', false);
    const notes = interaction.options.getString('notes', false);

    const now = Date.now();
    let startTime;

    if (startNow) {
      startTime = now;
    } else {
      if (startHour === null || startHour === undefined) {
        return interaction.reply({
          content: '❌ If start_now is false, you must choose a start_hour.',
          ephemeral: true
        });
      }

      const d = new Date(now);
      d.setMinutes(0, 0, 0);
      d.setHours(startHour);

      // If chosen hour already passed today, schedule for tomorrow
      if (d.getTime() <= now) {
        d.setDate(d.getDate() + 1);
      }

      startTime = d.getTime();
    }

    const endTime = startTime + durationHours * 60 * 60_000;
    const id = genId();

    await db.createChallenge({
      id,
      guild_id: guild.id,
      issuer_id: user.id,
      issuer_name: user.username,
      pokemons_json: JSON.stringify([pokemon]),
      notes: notes || null,
      start_time: startTime,
      end_time: endTime,
      duration_hours: durationHours,
      status: startNow ? 'open' : 'scheduled',
      created_at: now
    });

    await interaction.reply({
      content: startNow
        ? `✅ Challenge **#${id}** issued and started.`
        : `✅ Challenge **#${id}** scheduled.`,
      ephemeral: true
    });

    if (startNow) {
      const ch = await db.getChallengeById(id);
      await postChallengeCard(client, {
        ...ch,
        duration_label: `${durationHours} hours`
      });
    }
  }
};