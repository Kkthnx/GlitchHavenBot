const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const User = require("../../models/User");
const {
  handleCommandError,
  isSlashCommand,
  replyToInteraction,
  deferInteraction,
} = require("../../utils/helpers");

module.exports = {
  // Legacy command format for compatibility
  name: "repleaderboard",
  aliases: ["replb", "reptop"],
  description: "Show the reputation leaderboard",
  usage: "!repleaderboard [limit]",
  cooldown: 30,
  guildOnly: true,

  // Slash command data
  data: new SlashCommandBuilder()
    .setName("repleaderboard")
    .setDescription("Show the reputation leaderboard")
    .addIntegerOption((option) =>
      option
        .setName("limit")
        .setDescription("Number of users to show (1-25)")
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false),
    ),

  async execute(interaction, args) {
    await deferInteraction(interaction);

    try {
      let limit = 10;

      if (isSlashCommand(interaction)) {
        // Slash command handling
        limit = interaction.options.getInteger("limit") || 10;
      } else {
        // Prefix command handling
        if (args && args.length > 0) {
          const parsedLimit = parseInt(args[0]);
          if (!isNaN(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 25) {
            limit = parsedLimit;
          }
        }
      }

      const guildId = isSlashCommand(interaction)
        ? interaction.guildId
        : interaction.guild.id;
      const leaderboard = await User.getReputationLeaderboard(guildId, limit);

      if (leaderboard.length === 0) {
        const noDataEmbed = new EmbedBuilder()
          .setColor("#ff8800")
          .setTitle("📊 Reputation Leaderboard")
          .setDescription(
            "No reputation data found for this server yet.\nStart giving reputation with `!rep`!",
          )
          .setFooter({ text: "Reputation System" });

        return await replyToInteraction(interaction, { embeds: [noDataEmbed] });
      }

      const embed = new EmbedBuilder()
        .setColor("#7289da")
        .setTitle("🏆 Reputation Leaderboard")
        .setDescription(`Top ${leaderboard.length} most trusted members`)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: `Reputation System • ${interaction.guild.name}` });

      let description = "";
      const medals = ["🥇", "🥈", "🥉"];

      for (let i = 0; i < leaderboard.length; i++) {
        const user = leaderboard[i];
        const medal = i < 3 ? medals[i] : `${i + 1}.`;
        const repScore = user.reputation?.score || 0;
        const endorsements = user.reputation?.totalEndorsements || 0;

        description += `${medal} **${user.username}**\n`;
        description += `   Reputation: **${repScore}** | Endorsements: **${endorsements}**\n\n`;
      }

      embed.setDescription(description);

      // Add server statistics
      const totalUsers = await User.countDocuments({ guildId });
      const usersWithRep = await User.countDocuments({
        guildId,
        "reputation.score": { $gt: 0 },
      });

      const percentile =
        totalUsers > 0 ? Math.round((usersWithRep / totalUsers) * 100) : 0;

      embed.addFields({
        name: "📈 Server Standing",
        value: `Top **${percentile}%** of ${totalUsers} members\n${usersWithRep} members have reputation`,
        inline: false,
      });

      return await replyToInteraction(interaction, { embeds: [embed] });
    } catch (error) {
      const errorEmbed = handleCommandError(
        error,
        "repleaderboard command",
        console,
        "An error occurred while fetching the reputation leaderboard.",
      );
      return await replyToInteraction(interaction, { embeds: [errorEmbed] });
    }
  },
};
