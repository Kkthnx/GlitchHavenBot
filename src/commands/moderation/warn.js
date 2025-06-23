const { EmbedBuilder } = require("discord.js");

const User = require("../../models/User");
const Guild = require("../../models/Guild");
const {
  hasModeratorPermissions,
  canModerateUser,
  getRequiredPermissions,
} = require("../../utils/permissions");
const { logModerationAction } = require("../../utils/helpers");
const logger = require("../../config/logger");

module.exports = {
  name: "warn",
  aliases: ["warning"],
  description: "Warn a user for breaking server rules",
  usage: "!warn <@user> <reason>",
  cooldown: 5,
  permissions: ["ManageMessages"],
  async execute(message, args, client) {
    // Check if user has permission to warn
    const guild = await Guild.findOne({ guildId: message.guild.id });
    if (!guild) {
      return message.reply("❌ Server settings not found.");
    }

    if (
      !hasModeratorPermissions(
        message.member,
        message.guild,
        guild.moderation.moderatorRoleId,
      )
    ) {
      return message.reply("❌ You do not have permission to warn users.");
    }

    // Check bot permissions
    const requiredPerms = getRequiredPermissions("warn");
    const botPerms = message.guild.members.cache.get(client.user.id);
    if (!botPerms.permissions.has(requiredPerms)) {
      return message.reply(
        "❌ I don't have the required permissions to warn users.",
      );
    }

    // Parse arguments
    if (args.length < 2) {
      return message.reply(
        "❌ Please provide a user and reason. Usage: `!warn <@user> <reason>`",
      );
    }

    const targetUser = message.mentions.users.first();
    if (!targetUser) {
      return message.reply("❌ Please mention a valid user to warn.");
    }

    const targetMember = message.guild.members.cache.get(targetUser.id);
    if (!targetMember) {
      return message.reply("❌ That user is not a member of this server.");
    }

    // Check if user can be moderated
    const canModerate = canModerateUser(
      targetMember,
      message.member,
      message.guild,
    );
    if (!canModerate.canModerate) {
      return message.reply(`❌ ${canModerate.reason}`);
    }

    // Get reason
    const reason = args.slice(1).join(" ");

    try {
      // Get or create user in database
      let user = await User.findOne({
        userId: targetUser.id,
        guildId: message.guild.id,
      });
      if (!user) {
        user = await User.findOrCreate(targetUser.id, message.guild.id, {
          username: targetUser.username,
          discriminator: targetUser.discriminator,
          avatar: targetUser.avatar,
        });
      }

      // Add warning to user
      await user.addWarning(reason, message.author.id, message.author.username);

      // Check for automatic escalation
      const activeWarnings = user.moderation.warnings.filter(
        (w) => w.active,
      ).length;
      const shouldMute = activeWarnings >= guild.moderation.warningThreshold;

      // Create warning embed
      const warnEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle("⚠️ User Warned")
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          {
            name: "👤 User",
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: true,
          },
          {
            name: "🛡️ Moderator",
            value: `${message.author.tag} (${message.author.id})`,
            inline: true,
          },
          { name: "📝 Reason", value: reason, inline: false },
          {
            name: "📊 Total Warnings",
            value: `${activeWarnings}`,
            inline: true,
          },
          {
            name: "⚡ Warning Threshold",
            value: `${guild.moderation.warningThreshold}`,
            inline: true,
          },
        )
        .setFooter({ text: `Warned by ${message.author.tag}` })
        .setTimestamp();

      if (shouldMute) {
        warnEmbed.addFields({
          name: "🚨 Automatic Action",
          value:
            "User has reached the warning threshold and may be automatically muted.",
          inline: false,
        });
      }

      await message.reply({ embeds: [warnEmbed] });

      // Send DM to warned user
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xffa500)
          .setTitle(`⚠️ You have been warned in ${message.guild.name}`)
          .addFields(
            { name: "📝 Reason", value: reason, inline: false },
            { name: "🛡️ Moderator", value: message.author.tag, inline: true },
            {
              name: "📊 Total Warnings",
              value: `${activeWarnings}`,
              inline: true,
            },
          )
          .setFooter({
            text: "Please follow the server rules to avoid further action.",
          })
          .setTimestamp();

        await targetUser.send({ embeds: [dmEmbed] });
      } catch (dmError) {
        // User has DMs disabled, that's okay
      }

      // Log the action using shared utility
      await logModerationAction(message.guild, {
        action: "WARN",
        target: targetUser,
        moderator: message.author,
        reason,
        channel: message.channel,
      });
    } catch (error) {
      logger.error("Error in warn command:", error);
      return message.reply("❌ An error occurred while warning the user.");
    }
  },
};
