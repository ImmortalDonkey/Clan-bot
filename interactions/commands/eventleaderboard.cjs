const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database.cjs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eventleaderboard')
    .setDescription('View current event leaderboard'),

  async execute(client, interaction) {
    const event = await db.getCurrentEvent(interaction.guildId);
    if (!event) {
      return interaction.reply({ content: 'No active event.', ephemeral: true });
    }

    const rows = await db.getLeaderboard(event.id);

    if (!rows.length) {
      return interaction.reply({ content: 'No participants yet.', ephemeral: true });
    }

    const lines = rows.map((r, i) => `${i + 1}. ${r.ign} — ${r.points}`);

    await interaction.reply({
      content: `🏆 **Leaderboard**\n\n${lines.join('\n')}`
    });
  }
};