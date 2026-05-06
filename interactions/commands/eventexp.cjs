const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

const db = require('../../database.cjs');
const { getExpTargetEvent } = require('../../services/eventSelector.cjs');

const EXP_PER_POINT = 125_000;
const DISCORD_SAFE_MESSAGE_LENGTH = 1800;

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
    flags: 64
  });

  for (const chunk of chunks.slice(1)) {
    await interaction.followUp({
      content: chunk,
      flags: 64
    });
  }
}

async function sendChannelChunks(channel, chunks) {
  for (const chunk of chunks) {
    await channel.send({ content: chunk });
  }
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function truncateText(value, maxLength) {
  const text = String(value || '');

  if (text.length <= maxLength) return text;

  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
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
  const rankW = 4;
  const ignW = 24;
  const caughtW = 14;
  const expW = 13;
  const pointsW = 8;

  const headerLine = [
    pad('Rank', rankW),
    pad('IGN', ignW),
    pad('Pokemon Caught', caughtW),
    pad('EXP Trained', expW),
    pad('Points', pointsW)
  ].join(' | ');

  const dividerLine = [
    '-'.repeat(rankW),
    '-'.repeat(ignW),
    '-'.repeat(caughtW),
    '-'.repeat(expW),
    '-'.repeat(pointsW)
  ].join('-+-');

  const tableLines = rows.map((row, index) => {
    const rank = index + 1;

    return [
      pad(rank, rankW, 'left'),
      pad(truncateText(row.ign, ignW), ignW),
      pad(formatNumber(row.pokemon_caught), caughtW, 'left'),
      pad(formatNumber(row.exp_trained), expW, 'left'),
      pad(formatNumber(row.points), pointsW, 'left')
    ].join(' | ');
  });

  const chunks = [];
  let currentLines = [headerLine, dividerLine];

  for (const line of tableLines) {
    const candidate = [
      `🏆 **${event.name} — Final Results**`,
      '',
      `Total players: ${rows.length}`,
      '',
      '```text',
      ...currentLines,
      line,
      '```'
    ].join('\n');

    if (candidate.length > DISCORD_SAFE_MESSAGE_LENGTH && currentLines.length > 2) {
      chunks.push([
        `🏆 **${event.name} — Final Results**`,
        '',
        `Total players: ${rows.length}`,
        '',
        '```text',
        ...currentLines,
        '```'
      ].join('\n'));

      currentLines = [headerLine, dividerLine, line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 2) {
    chunks.push([
      `🏆 **${event.name} — Final Results**`,
      '',
      `Total players: ${rows.length}`,
      '',
      '```text',
      ...currentLines,
      '```',
      '',
      '🎉 Event complete.'
    ].join('\n'));
  } else {
    chunks.push([
      `🏆 **${event.name} — Final Results**`,
      '',
      'No players found.',
      '',
      '🎉 Event complete.'
    ].join('\n'));
  }

  return chunks;
}

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

    const base = Math.floor(gained / EXP_PER_POINT);
    const bonus = 0;
    const total = base;

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

    results.push(`${end.ign} → +${gained.toLocaleString()} EXP → ${total} pts`);
  }

  return results;
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

      const chunks = chunkLines(
        `📊 Calculated EXP for ${results.length} players\nRate: 125,000 EXP = 1 point\n`,
        results
      );

      return replyWithChunks(interaction, chunks);
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
