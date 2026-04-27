const { parseExpTable } = require('../../services/expParser.cjs');
const db = require('../../database.cjs');
const { getExpTargetEvent } = require('../../services/eventSelector.cjs');

module.exports = {
  ids: ['exp_start', 'exp_end'],

  async execute(client, interaction) {
    try {
      const type = interaction.customId.split('_')[1].toUpperCase();
      const raw = interaction.fields.getTextInputValue('exp_input');

      const rows = parseExpTable(raw);

      if (!rows.length) {
        return interaction.reply({ content: '❌ No valid EXP data found.', flags: 64 });
      }

      const event = await getExpTargetEvent(interaction.guildId);
      if (!event) {
        return interaction.reply({ content: '❌ No valid event found.', flags: 64 });
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

      await interaction.reply({
        content: `✅ Imported ${type} EXP for ${rows.length} players into **${event.name}**`,
        flags: 64
      });

    } catch (err) {
      console.error('EXP modal error:', err);
      await interaction.reply({ content: '❌ Failed to process EXP data.', flags: 64 });
    }
  }
};
