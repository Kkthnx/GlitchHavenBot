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
  name: "kick",
  aliases: ["boot"],
  description: "Kick a user from the server",
  usage: "!kick <@user> <reason>",
  cooldown: 5,
  permissions: ["KickMembers"],
  async execute(message, args, client) {
    // Check for moderator permissions from database
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
      return message.reply("❌ You do not have permission to kick users.");
    }

    // Check bot permissions
    const requiredPerms = getRequiredPermissions("kick");
    const botPerms = message.guild.members.cache.get(client.user.id);
    if (!botPerms.permissions.has(requiredPerms)) {
      return message.reply(
        "❌ I don't have the required permissions to kick users.",
      );
    }

    // Parse arguments
    if (args.length < 2) {
      return message.reply(
        "❌ Please provide a user and reason. Usage: `!kick <@user> <reason>`",
      );
    }

    const targetUser = message.mentions.users.first();
    if (!targetUser) {
      return message.reply("❌ Please mention a valid user to kick.");
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

    const reason = args.slice(1).join(" ");

    try {
      // Send DM to the user being kicked
      const dmEmbed = new EmbedBuilder()
        .setColor(0xff470f)
        .setTitle(`👢 You have been kicked from ${message.guild.name}`)
        .addFields(
          { name: "Reason", value: reason },
          { name: "Kicked by", value: message.author.tag },
        )
        .setTimestamp();

      await targetUser.send({ embeds: [dmEmbed] }).catch(() => {
        logger.warn(`Could not DM user ${targetUser.tag}.`);
      });

      // Kick the user
      await targetMember.kick(reason);

      // Record in our database
      const dbUser = await User.findOrCreate(targetUser.id, message.guild.id, {
        username: targetUser.username,
        discriminator: targetUser.discriminator,
        avatar: targetUser.avatar,
      });
      await dbUser.addKick(reason, message.author.id, message.author.username);

      // Send confirmation message
      const kickEmbed = new EmbedBuilder()
        .setColor(0xff470f)
        .setTitle("👢 User Kicked")
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          {
            name: "Kicked User",
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

      await message.reply({ embeds: [kickEmbed] });

      // Log the action using shared utility
      await logModerationAction(message.guild, {
        action: "KICK",
        target: targetUser,
        moderator: message.author,
        reason,
      });
    } catch (error) {
      logger.error("Error executing kick command:", error);
      return message.reply("❌ An error occurred while kicking the user.");
    }
  },
};
