const { parseExpTable } = require('../../services/expParser.cjs');
const db = require('../../database.cjs');
const { getExpTargetEvent } = require('../../services/eventSelector.cjs');
const { applyMidExpPreview } = require('../commands/eventexp.cjs');

const SNAPSHOT_TYPES = {
  start: 'START',
  mid: 'MID',
  end: 'END'
};

module.exports = {
  ids: ['exp_start', 'exp_mid', 'exp_end'],

  async execute(client, interaction) {
    try {
      const key = interaction.customId.split('_')[1];
      const type = SNAPSHOT_TYPES[key];

      if (!type) {
        return interaction.reply({
          content: '❌ Invalid EXP import type.',
          flags: 64
        });
      }

      const raw = interaction.fields.getTextInputValue('exp_input');
      const rows = parseExpTable(raw);

      if (!rows.length) {
        return interaction.reply({
          content: '❌ No valid EXP data found.',
          flags: 64
        });
      }

      const event = await getExpTargetEvent(interaction.guildId);
      if (!event) {
        return interaction.reply({
          content: '❌ No valid event found.',
          flags: 64
        });
      }

      for (const row of rows) {
        await db.run(
          `INSERT INTO exp_snapshots
            (event_id, guild_id, ign, ign_norm, snapshot_type, pokemon_count, experience, source, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, NULL, ?, 'modal', ?, ?)
           ON CONFLICT(event_id, ign_norm, snapshot_type)
           DO UPDATE SET
             ign = excluded.ign,
             experience = excluded.experience,
             source = excluded.source,
             created_by = excluded.created_by,
             created_at = excluded.created_at`,
          [
            event.id,
            interaction.guildId,
            row.ign,
            row.ign_norm,
            type,
            row.experience,
            interaction.user.id,
            db.nowMs()
          ]
        );
      }

      if (type === 'MID') {
        const midResults = await applyMidExpPreview(event, interaction);
        const scoringPlayers = midResults.filter(row => row.points >= 1).length;

        return interaction.reply({
          content: [
            `✅ Imported MID EXP for ${rows.length} players into **${event.name}**`,
            '',
            `Leaderboard updated with temporary mid-event EXP points.`,
            `Scoring players from MID EXP: ${scoringPlayers}`,
            '',
            '`/eventexp calculate` will still use START and END only.'
          ].join('\n'),
          flags: 64
        });
      }

      await interaction.reply({
        content: `✅ Imported ${type} EXP for ${rows.length} players into **${event.name}**`,
        flags: 64
      });

    } catch (err) {
      console.error('EXP modal error:', err);
      await interaction.reply({
        content: '❌ Failed to process EXP data.',
        flags: 64
      });
    }
  }
};
