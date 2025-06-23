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
  name: "ban",
  aliases: ["banuser"],
  description: "Ban a user from the server",
  usage: "!ban <@user> <reason> [duration]",
  cooldown: 5,
  permissions: ["BanMembers"],
  async execute(message, args, client) {
    const guildSettings = await Guild.findOne({ guildId: message.guild.id });
    if (!guildSettings) {
      return message.reply("❌ Server settings not found.");
    }

    if (
      !hasModeratorPermissions(
        message.member,
        message.guild,
        guildSettings.moderation.moderatorRoleId,
      )
    ) {
      return message.reply("❌ You do not have permission to ban users.");
    }

    // Check bot permissions
    const requiredPerms = getRequiredPermissions("ban");
    const botPerms = message.guild.members.cache.get(client.user.id);
    if (!botPerms.permissions.has(requiredPerms)) {
      return message.reply(
        "❌ I don't have the required permissions to ban users.",
      );
    }

    if (args.length < 2) {
      return message.reply(
        "❌ Please provide a user and reason. Usage: `!ban <@user> <reason> [duration]`",
      );
    }

    const targetUser = message.mentions.users.first();
    if (!targetUser) {
      return message.reply("❌ Please mention a valid user to ban.");
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

    // Parse duration if provided
    let durationMinutes = null;
    let reason = args.slice(1).join(" ");

    // Check if last argument is a duration
    const lastArg = args[args.length - 1];
    const durationMatch = lastArg.match(/^(\d+)(m|h|d)$/i);
    if (durationMatch) {
      const value = parseInt(durationMatch[1]);
      const unit = durationMatch[2].toLowerCase();

      switch (unit) {
        case "m":
          durationMinutes = value;
          break;
        case "h":
          durationMinutes = value * 60;
          break;
        case "d":
          durationMinutes = value * 60 * 24;
          break;
      }

      // Remove duration from reason
      reason = args.slice(1, -1).join(" ");
    }

    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xdd2e44)
        .setTitle(`🚫 You have been banned from ${message.guild.name}`)
        .addFields(
          { name: "Reason", value: reason },
          { name: "Banned by", value: message.author.tag },
        )
        .setTimestamp();

      if (durationMinutes) {
        dmEmbed.addFields({
          name: "Duration",
          value: `${durationMinutes} minutes`,
        });
      }

      await targetUser.send({ embeds: [dmEmbed] }).catch(() => {
        logger.warn(`Could not DM user ${targetUser.tag}.`);
      });

      await message.guild.bans.create(targetUser.id, { reason });

      const dbUser = await User.findOrCreate(targetUser.id, message.guild.id, {
        username: targetUser.username,
        discriminator: targetUser.discriminator,
        avatar: targetUser.avatar,
      });
      await dbUser.addBan(
        reason,
        message.author.id,
        message.author.username,
        durationMinutes,
      );

      const banEmbed = new EmbedBuilder()
        .setColor(0xdd2e44)
        .setTitle("🚫 User Banned")
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          {
            name: "Banned User",
            value: `${targetUser.tag} (${targetUser.id})`,
            inline: true,
          },
          {
            name: "Moderator",
            value: `${message.author.tag} (${message.author.id})`,
            inline: true,
          },
          { name: "Reason", value: reason },
        )
        .setTimestamp();

      if (durationMinutes) {
        banEmbed.addFields({
          name: "Duration",
          value: `${durationMinutes} minutes`,
          inline: true,
        });
      }

      await message.reply({ embeds: [banEmbed] });

      // Log the action using shared utility
      await logModerationAction(message.guild, {
        action: "BAN",
        target: targetUser,
        moderator: message.author,
        reason,
        duration: durationMinutes,
      });
    } catch (error) {
      logger.error("Error executing ban command:", error);
      return message.reply("❌ An error occurred while banning the user.");
    }
  },
};
