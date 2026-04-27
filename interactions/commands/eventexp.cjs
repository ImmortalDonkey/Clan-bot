const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

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

    return interaction.reply({ content: `EXP ${sub} not yet wired.`, ephemeral: true });
  }
};
