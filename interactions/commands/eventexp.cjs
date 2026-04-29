const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

const db = require('../../database.cjs');
const { getExpTargetEvent } = require('../../services/eventSelector.cjs');

async function calculateExp(event, interaction) {
  const startRows = await db.all(
    `SELECT ign, ign_norm, experience FROM exp_snapshots WHERE event_id = ? AND snapshot_type = 'START'`,
    [event.id]
  );

  const endRows = await db.all(
    `SELECT ign, ign_norm, experience FROM exp_snapshots WHERE event_id = ? AND snapshot_type = 'END'`,
    [event.id]
  );

  const startMap = new Map(startRows.map(r => [r.ign_norm, r]));
  const results = [];

  for (const end of endRows) {
    const start = startMap.get(end.ign_norm);

    const startExp = start ? start.experience : 0;
    const endExp = end.experience;
    const gained = Math.max(0, endExp - startExp);

    const base = Math.floor(gained / 200000);
    const bonus = Math.floor(gained / 5000000) * 10;
    const total = base + bonus;

    await db.run(
      `INSERT INTO exp_results
       (event_id, guild_id, ign, ign_norm, start_exp, end_exp, exp_gained, base_exp_points, bonus_exp_points, total_exp_points, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(event_id, ign_norm) DO UPDATE SET
         start_exp = excluded.start_exp,
         end_exp = excluded.end_exp,
         exp_gained = excluded.exp_gained,
         base_exp_points = excluded.base_exp_points,
         bonus_exp_points = excluded.bonus_exp_points,
         total_exp_points = excluded.total_exp_points`,
      [
        event.id,
        interaction.guildId,
        end.ign,
        end.ign_norm,
        startExp,
        endExp,
        gained,
        base,
        bonus,
        total,
        db.nowMs()
      ]
    );

    results.push(`${end.ign} → +${gained.toLocaleString()} → ${total} pts`);
  }

  return results;
}

async function postFinalLeaderboard(event, interaction) {
  try {
    const leaderboard = await db.getLeaderboard(event.id, 10);

    const lines = leaderboard.map((row, index) => {
      const medals = ['🥇', '🥈', '🥉'];
      const prefix = medals[index] || `#${index + 1}`;
      return `${prefix} ${row.ign} — ${row.points} pts`;
    });

    const channel = await interaction.client.channels.fetch(event.log_channel_id);
    if (!channel) return;

    await channel.send({
      content:
`🏆 **${event.name} — Final Results**

${lines.join('\n')}

🎉 Event complete.`
    });
  } catch (err) {
    console.error('Failed to post final leaderboard:', err);
  }
}

async function confirmExp(event, interaction) {
  const rows = await db.all(`SELECT * FROM exp_results WHERE event_id = ?`, [event.id]);

  for (const row of rows) {
    await db.addIgnEventPoints({
      event_id: event.id,
      guild_id: interaction.guildId,
      ign: row.ign,
      points: row.total_exp_points,
      reason: 'exp'
    });
  }

  await db.updateEvent(event.id, {
    status: 'COMPLETED',
    finalised_at: db.nowMs()
  });

  await postFinalLeaderboard(event, interaction);

  return rows.length;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eventexp')
    .setDescription('Manage event EXP')
    .addSubcommand(s => s.setName('start').setDescription('Import start EXP'))
    .addSubcommand(s => s.setName('end').setDescription('Import end EXP'))
    .addSubcommand(s => s.setName('calculate').setDescription('Calculate EXP points'))
    .addSubcommand(s => s.setName('confirm').setDescription('Apply EXP points')),

  async execute(client, interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start' || sub === 'end') {
      const modal = new ModalBuilder()
        .setCustomId(`exp_${sub}`)
        .setTitle(`Import ${sub.toUpperCase()} EXP`);

      const input = new TextInputBuilder()
        .setCustomId('exp_input')
        .setLabel('Paste EXP table')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(4000);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      return interaction.showModal(modal);
    }

    const event = await getExpTargetEvent(interaction.guildId);
    if (!event) {
      return interaction.reply({ content: '❌ No event found.', flags: 64 });
    }

    if (sub === 'calculate') {
      const results = await calculateExp(event, interaction);

      return interaction.reply({
        content: `📊 Calculated EXP for ${results.length} players\n\n${results.slice(0, 10).join('\n')}`,
        flags: 64
      });
    }

    if (sub === 'confirm') {
      const count = await confirmExp(event, interaction);

      return interaction.reply({
        content: `🏁 EXP applied for ${count} players. Event finalised.`,
        flags: 64
      });
    }
  }
};
