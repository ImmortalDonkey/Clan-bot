const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, PermissionsBitField, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('../../database.cjs');

const TEXT_CHANNEL_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const PRIVATE_REPLY = MessageFlags.Ephemeral;

function parseRelativeAmount(amount, unit) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return null;

  const u = unit.toLowerCase();
  if (['m', 'min', 'mins', 'minute', 'minutes'].includes(u)) return n * 60_000;
  if (['h', 'hr', 'hrs', 'hour', 'hours'].includes(u)) return n * 60 * 60_000;
  if (['d', 'day', 'days'].includes(u)) return n * 24 * 60 * 60_000;

  return null;
}

function setClockTime(base, timeText) {
  const match = String(timeText || '').trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = match[2] === undefined ? 0 : Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function parseDateTimeParts(datePart, timePart) {
  const dateMatch = String(datePart || '').trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!dateMatch) return null;

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  let year = Number(dateMatch[3]);
  if (year < 100) year += 2000;

  const timeMatch = String(timePart || '').trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!timeMatch) return null;

  const hour = Number(timeMatch[1]);
  const minute = timeMatch[2] === undefined ? 0 : Number(timeMatch[2]);

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  const d = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;

  return d.getTime();
}

function parseTime(input, now = Date.now()) {
  const raw = String(input || '').trim();
  const lower = raw.toLowerCase();

  if (!raw) return null;
  if (lower === 'now') return now;

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;

  const compactRelative = lower.match(/^now\s*\+\s*(\d+)\s*([a-z]+)$/);
  if (compactRelative) {
    const delta = parseRelativeAmount(compactRelative[1], compactRelative[2]);
    return delta === null ? null : now + delta;
  }

  const inRelative = lower.match(/^in\s+(\d+)\s*([a-z]+)$/);
  if (inRelative) {
    const delta = parseRelativeAmount(inRelative[1], inRelative[2]);
    return delta === null ? null : now + delta;
  }

  const today = lower.match(/^today\s+(\d{1,2}(?::\d{2})?)$/);
  if (today) return setClockTime(now, today[1]);

  const tomorrow = lower.match(/^tomorrow\s+(\d{1,2}(?::\d{2})?)$/);
  if (tomorrow) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return setClockTime(d.getTime(), tomorrow[1]);
  }

  const ukDateTime = raw.match(/^(\d{1,2}[/-]\d{1,2}[/-](?:\d{2}|\d{4}))\s+(\d{1,2}(?::\d{2})?)$/);
  if (ukDateTime) return parseDateTimeParts(ukDateTime[1], ukDateTime[2]);

  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) return parsed;

  return null;
}

function validateChannel(channel, label, interaction) {
  if (!channel || !TEXT_CHANNEL_TYPES.includes(channel.type)) {
    return `${label} must be a normal text or announcement channel.`;
  }

  const me = interaction.guild.members.me;
  const perms = channel.permissionsFor(me);

  if (!perms?.has(PermissionsBitField.Flags.ViewChannel)) return `Bot cannot view ${label}.`;
  if (!perms?.has(PermissionsBitField.Flags.SendMessages)) return `Bot cannot send messages in ${label}.`;

  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eventcreate')
    .setDescription('Create a new clan event')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('name').setDescription('Event name').setRequired(true))
    .addStringOption(o => o.setName('start').setDescription('Examples: now, now+5m, today 20:00, 27/04/2026 20:00').setRequired(true))
    .addStringOption(o => o.setName('end').setDescription('Examples: now+1h, tomorrow 18:30, 27/04/2026 22:00').setRequired(true))
    .addChannelOption(o => o.setName('announcement_channel').setDescription('Announcement channel').setRequired(true))
    .addChannelOption(o => o.setName('log_channel').setDescription('Log channel').setRequired(true))
    .addChannelOption(o => o.setName('verification_channel').setDescription('Verification channel').setRequired(true))
    .addRoleOption(o => o.setName('staff_role').setDescription('Staff role').setRequired(true)),

  async execute(client, interaction) {
    const guildId = interaction.guildId;

    const blockingEvent = await db.get(
      `SELECT * FROM events
       WHERE guild_id = ? AND status IN ('SCHEDULED', 'ACTIVE')
       ORDER BY start_time ASC
       LIMIT 1`,
      [guildId]
    );

    if (blockingEvent) {
      return interaction.reply({ content: '❌ An event is already scheduled or active.', flags: PRIVATE_REPLY });
    }

    const name = interaction.options.getString('name');
    const startInput = interaction.options.getString('start');
    const endInput = interaction.options.getString('end');
    const now = db.nowMs();
    const start = parseTime(startInput, now);
    const end = parseTime(endInput, now);

    if (!start || !end || end <= start) {
      return interaction.reply({
        content: ['❌ Invalid start/end times.', '', 'Valid examples:', '`now`', '`now+5m`', '`now+1h`', '`in 30 minutes`', '`today 20:00`', '`tomorrow 18:30`', '`27/04/2026 20:00`'].join('\n'),
        flags: PRIVATE_REPLY
      });
    }

    const announcement_channel = interaction.options.getChannel('announcement_channel');
    const log_channel = interaction.options.getChannel('log_channel');
    const verification_channel = interaction.options.getChannel('verification_channel');
    const staff_role = interaction.options.getRole('staff_role');

    const validationErrors = [
      validateChannel(announcement_channel, 'announcement channel', interaction),
      validateChannel(log_channel, 'log channel', interaction),
      validateChannel(verification_channel, 'verification channel', interaction)
    ].filter(Boolean);

    if (validationErrors.length) {
      return interaction.reply({ content: `❌ ${validationErrors.join('\n❌ ')}`, flags: PRIVATE_REPLY });
    }

    const configPath = path.join(__dirname, '..', '..', 'config', 'eventRewards.json');
    const rewardConfig = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf-8')) : {};

    const id = await db.createEvent({
      guild_id: guildId,
      name,
      start_time: start,
      end_time: end,
      status: 'SCHEDULED',
      announcement_channel_id: announcement_channel.id,
      log_channel_id: log_channel.id,
      verification_channel_id: verification_channel.id,
      staff_role_id: staff_role.id,
      reward_config_json: JSON.stringify(rewardConfig),
      created_by: interaction.user.id,
      created_at: now,
      wipe_after: null
    });

    await interaction.reply({
      content: [`✅ Event created (ID: ${id})`, `Start: <t:${Math.floor(start / 1000)}:F>`, `End: <t:${Math.floor(end / 1000)}:F>`].join('\n'),
      flags: PRIVATE_REPLY
    });
  }
};
