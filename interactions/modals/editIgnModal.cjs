const {
  PermissionFlagsBits,
  MessageFlags
} = require('discord.js');

const {
  validateIgn,
  approveIgnRegistrationRequest
} = require('../../services/ignRegistry.cjs');

const PRIVATE_REPLY = MessageFlags.Ephemeral;

function canEditIgn(interaction) {
  const member = interaction.member;
  const guild = interaction.guild;

  const isOwner = guild?.ownerId === interaction.user.id;
  const isAdmin = member?.permissions?.has(PermissionFlagsBits.Administrator);

  return Boolean(isOwner || isAdmin);
}

async function safeDm(client, discordId, message) {
  try {
    const user = await client.users.fetch(discordId);
    await user.send(message);
  } catch {
    // User may have DMs disabled.
  }
}

module.exports = {
  ids: ['ign_edit_modal'],

  async execute(client, interaction) {
    if (!canEditIgn(interaction)) {
      return interaction.reply({
        content: '❌ You do not have permission to edit IGN registrations.',
        flags: PRIVATE_REPLY
      });
    }

    const requestIdRaw = interaction.fields.getTextInputValue('request_id');
    const finalIgn = interaction.fields.getTextInputValue('ign');

    const requestId = Number(requestIdRaw);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return interaction.reply({
        content: '❌ Invalid request ID.',
        flags: PRIVATE_REPLY
      });
    }

    const validationError = validateIgn(finalIgn);
    if (validationError) {
      return interaction.reply({
        content: `❌ ${validationError}`,
        flags: PRIVATE_REPLY
      });
    }

    try {
      const result = await approveIgnRegistrationRequest({
        id: requestId,
        reviewer_id: interaction.user.id,
        final_ign: finalIgn
      });

      await safeDm(
        client,
        result.request.discord_id,
        `✅ Your IGN has been verified: ${result.saved.ign}\nYou can now use /submit.`
      );

      await interaction.reply({
        content: [
          '✅ IGN registration edited and approved.',
          '',
          `User: <@${result.request.discord_id}>`,
          `Original IGN: **${result.request.requested_ign}**`,
          `Approved IGN: **${result.saved.ign}**`
        ].join('\n'),
        flags: PRIVATE_REPLY
      });

      if (interaction.message?.editable) {
        await interaction.message.edit({
          content: [
            '✅ **IGN Registration Edited + Approved**',
            '',
            `User: <@${result.request.discord_id}>`,
            `Discord ID: \`${result.request.discord_id}\``,
            `Original IGN: **${result.request.requested_ign}**`,
            `Approved IGN: **${result.saved.ign}**`,
            '',
            `Approved by: <@${interaction.user.id}>`
          ].join('\n'),
          components: []
        }).catch(() => {});
      }
    } catch (err) {
      if (err.code === 'REQUEST_NOT_FOUND') {
        return interaction.reply({
          content: '❌ IGN registration request not found.',
          flags: PRIVATE_REPLY
        });
      }

      if (err.code === 'REQUEST_NOT_PENDING') {
        return interaction.reply({
          content: `❌ ${err.message}`,
          flags: PRIVATE_REPLY
        });
      }

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

      console.error('❌ IGN edit modal failed:', err);

      return interaction.reply({
        content: '❌ Failed to edit and approve IGN registration.',
        flags: PRIVATE_REPLY
      });
    }
  }
};
