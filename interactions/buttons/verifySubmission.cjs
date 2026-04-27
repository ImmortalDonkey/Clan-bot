const db = require('../../database.cjs');

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

    if (isVerify) {
      await db.run(`UPDATE submissions SET status='VERIFIED', verified_by=?, verified_at=? WHERE id=?`, [interaction.user.id, db.nowMs(), submissionId]);

      await db.addEventUserPoints({
        event_id: submission.event_id,
        guild_id: submission.guild_id,
        discord_id: submission.discord_id,
        ign: submission.ign,
        points: submission.points_awarded,
        reason: 'pokemon'
      });

      const event = await db.getEventById(submission.event_id);
      const logChannel = await client.channels.fetch(event.log_channel_id);

      await logChannel.send(`<@${submission.discord_id}> found ${submission.pokemon_name} and earned ${submission.points_awarded} points`);

      await interaction.update({ content: 'Verified', components: [] });
    } else {
      await db.run(`UPDATE submissions SET status='REJECTED', rejected_by=?, rejected_at=? WHERE id=?`, [interaction.user.id, db.nowMs(), submissionId]);

      const user = await client.users.fetch(submission.discord_id);
      user.send(`Your submission (${submission.pokemon_name} ${submission.pokemon_id}) was rejected.`).catch(()=>{});

      await interaction.update({ content: 'Rejected', components: [] });
    }
  }
};