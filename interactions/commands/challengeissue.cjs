const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database.cjs');
const { isClanLeader } = require('../../utils/permissions.cjs');
const { postChallengeCard } = require('../../utils/challengeScheduler.cjs');

function genId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('challengeissue')
    .setDescription('Issue a clan challenge (clan leaders only)')
    .addStringOption(o =>
      o.setName('pokemon1').setDescription('Target Pokémon #1').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('pokemon2').setDescription('Target Pokémon #2').setRequired(false)
    )
    .addStringOption(o =>
      o.setName('pokemon3').setDescription('Target Pokémon #3').setRequired(false)
    )
    .addIntegerOption(o =>
      o.setName('duration_hours').setDescription('Duration in hours').setRequired(true).setMinValue(1).setMaxValue(48)
    )
    .addBooleanOption(o =>
      o.setName('start_now').setDescription('Start immediately?').setRequired(false)
    )
    .addIntegerOption(o =>
      o.setName('start_in_minutes').setDescription('If not start_now, start in N minutes').setRequired(false).setMinValue(1).setMaxValue(24 * 60)
    )
    .addStringOption(o =>
      o.setName('notes').setDescription('Optional notes').setRequired(false)
    ),

  async execute(client, interaction) {
    const { guild, member, user } = interaction;
    if (!guild || !member) {
      return interaction.reply({ content: '❌ Must be used in a server.', ephemeral: true });
    }

    if (!isClanLeader(member)) {
      return interaction.reply({ content: '❌ Clan leaders only.', ephemeral: true });
    }

    const p1 = interaction.options.getString('pokemon1', true).trim();
    const p2 = interaction.options.getString('pokemon2', false);
    const p3 = interaction.options.getString('pokemon3', false);

    const durationHours = interaction.options.getInteger('duration_hours', true);
    const startNow = interaction.options.getBoolean('start_now') ?? false;
    const startInMinutes = interaction.options.getInteger('start_in_minutes', false);
    const notes = interaction.options.getString('notes', false);

    const pokemons = [p1, p2, p3].filter(Boolean).map(s => String(s).trim()).filter(Boolean);

    const now = Date.now();
    let startTime = now;
    if (!startNow) {
      if (!startInMinutes) {
        return interaction.reply({
          content: '❌ If start_now is false, provide start_in_minutes.',
          ephemeral: true
        });
      }
      startTime = now + (startInMinutes * 60_000);
    }

    const endTime = startTime + durationHours * 60 * 60_000;

    const id = genId();

    await db.createChallenge({
      id,
      guild_id: guild.id,
      issuer_id: user.id,
      issuer_name: user.username,
      pokemons_json: JSON.stringify(pokemons),
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
        : `✅ Challenge **#${id}** scheduled to start in **${startInMinutes} minutes**.`,
      ephemeral: true
    });

    if (startNow) {
      const ch = await db.getChallengeById(id);
      await postChallengeCard(client, ch);
    }
  }
};