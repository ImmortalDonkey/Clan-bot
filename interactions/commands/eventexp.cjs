const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  MessageFlags
} = require('discord.js');

const db = require('../../database.cjs');
const { getExpTargetEvent } = require('../../services/eventSelector.cjs');

const EXP_PER_POINT = 125_000;
const DISCORD_SAFE_MESSAGE_LENGTH = 1950;
const PRIVATE_REPLY = MessageFlags.Ephemeral;

function chunkLines(header, lines, maxLength = DISCORD_SAFE_MESSAGE_LENGTH) {
  const chunks = [];
  let current = header;

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;

    if (next.length > maxLength && current) {
      chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

async function replyWithChunks(interaction, chunks) {
  if (!chunks.length) return;

  await interaction.reply({
    content: chunks[0],
    flags: PRIVATE_REPLY
  });

  for (const chunk of chunks.slice(1)) {
    await interaction.followUp({
      content: chunk,
      flags: PRIVATE_REPLY
    });
  }
}

async function sendChannelChunks(channel, chunks) {
  for (const chunk of chunks) {
    await channel.send({ content: chunk });
  }
}

function formatShortNumber(value) {
  const n = Number(value || 0);

  if (!Number.isFinite(n) || n <= 0) return '0';

  if (n >= 1_000_000_000) {
    const v = n / 1_000_000_000;
    return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}b`;
  }

  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}m`;
  }

  if (n >= 1_000) {
    const v = n / 1_000;
    return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}k`;
  }

  return String(Math.floor(n));
}

function truncateText(value, maxLength) {
  const text = String(value || '');
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength);
}

function pad(value, width, direction = 'right') {
  const text = String(value || '');

  if (text.length >= width) return text;

  const padding = ' '.repeat(width - text.length);

  return direction === 'left'
    ? `${padding}${text}`
    : `${text}${padding}`;
}

function buildFinalResultsTableChunks(event, rows) {
  const rankW = 2;
  const ignW = 16;
  const caughtW = 7;
  const expW = 7;
  const pointsW = 5;

  const headerLine = [
    pad('#', rankW, 'left'),
    pad('IGN', ignW),
    pad('Pokemon', caughtW, 'left'),
    pad('EXP', expW, 'left'),
    pad('PTS', pointsW, 'left')
  ].join('|');

  const dividerLine = [
    '-'.repeat(rankW),
    '-'.repeat(ignW),
    '-'.repeat(caughtW),
    '-'.repeat(expW),
    '-'.repeat(pointsW)
  ].join('+');

  const tableLines = rows.map((row, index) => {
    const rank = index + 1;

    return [
      pad(rank, rankW, 'left'),
      pad(truncateText(row.ign, ignW), ignW),
      pad(formatShortNumber(row.pokemon_caught), caughtW, 'left'),
      pad(formatShortNumber(row.exp_trained), expW, 'left'),
      pad(formatShortNumber(row.points), pointsW, 'left')
    ].join('|');
  });

  const intro = [
    `🏆 **${event.name} — Final Results**`,
    '',
    `Total scoring players: ${rows.length}`,
    `Columns: Rank | IGN | Pokemon caught | EXP trained | Points`,
    '',
    '```text',
    headerLine,
    dividerLine
  ];

  const outro = [
    '```',
    '',
    '🎉 Event complete.'
  ];

  if (!tableLines.length) {
    return [[
      `🏆 **${event.name} — Final Results**`,
      '',
      'No players earned points.',
      '',
      '🎉 Event complete.'
    ].join('\n')];
  }

  const fullMessage = [
    ...intro,
    ...tableLines,
    ...outro
  ].join('\n');

  if (fullMessage.length <= DISCORD_SAFE_MESSAGE_LENGTH) {
    return [fullMessage];
  }

  const chunks = [];
  let currentLines = [...intro];

  for (const line of tableLines) {
    const candidate = [
      ...currentLines,
      line,
      ...outro
    ].join('\n');

    if (candidate.length > DISCORD_SAFE_MESSAGE_LENGTH && currentLines.length > intro.length) {
      chunks.push([
        ...currentLines,
        '```'
      ].join('\n'));

      currentLines = [
        `🏆 **${event.name} — Final Results continued**`,
        '',
        '```text',
        headerLine,
        dividerLine,
        line
      ];
    } else {
      currentLines.push(line);
    }
  }

  chunks.push([
    ...currentLines,
    ...outro
  ].join('\n'));

  return chunks;
}

async function removePointsForReason(eventId, reason) {
  const rows = await db.all(
    `SELECT ign_norm, SUM(points) AS points
     FROM point_logs
     WHERE event_id = ?
       AND reason = ?
     GROUP BY ign_norm`,
    [eventId, reason]
  );

  for (const row of rows) {
    const points = Number(row.points || 0);
    if (!points) continue;

    await db.run(
      `UPDATE event_users
       SET points = CASE
           WHEN points - ? < 0 THEN 0
           ELSE points - ?
         END,
         updated_at = ?
       WHERE event_id = ?
         AND ign_norm = ?`,
      [points, points, db.nowMs(), eventId, row.ign_norm]
    );
  }

  await db.run(
    `DELETE FROM point_logs
     WHERE event_id = ?
       AND reason = ?`,
    [eventId, reason]
  );
}

async function calculateExpFromSnapshots(event, interaction, snapshotType, persistResults) {
  const startRows = await db.all(
    `SELECT ign, ign_norm, experience
     FROM exp_snapshots
     WHERE event_id = ?
       AND snapshot_type = 'START'`,
    [event.id]
  );

  const compareRows = await db.all(
    `SELECT ign, ign_norm, experience
     FROM exp_snapshots
     WHERE event_id = ?
       AND snapshot_type = ?`,
    [event.id, snapshotType]
  );

  const startMap = new Map(startRows.map(r => [r.ign_norm, r]));
  const results = [];

  for (const compare of compareRows) {
    const start = startMap.get(compare.ign_norm);

    const startExp = start ? start.experience : 0;
    const compareExp = compare.experience;
    const gained = Math.max(0, compareExp - startExp);

    const base = Math.floor(gained / EXP_PER_POINT);
    const bonus = 0;
    const total = base;

    if (persistResults) {
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
          compare.ign,
          compare.ign_norm,
          startExp,
          compareExp,
          gained,
          base,
          bonus,
          total,
          db.nowMs()
        ]
      );
    }

    results.push({
      ign: compare.ign,
      ign_norm: compare.ign_norm,
      start_exp: startExp,
      compare_exp: compareExp,
      exp_gained: gained,
      points: total,
      line: `${compare.ign} → +${gained.toLocaleString()} EXP → ${total} pts`
    });
  }

  return results;
}

async function applyMidExpPreview(event, interaction) {
  await removePointsForReason(event.id, 'mid_exp');

  const results = await calculateExpFromSnapshots(event, interaction, 'MID', false);

  for (const row of results) {
    if (row.points < 1) continue;

    await db.addIgnEventPoints({
      event_id: event.id,
      guild_id: interaction.guildId,
      ign: row.ign,
      points: row.points,
      reason: 'mid_exp'
    });
  }

  return results;
}

async function calculateFinalExp(event, interaction) {
  return await calculateExpFromSnapshots(event, interaction, 'END', true);
}

async function postFinalLeaderboard(event, interaction) {
  try {
    const rows = await db.all(
      `SELECT
         eu.ign,
         eu.points,
         COALESCE(pc.pokemon_caught, 0) AS pokemon_caught,
         COALESCE(er.exp_gained, 0) AS exp_trained
       FROM event_users eu
       LEFT JOIN (
         SELECT
           event_id,
           ign_norm,
           COUNT(*) AS pokemon_caught
         FROM submissions
         WHERE event_id = ?
           AND status = 'VERIFIED'
         GROUP BY event_id, ign_norm
       ) pc
         ON pc.event_id = eu.event_id
        AND pc.ign_norm = eu.ign_norm
       LEFT JOIN exp_results er
         ON er.event_id = eu.event_id
        AND er.ign_norm = eu.ign_norm
       WHERE eu.event_id = ?
         AND eu.points >= 1
       ORDER BY eu.points DESC, eu.ign COLLATE NOCASE ASC`,
      [event.id, event.id]
    );

    const channel = await interaction.client.channels.fetch(event.log_channel_id);
    if (!channel) return;

    const chunks = buildFinalResultsTableChunks(event, rows);

    await sendChannelChunks(channel, chunks);
  } catch (err) {
    console.error('Failed to post final leaderboard:', err);
  }
}

async function confirmExp(event, interaction) {
  await removePointsForReason(event.id, 'mid_exp');
  await removePointsForReason(event.id, 'exp');

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
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('start').setDescription('Import start EXP'))
    .addSubcommand(s => s.setName('mid').setDescription('Import mid-event EXP and update the leaderboard'))
    .addSubcommand(s => s.setName('end').setDescription('Import end EXP'))
    .addSubcommand(s => s.setName('calculate').setDescription('Calculate final EXP points from START and END only'))
    .addSubcommand(s => s.setName('confirm').setDescription('Apply final EXP points')),

  async execute(client, interaction) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ You must be a Discord administrator to use this command.',
        flags: PRIVATE_REPLY
      });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'start' || sub === 'mid' || sub === 'end') {
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
      return interaction.reply({ content: '❌ No event found.', flags: PRIVATE_REPLY });
    }

    if (sub === 'calculate') {
      const results = await calculateFinalExp(event, interaction);
      const lines = results.map(row => row.line);

      const chunks = chunkLines(
        `📊 Calculated FINAL EXP for ${results.length} players\nRate: 125,000 EXP = 1 point\nSource: START → END only\n`,
        lines
      );

      return replyWithChunks(interaction, chunks);
    }

    if (sub === 'confirm') {
      const count = await confirmExp(event, interaction);

      return interaction.reply({
        content: `🏁 Final EXP applied for ${count} players. Event finalised.`,
        flags: PRIVATE_REPLY
      });
    }
  },

  applyMidExpPreview
};
