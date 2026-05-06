const fs = require('fs');
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  AttachmentBuilder,
  MessageFlags
} = require('discord.js');

const { createCaptureCard } = require('../../renderers/captureCard.cjs');

const PRIVATE_REPLY = MessageFlags.Ephemeral;

function parseTypes(raw) {
  if (!raw) return null;

  const types = String(raw)
    .trim()
    .toLowerCase()
    .split(/[-/,| ]+/)
    .map(t => t.trim())
    .filter(Boolean);

  return types.length ? types.slice(0, 2) : null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rendertest')
    .setDescription('Admin only: render a test capture card')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o =>
      o
        .setName('pokemon')
        .setDescription('Pokémon name, e.g. Dark Urshifu (SS Gigantamax)')
        .setRequired(true)
    )
    .addStringOption(o =>
      o
        .setName('username')
        .setDescription('Name to show on the card')
        .setRequired(false)
    )
    .addIntegerOption(o =>
      o
        .setName('points')
        .setDescription('Points to show')
        .setRequired(false)
    )
    .addStringOption(o =>
      o
        .setName('rarity')
        .setDescription('Rarity text to show')
        .setRequired(false)
        .addChoices(
          { name: 'Normal', value: 'Normal' },
          { name: 'Dark', value: 'Dark' },
          { name: 'Mystic', value: 'Mystic' },
          { name: 'Metallic', value: 'Metallic' },
          { name: 'Shadow', value: 'Shadow' },
          { name: 'Shiny', value: 'Shiny' }
        )
    )
    .addStringOption(o =>
      o
        .setName('rank')
        .setDescription('Rank text to show, e.g. 1st, 2nd, 10th')
        .setRequired(false)
    )
    .addStringOption(o =>
      o
        .setName('species')
        .setDescription('Optional species override, e.g. Urshifu Single Strike')
        .setRequired(false)
    )
    .addStringOption(o =>
      o
        .setName('types')
        .setDescription('Optional type override, e.g. dark-fighting or ghost/dragon')
        .setRequired(false)
    )
    .addBooleanOption(o =>
      o
        .setName('public')
        .setDescription('Post publicly instead of privately')
        .setRequired(false)
    ),

  async execute(client, interaction) {
    const pokemonName = interaction.options.getString('pokemon', true);
    const username =
      interaction.options.getString('username') ||
      interaction.member?.displayName ||
      interaction.user.username;

    const points = interaction.options.getInteger('points') ?? 1;
    const rarity = interaction.options.getString('rarity') || 'Normal';
    const rank = interaction.options.getString('rank') || 'Test';
    const speciesName = interaction.options.getString('species') || pokemonName;
    const types = parseTypes(interaction.options.getString('types'));
    const isPublic = interaction.options.getBoolean('public') || false;

    await interaction.deferReply(
      isPublic ? {} : { flags: PRIVATE_REPLY }
    );

    let imagePath = null;

    try {
      imagePath = await createCaptureCard({
        username,
        pokemonName,
        speciesName,
        points,
        rarity,
        rank,
        types
      });

      const attachment = new AttachmentBuilder(imagePath, {
        name: 'render-test.png'
      });

      await interaction.editReply({
        content: [
          '✅ Render test complete.',
          '',
          `Pokémon: ${pokemonName}`,
          `Species: ${speciesName}`,
          `Types: ${types ? types.join(' / ') : 'auto'}`
        ].join('\n'),
        files: [attachment]
      });
    } catch (err) {
      console.error('❌ /rendertest failed:', err);

      await interaction.editReply({
        content: `❌ Render test failed:\n\`${err.message}\``
      });
    } finally {
      if (imagePath) {
        setTimeout(() => {
          fs.unlink(imagePath, () => {});
        }, 15_000);
      }
    }
  }
};
