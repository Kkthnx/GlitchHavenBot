const { EmbedBuilder } = require("discord.js");

const databaseService = require("../../utils/databaseService");
const logger = require("../../config/logger");

module.exports = {
  name: "slapstats",
  aliases: ["slapstat", "slap-stats"],
  description: "Shows slap statistics for yourself or another user.",
  usage: "!slapstats [@user]",
  cooldown: 10,
  guildOnly: true,
  async execute(message, _args, _client) {
    try {
      // Get target user (mentioned user or message author)
      const target = message.mentions.users.first() || message.author;

      // Get or create user data
      const user = await databaseService.getOrCreateUser(
        target.id,
        message.guild.id,
        {
          username: target.username,
          discriminator: target.discriminator,
          avatar: target.avatar,
        },
      );

      const slapStats = user.gameStats.slaps;

      // Calculate slap ratio
      const totalSlaps = slapStats.given + slapStats.received;
      const slapRatio =
        totalSlaps > 0 ? ((slapStats.given / totalSlaps) * 100).toFixed(1) : 0;

      // Get user rank
      const rank = await databaseService.getUserRank(
        target.id,
        message.guild.id,
        "slap",
      );

      // Create embed
      const statsEmbed = new EmbedBuilder()
        .setColor(0xff6b6b) // Red color for slap
        .setTitle(`💥 Slap Statistics - ${target.username}`)
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .addFields(
          {
            name: "📊 Slap Counts",
            value: `**Slaps Given:** \`${slapStats.given}\`\n**Slaps Received:** \`${slapStats.received}\`\n**Total Slaps:** \`${totalSlaps}\``,
            inline: true,
          },
          {
            name: "📈 Statistics",
            value: `**Slap Ratio:** \`${slapRatio}%\`\n**Server Rank:** \`#${rank}\`\n**Slap Style:** \`${getSlapStyle(slapStats)}\``,
            inline: true,
          },
        )
        .setTimestamp()
        .setFooter({
          text: `Use !slap @user to slap someone!`,
        });

      // Add last slap info if available
      if (slapStats.lastSlapGiven || slapStats.lastSlapReceived) {
        let lastSlapInfo = "";
        if (slapStats.lastSlapGiven) {
          const timeAgo = getTimeAgo(slapStats.lastSlapGiven);
          lastSlapInfo += `**Last Slap Given:** ${timeAgo}\n`;
        }
        if (slapStats.lastSlapReceived) {
          const timeAgo = getTimeAgo(slapStats.lastSlapReceived);
          lastSlapInfo += `**Last Slap Received:** ${timeAgo}`;
        }

        statsEmbed.addFields({
          name: "⏰ Recent Activity",
          value: lastSlapInfo,
          inline: false,
        });
      }

      await message.reply({ embeds: [statsEmbed] });
    } catch (error) {
      logger.error("Error executing slap stats command:", error);
      message.reply("❌ An error occurred while fetching slap statistics.");
    }
  },
};

function getSlapStyle(slapStats) {
  const given = slapStats.given;
  const received = slapStats.received;
  const total = given + received;

  if (total === 0) return "Peaceful";
  if (given === 0) return "Punching Bag";
  if (received === 0) return "Slap Master";
  if (given > received * 2) return "Aggressive Slapper";
  if (received > given * 2) return "Slap Magnet";
  if (given === received) return "Balanced Slapper";
  if (given > received) return "Slap Giver";
  return "Slap Receiver";
}

function getTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}
