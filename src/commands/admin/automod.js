const { EmbedBuilder, PermissionsBitField } = require("discord.js");

const Guild = require("../../models/Guild");

module.exports = {
  name: "automod",
  description: "Configure auto-moderation settings for the server.",
  usage: "!automod <subcommand> [options]",
  category: "Admin",
  guildOnly: true,
  cooldown: 5,
  permissions: [PermissionsBitField.Flags.ManageGuild],

  async execute(message, args, client) {
    const [subcommand, ...options] = args;
    const guildData = await Guild.findOne({ guildId: message.guild.id });

    if (!guildData) {
      return message.reply("Could not find guild data. Please try again.");
    }

    const { autoMod } = guildData.moderation;

    switch (subcommand ? subcommand.toLowerCase() : "status") {
      case "status":
        return showStatus(message, autoMod);
      case "toggle":
        return handleToggle(message, options[0], autoMod, guildData);
      case "addword":
        return handleAddWord(message, options.join(" "), autoMod, guildData);
      case "removeword":
        return handleRemoveWord(message, options.join(" "), autoMod, guildData);
      case "listwords":
        return handleListWords(message, autoMod);
      default:
        return message.reply(
          "Invalid subcommand. Use `status`, `toggle <feature>`, `addword <word>`, `removeword <word>`, or `listwords`.",
        );
    }
  },
};

function showStatus(message, autoMod) {
  const statusEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("🛡️ Auto-Mod Status")
    .setDescription("Current configuration for the auto-moderation system.")
    .addFields(
      {
        name: "System Enabled",
        value: autoMod.enabled ? "✅ Yes" : "❌ No",
        inline: true,
      },
      {
        name: "Word Filter",
        value: autoMod.wordFilter ? "✅ Enabled" : "❌ Disabled",
        inline: true,
      },
      {
        name: "Link Filter",
        value: autoMod.linkFilter ? "✅ Enabled" : "❌ Disabled",
        inline: true,
      },
      {
        name: "Spam Detection",
        value: `Threshold: ${autoMod.spamThreshold} msgs / 10s`,
        inline: true,
      },
      {
        name: "Banned Words Count",
        value: `\`${autoMod.bannedWords.length}\` words`,
        inline: true,
      },
    )
    .setTimestamp();

  return message.reply({ embeds: [statusEmbed] });
}

async function handleToggle(message, feature, autoMod, guildData) {
  if (!feature)
    return message.reply(
      "Please specify a feature to toggle: `system`, `wordfilter`, `linkfilter`.",
    );

  let enabled;
  let featureName;

  switch (feature.toLowerCase()) {
    case "system":
      autoMod.enabled = !autoMod.enabled;
      enabled = autoMod.enabled;
      featureName = "The auto-mod system";
      break;
    case "wordfilter":
      autoMod.wordFilter = !autoMod.wordFilter;
      enabled = autoMod.wordFilter;
      featureName = "The word filter";
      break;
    case "linkfilter":
      autoMod.linkFilter = !autoMod.linkFilter;
      enabled = autoMod.linkFilter;
      featureName = "The link filter";
      break;
    default:
      return message.reply(
        "Invalid feature. Use `system`, `wordfilter`, or `linkfilter`.",
      );
  }

  await guildData.save();
  return message.reply(
    `${enabled ? "✅" : "❌"} ${featureName} has been **${enabled ? "enabled" : "disabled"}**.`,
  );
}

async function handleAddWord(message, word, autoMod, guildData) {
  if (!word)
    return message.reply("Please provide a word to add to the filter.");
  const newWord = word.toLowerCase();

  if (autoMod.bannedWords.includes(newWord)) {
    return message.reply(`The word \`${newWord}\` is already in the filter.`);
  }

  autoMod.bannedWords.push(newWord);
  await guildData.save();
  return message.reply(
    `✅ The word \`${newWord}\` has been added to the banned words list.`,
  );
}

async function handleRemoveWord(message, word, autoMod, guildData) {
  if (!word)
    return message.reply("Please provide a word to remove from the filter.");
  const wordToRemove = word.toLowerCase();

  if (!autoMod.bannedWords.includes(wordToRemove)) {
    return message.reply(`The word \`${wordToRemove}\` is not in the filter.`);
  }

  autoMod.bannedWords = autoMod.bannedWords.filter((w) => w !== wordToRemove);
  await guildData.save();
  return message.reply(
    `✅ The word \`${wordToRemove}\` has been removed from the banned words list.`,
  );
}

function handleListWords(message, autoMod) {
  if (autoMod.bannedWords.length === 0) {
    return message.reply("The banned words list is currently empty.");
  }

  const listEmbed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("🚫 Banned Words List")
    .setDescription(`\`\`\`${autoMod.bannedWords.join(", ")}\`\`\``)
    .setTimestamp();

  return message.reply({ embeds: [listEmbed] });
}
