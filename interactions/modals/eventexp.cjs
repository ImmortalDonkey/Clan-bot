const { parseExpTable } = require('../../services/expParser.cjs');
const db = require('../../database.cjs');
const { getExpTargetEvent } = require('../../services/eventSelector.cjs');

module.exports = {
  ids: ['exp_start', 'exp_end'],

  async execute(client, interaction) {
    try {
      const type = interaction.customId.split('_')[1];
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
          `INSERT INTO exp_snapshots (event_id, ign, ign_norm, exp_value, type, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(event_id, ign_norm, type)
           DO UPDATE SET exp_value = excluded.exp_value`,
          [
            event.id,
            row.ign,
            row.ign_norm,
            row.experience,
            type,
            db.nowMs()
          ]
        );
      }

      await interaction.reply({
        content: `✅ Imported ${type.toUpperCase()} EXP for ${rows.length} players`,
        flags: 64
      });

    } catch (err) {
      console.error('EXP modal error:', err);
      await interaction.reply({ content: '❌ Failed to process EXP data.', flags: 64 });
    }
  }
};
