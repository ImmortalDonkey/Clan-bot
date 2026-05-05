const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { validateIgn, upsertRegisteredIgn } = require('../../services/ignRegistry.cjs');

const PRIVATE_REPLY = MessageFlags.Ephemeral;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('registerign')
    .setDescription('Register your Pokémon Vortex IGN for event submissions')
    .addStringOption(option =>
      option
        .setName('ign')
        .setDescription('Your Pokémon Vortex IGN')
        .setRequired(true)
    ),

  async execute(client, interaction) {
    const ign = interaction.options.getString('ign', true);
    const validationError = validateIgn(ign);

    if (validationError) {
      return interaction.reply({ content: `❌ ${validationError}`, flags: PRIVATE_REPLY });
    }

    try {
      const row = await upsertRegisteredIgn({
        guild_id: interaction.guildId,
        discord_id: interaction.user.id,
        ign
      });

      return interaction.reply({
        content: `✅ Registered IGN: **${row.ign}**\nYou can now use /submit without entering your IGN.`,
        flags: PRIVATE_REPLY
      });
    } catch (err) {
      if (String(err?.message || '').includes('UNIQUE constraint failed')) {
        return interaction.reply({
          content: '❌ That IGN is already registered to another Discord user in this server.',
          flags: PRIVATE_REPLY
        });
      }

      console.error('❌ /registerign failed:', err);
      return interaction.reply({ content: '❌ Failed to register IGN.', flags: PRIVATE_REPLY });
    }
  }
};
