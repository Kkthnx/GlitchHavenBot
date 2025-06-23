const { EmbedBuilder, PermissionsBitField } = require("discord.js");

const Guild = require("../../models/Guild");
const logger = require("../../config/logger");

module.exports = {
  name: "levelrewards",
  aliases: ["lr", "levelrole"],
  description: "Manage role rewards for leveling up.",
  usage: "!levelrewards <add|remove|list> [level] [@role]",
  category: "Admin",
  guildOnly: true,
  cooldown: 5,
  permissions: [PermissionsBitField.Flags.ManageGuild],

  async execute(message, args) {
    const [subcommand, levelArg, roleArg] = args;

    if (!subcommand) {
      return message.reply(
        "Please specify a subcommand: `add`, `remove`, or `list`.",
      );
    }

    switch (subcommand.toLowerCase()) {
      case "add":
        await handleAdd(message, levelArg, roleArg);
        break;
      case "remove":
        await handleRemove(message, levelArg);
        break;
      case "list":
        await handleList(message);
        break;
      default:
        message.reply("Invalid subcommand. Use `add`, `remove`, or `list`.");
    }
  },
};

async function handleAdd(message, levelArg, roleArg) {
  const level = parseInt(levelArg);
  if (isNaN(level) || level <= 0) {
    return message.reply("Please provide a valid level number greater than 0.");
  }

  const role =
    message.mentions.roles.first() || message.guild.roles.cache.get(roleArg);
  if (!role) {
    return message.reply("Please mention a valid role or provide its ID.");
  }

  // Check if bot can manage this role
  if (role.position >= message.guild.members.me.roles.highest.position) {
    return message.reply(
      "I cannot manage this role. Please make sure my role is higher than the reward role.",
    );
  }

  try {
    const guildData = await Guild.findOneAndUpdate(
      { guildId: message.guild.id },
      { $pull: { "leveling.roleRewards": { level } } },
      { new: true },
    );

    guildData.leveling.roleRewards.push({ level, roleId: role.id });
    await guildData.save();

    message.reply(
      `✅ Successfully set **${role.name}** as the reward for reaching **Level ${level}**.`,
    );
  } catch (error) {
    logger.error("Error adding level reward:", error);
    return message.reply("❌ An error occurred while adding the level reward.");
  }
}

async function handleRemove(message, levelArg) {
  const level = parseInt(levelArg);
  if (isNaN(level) || level <= 0) {
    return message.reply(
      "Please provide a valid level number to remove the reward from.",
    );
  }

  try {
    const result = await Guild.updateOne(
      { guildId: message.guild.id },
      { $pull: { "leveling.roleRewards": { level } } },
    );

    if (result.modifiedCount > 0) {
      message.reply(
        `✅ Successfully removed the role reward for **Level ${level}**.`,
      );
    } else {
      message.reply(`⚠️ No role reward was found for **Level ${level}**.`);
    }
  } catch (error) {
    logger.error("Error removing level reward:", error);
    return message.reply(
      "❌ An error occurred while removing the level reward.",
    );
  }
}

async function handleList(message) {
  try {
    const guildData = await Guild.findOne({ guildId: message.guild.id });

    if (
      !guildData ||
      !guildData.leveling.roleRewards ||
      guildData.leveling.roleRewards.length === 0
    ) {
      return message.reply(
        "There are no level rewards configured for this server.",
      );
    }

    const sortedRewards = guildData.leveling.roleRewards.sort(
      (a, b) => a.level - b.level,
    );

    const description = sortedRewards
      .map((reward) => {
        const role = message.guild.roles.cache.get(reward.roleId);
        return `**Level ${reward.level}** → ${role ? role.name : "Unknown Role"}`;
      })
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`🏆 Level Rewards for ${message.guild.name}`)
      .setDescription(description || "No rewards set.")
      .setTimestamp();

    message.reply({ embeds: [embed] });
  } catch (error) {
    logger.error("Error listing level rewards:", error);
    return message.reply("❌ An error occurred while listing level rewards.");
  }
}
