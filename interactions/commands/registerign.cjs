const {
  SlashCommandBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const {
  validateIgn,
  createIgnRegistrationRequest,
  setIgnRegistrationStaffMessageId,
  getRegisteredIgn
} = require('../../services/ignRegistry.cjs');

const PRIVATE_REPLY = MessageFlags.Ephemeral;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('registerign')
    .setDescription('Submit your Pokémon Vortex IGN for staff verification')
    .addStringOption(option =>
      option
        .setName('ign')
        .setDescription('Your Pokémon Vortex IGN')
        .setRequired(true)
    ),

  async execute(client, interaction) {
    const staffChannelId = process.env.REGISTER_IGN_CHANNEL_ID;

    if (!staffChannelId) {
      return interaction.reply({
        content: '❌ IGN registration channel is not configured. Staff need to set REGISTER_IGN_CHANNEL_ID in .env.',
        flags: PRIVATE_REPLY
      });
    }

    const ign = interaction.options.getString('ign', true);
    const validationError = validateIgn(ign);

    if (validationError) {
      return interaction.reply({
        content: `❌ ${validationError}`,
        flags: PRIVATE_REPLY
      });
    }

    try {
      const existing = await getRegisteredIgn(interaction.guildId, interaction.user.id);

      const request = await createIgnRegistrationRequest({
        guild_id: interaction.guildId,
        discord_id: interaction.user.id,
        ign
      });

      const staffChannel = await client.channels.fetch(staffChannelId);

      if (!staffChannel || !staffChannel.isTextBased()) {
        return interaction.reply({
          content: '❌ IGN registration channel could not be found or is not a text channel.',
          flags: PRIVATE_REPLY
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ign_verify_${request.id}`)
          .setLabel('Verify')
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(`ign_edit_${request.id}`)
          .setLabel('Edit')
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId(`ign_reject_${request.id}`)
          .setLabel('Reject')
          .setStyle(ButtonStyle.Danger)
      );

      const currentIgnText = existing
        ? `Current approved IGN: **${existing.ign}**\n`
        : '';

      const message = await staffChannel.send({
        content: [
          '📝 **New IGN Registration Request**',
          '',
          `User: <@${interaction.user.id}>`,
          `Discord ID: \`${interaction.user.id}\``,
          currentIgnText,
          `Submitted IGN: **${request.requested_ign}**`,
          '',
          `Request ID: \`${request.id}\``
        ].filter(Boolean).join('\n'),
        components: [row]
      });

      await setIgnRegistrationStaffMessageId(request.id, message.id);

      return interaction.reply({
        content: [
          '✅ Your IGN registration has been sent for staff verification.',
          '',
          `Submitted IGN: **${request.requested_ign}**`,
          '',
          'You will be able to use `/submit` once staff approve it.'
        ].join('\n'),
        flags: PRIVATE_REPLY
      });
    } catch (err) {
      if (err.code === 'IGN_TAKEN') {
        return interaction.reply({
          content: '❌ That IGN is already registered to another Discord user in this server.',
          flags: PRIVATE_REPLY
        });
      }

      if (err.code === 'INVALID_IGN') {
        return interaction.reply({
          content: `❌ ${err.message}`,
          flags: PRIVATE_REPLY
        });
      }

      console.error('❌ /registerign failed:', err);

      return interaction.reply({
        content: '❌ Failed to submit IGN registration request.',
        flags: PRIVATE_REPLY
      });
    }
  }
};
