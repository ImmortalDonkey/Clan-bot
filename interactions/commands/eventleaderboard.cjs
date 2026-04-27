const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database.cjs');

async function getLeaderboardEvent(guildId) {
  return await db.get(
    `SELECT * FROM events
     WHERE guild_id = ? AND status IN ('ACTIVE', 'SCHEDULED', 'PENDING_EXP')
     ORDER BY
       CASE status
         WHEN 'ACTIVE' THEN 1
         WHEN 'SCHEDULED' THEN 2
         WHEN 'PENDING_EXP' THEN 3
         ELSE 4
       END,
       CASE WHEN status = 'PENDING_EXP' THEN end_time END DESC,
       start_time ASC
     LIMIT 1`,
    [guildId]
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eventleaderboard')
    .setDescription('View current event leaderboard'),

  async execute(client, interaction) {
    const event = await getLeaderboardEvent(interaction.guildId);
    if (!event) {
      return interaction.reply({ content: 'No event found.', ephemeral: true });
    }

    const rows = await db.getLeaderboard(event.id);

    if (!rows.length) {
      return interaction.reply({
        content: `No participants yet for **${event.name}** (status: ${event.status}).`,
        ephemeral: true
      });
    }

    const lines = rows.map((r, i) => `${i + 1}. ${r.ign} — ${r.points}`);

    await interaction.reply({
      content: `🏆 **${event.name} Leaderboard** (${event.status})\n\n${lines.join('\n')}`
    });
  }
};
