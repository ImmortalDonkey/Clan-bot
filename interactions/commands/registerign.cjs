const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const db = require('../../database.cjs');

const PRIVATE_REPLY = MessageFlags.Ephemeral;

function cleanIgn(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('registerign')
    .setDescription('Register your Pokémon Vortex IGN')
    .addStringOption(option =>
      option
        .setName('ign')
        .setDescription('Your Pokémon Vortex IGN')
        .setRequired(true)
    ),

  async execute(client, interaction) {
    const ign = cleanIgn(interaction.options.getString('ign'));

    if (!ign) {
      return interaction.reply({ content: 'Please enter a valid IGN.', flags: PRIVATE_REPLY });
    }

    try {
      await db.registerIgn({
        guild_id: interaction.guildId,
        discord_id: interaction.user.id,
        ign
      });

      return interaction.reply({
        content: `✅ Registered IGN: **${ign}**\nYou can now use /submit.`,
        flags: PRIVATE_REPLY
      });
    } catch (err) {
      if (err?.code === 'IGN_ALREADY_REGISTERED') {
        return interaction.reply({
          content: 'That IGN is already registered to another Discord user.',
          flags: PRIVATE_REPLY
        });
      }

      console.error('❌ /registerign failed:', err);
      return interaction.reply({ content: '❌ Failed to register IGN.', flags: PRIVATE_REPLY });
    }
  }
};
