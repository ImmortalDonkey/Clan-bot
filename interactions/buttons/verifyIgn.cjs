const {
  PermissionFlagsBits,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

const {
  getIgnRegistrationRequest,
  approveIgnRegistrationRequest,
  rejectIgnRegistrationRequest
} = require('../../services/ignRegistry.cjs');

const PRIVATE_REPLY = MessageFlags.Ephemeral;

function canVerifyIgn(interaction) {
  const member = interaction.member;
  const guild = interaction.guild;

  const isOwner = guild?.ownerId === interaction.user.id;
  const isAdmin = member?.permissions?.has(PermissionFlagsBits.Administrator);

  return Boolean(isOwner || isAdmin);
}

function disabledActionRows() {
  return [];
}

async function safeDm(client, discordId, message) {
  try {
    const user = await client.users.fetch(discordId);
    await user.send(message);
  } catch {
    // User may have DMs disabled.
  }
}

async function handleVerify(client, interaction, requestId) {
  const result = await approveIgnRegistrationRequest({
    id: requestId,
    reviewer_id: interaction.user.id
  });

  await safeDm(
    client,
    result.request.discord_id,
    `✅ Your IGN has been verified: ${result.saved.ign}\nYou can now use /submit.`
  );

  await interaction.update({
    content: [
      '✅ **IGN Registration Approved**',
      '',
      `User: <@${result.request.discord_id}>`,
      `Discord ID: \`${result.request.discord_id}\``,
      `Approved IGN: **${result.saved.ign}**`,
      '',
      `Approved by: <@${interaction.user.id}>`
    ].join('\n'),
    components: disabledActionRows()
  });
}

async function handleReject(client, interaction, requestId) {
  const request = await rejectIgnRegistrationRequest({
    id: requestId,
    reviewer_id: interaction.user.id
  });

  await safeDm(
    client,
    request.discord_id,
    `❌ Your IGN registration was rejected: ${request.requested_ign}\nPlease contact staff or submit again with /registerign.`
  );

  await interaction.update({
    content: [
      '❌ **IGN Registration Rejected**',
      '',
      `User: <@${request.discord_id}>`,
      `Discord ID: \`${request.discord_id}\``,
      `Rejected IGN: **${request.requested_ign}**`,
      '',
      `Rejected by: <@${interaction.user.id}>`
    ].join('\n'),
    components: disabledActionRows()
  });
}

async function handleEdit(interaction, requestId) {
  const request = await getIgnRegistrationRequest(requestId);

  if (!request) {
    return interaction.reply({
      content: '❌ IGN registration request not found.',
      flags: PRIVATE_REPLY
    });
  }

  if (request.status !== 'PENDING') {
    return interaction.reply({
      content: `❌ This IGN registration request is already ${request.status}.`,
      flags: PRIVATE_REPLY
    });
  }

  const modal = new ModalBuilder()
    .setCustomId('ign_edit_modal')
    .setTitle('Edit IGN Registration');

  const requestIdInput = new TextInputBuilder()
    .setCustomId('request_id')
    .setLabel('Request ID - do not change')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(request.id));

  const ignInput = new TextInputBuilder()
    .setCustomId('ign')
    .setLabel('Correct IGN')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(request.requested_ign);

  modal.addComponents(
    new ActionRowBuilder().addComponents(requestIdInput),
    new ActionRowBuilder().addComponents(ignInput)
  );

  await interaction.showModal(modal);
}

module.exports = {
  ids: ['ign_verify_', 'ign_edit_', 'ign_reject_'],

  async execute(client, interaction) {
    if (!canVerifyIgn(interaction)) {
      return interaction.reply({
        content: '❌ You do not have permission to verify IGN registrations.',
        flags: PRIVATE_REPLY
      });
    }

    const id = interaction.customId || '';
    const parts = id.split('_');
    const action = parts[1];
    const requestId = Number(parts[2]);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return interaction.reply({
        content: '❌ Invalid IGN registration request ID.',
        flags: PRIVATE_REPLY
      });
    }

    try {
      if (action === 'verify') {
        return await handleVerify(client, interaction, requestId);
      }

      if (action === 'edit') {
        return await handleEdit(interaction, requestId);
      }

      if (action === 'reject') {
        return await handleReject(client, interaction, requestId);
      }

      return interaction.reply({
        content: '❌ Unknown IGN registration action.',
        flags: PRIVATE_REPLY
      });
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

      console.error('❌ IGN verification button failed:', err);

      return interaction.reply({
        content: '❌ Failed to process IGN registration.',
        flags: PRIVATE_REPLY
      });
    }
  }
};
