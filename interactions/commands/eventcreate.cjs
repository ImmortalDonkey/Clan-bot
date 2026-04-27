const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('../../database.cjs');

function parseTime(input) {
  const n = Number(input);
  if (!Number.isNaN(n)) return n;
  const t = Date.parse(input);
  if (!Number.isNaN(t)) return t;
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eventcreate')
    .setDescription('Create a new clan event')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('name').setDescription('Event name').setRequired(true))
    .addStringOption(o => o.setName('start').setDescription('Start time (ms or ISO)').setRequired(true))
    .addStringOption(o => o.setName('end').setDescription('End time (ms or ISO)').setRequired(true))
    .addChannelOption(o => o.setName('announcement_channel').setDescription('Announcement channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption(o => o.setName('log_channel').setDescription('Log channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption(o => o.setName('verification_channel').setDescription('Verification channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addRoleOption(o => o.setName('staff_role').setDescription('Staff role').setRequired(true)),

  async execute(client, interaction) {
    const guildId = interaction.guildId;

    const existing = await db.getCurrentEvent(guildId);
    if (existing) {
      return interaction.reply({ content: '❌ An event already exists or is active.', ephemeral: true });
    }

    const name = interaction.options.getString('name');
    const start = parseTime(interaction.options.getString('start'));
    const end = parseTime(interaction.options.getString('end'));

    if (!start || !end || end <= start) {
      return interaction.reply({ content: '❌ Invalid start/end times.', ephemeral: true });
    }

    const announcement_channel = interaction.options.getChannel('announcement_channel');
    const log_channel = interaction.options.getChannel('log_channel');
    const verification_channel = interaction.options.getChannel('verification_channel');
    const staff_role = interaction.options.getRole('staff_role');

    const configPath = path.join(__dirname, '..', '..', 'config', 'eventRewards.json');
    const rewardConfig = fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      : {};

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
      created_at: db.nowMs(),
      wipe_after: null
    });

    await interaction.reply({
      content: `✅ Event created (ID: ${id})\nStart: <t:${Math.floor(start/1000)}:F>\nEnd: <t:${Math.floor(end/1000)}:F>`,
      ephemeral: true
    });
  }
};