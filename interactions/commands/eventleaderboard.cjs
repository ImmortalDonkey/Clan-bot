const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database.cjs');

const DISCORD_SAFE_MESSAGE_LENGTH = 1950;

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

async function replyWithChunks(interaction, chunks) {
  if (!chunks.length) return;

  await interaction.reply({ content: chunks[0] });

  for (const chunk of chunks.slice(1)) {
    await interaction.followUp({ content: chunk });
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

function buildLeaderboardTableChunks(event, rows) {
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
    `🏆 **${event.name} Leaderboard** (${event.status})`,
    '',
    `Total scoring players: ${rows.length}`,
    `Columns: Rank | IGN | Pokemon caught | EXP trained | Points`,
    '',
    '```text',
    headerLine,
    dividerLine
  ];

  const outro = ['```'];

  if (!tableLines.length) {
    return [[
      `🏆 **${event.name} Leaderboard** (${event.status})`,
      '',
      'No players have earned points yet.'
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
        `🏆 **${event.name} Leaderboard continued** (${event.status})`,
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

async function getLeaderboardRows(eventId) {
  return await db.all(
    `SELECT
       eu.ign,
       eu.points,
       COALESCE(pc.pokemon_caught, 0) AS pokemon_caught,
       COALESCE(cur.exp_gained, er.exp_gained, 0) AS exp_trained
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
     LEFT JOIN (
       SELECT
         s.event_id,
         s.ign_norm,
         MAX(CASE WHEN s.snapshot_type IN ('MID', 'END') THEN s.experience END) -
         COALESCE(MAX(CASE WHEN s.snapshot_type = 'START' THEN s.experience END), 0) AS exp_gained
       FROM exp_snapshots s
       WHERE s.event_id = ?
       GROUP BY s.event_id, s.ign_norm
     ) cur
       ON cur.event_id = eu.event_id
      AND cur.ign_norm = eu.ign_norm
     LEFT JOIN exp_results er
       ON er.event_id = eu.event_id
      AND er.ign_norm = eu.ign_norm
     WHERE eu.event_id = ?
       AND eu.points >= 1
     ORDER BY eu.points DESC, eu.ign COLLATE NOCASE ASC`,
    [eventId, eventId, eventId]
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eventleaderboard')
    .setDescription('View current event leaderboard'),

  async execute(client, interaction) {
    const event = await getLeaderboardEvent(interaction.guildId);

    if (!event) {
      return interaction.reply({
        content: 'No event found.',
        ephemeral: true
      });
    }

    const rows = await getLeaderboardRows(event.id);
    const chunks = buildLeaderboardTableChunks(event, rows);

    return replyWithChunks(interaction, chunks);
  }
};
