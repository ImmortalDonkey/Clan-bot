const { SlashCommandBuilder } = require('discord.js');

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
      return interaction.showModal({
        customId: `exp_${sub}`,
        title: `Import ${sub.toUpperCase()} EXP`,
        components: [{
          type: 1,
          components: [{
            type: 4,
            customId: 'exp_input',
            label: 'Paste EXP table',
            style: 2,
            required: true,
            max_length: 4000
          }]
        }]
      });
    }

    return interaction.reply({ content: `EXP ${sub} not yet wired.`, ephemeral: true });
  }
};
