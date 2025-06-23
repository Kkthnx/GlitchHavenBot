const { EmbedBuilder } = require("discord.js");

const databaseService = require("../../utils/databaseService");
const logger = require("../../config/logger");

module.exports = {
  name: "slapleaderboard",
  aliases: ["slapboard", "slap-top", "slap-lb"],
  description:
    "Displays the slap leaderboard showing top slappers and most slapped users.",
  usage: "!slapleaderboard [given|received]",
  cooldown: 15,
  guildOnly: true,
  async execute(message, _args, _client) {
    try {
      const type = _args[0]?.toLowerCase() || "given";

      // Validate leaderboard type
      const validTypes = ["given", "received"];
      if (!validTypes.includes(type)) {
        return message.reply(
          `❌ Invalid leaderboard type. Use: ${validTypes.join(", ")}`,
        );
      }

      // Get slap leaderboard data
      const topUsers = await databaseService.getLeaderboard(
        message.guild.id,
        "slap",
        10,
      );

      if (topUsers.length === 0) {
        return message.reply(
          `There's no one on the slap leaderboard yet! Start slapping people with \`!slap @user\` to get on the board!`,
        );
      }

      const leaderboardEmbed = new EmbedBuilder()
        .setColor(0xff6b6b) // Red color for slap
        .setTitle(`💥 Slap Leaderboard - ${message.guild.name}`)
        .setThumbnail(message.guild.iconURL({ dynamic: true }))
        .setTimestamp();

      let description = "";
      for (let i = 0; i < topUsers.length; i++) {
        const dbUser = topUsers[i];
        // Fetch the Discord user to get their current username
        const discordUser = await _client.users
          .fetch(dbUser.userId)
          .catch(() => null);
        const username = discordUser ? discordUser.username : "Unknown User";

        const medal =
          i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `**${i + 1}.**`;

        const slapStats = dbUser.gameStats.slaps;
        let statsText = "";

        if (type === "given") {
          statsText = `Slaps Given: \`${slapStats.given}\` | Slaps Received: \`${slapStats.received}\``;
        } else {
          statsText = `Slaps Received: \`${slapStats.received}\` | Slaps Given: \`${slapStats.given}\``;
        }

        description += `${medal} **${username}**\n`;
        description += `> ${statsText}\n\n`;
      }

      leaderboardEmbed.setDescription(description);
      leaderboardEmbed.setFooter({
        text: `Showing top ${type === "given" ? "slappers" : "most slapped users"} • Use !slapleaderboard <given|received> to switch views`,
      });

      await message.reply({ embeds: [leaderboardEmbed] });
    } catch (error) {
      logger.error("Error executing slap leaderboard command:", error);
      message.reply(
        "❌ An error occurred while fetching the slap leaderboard.",
      );
    }
  },
};
