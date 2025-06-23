const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const User = require("../../models/User");
const {
  handleCommandError,
  isSlashCommand,
  replyToInteraction,
  deferInteraction,
} = require("../../utils/helpers");

module.exports = {
  name: "reputation",
  aliases: ["repinfo", "myrep"],
  description: "Shows detailed reputation information for a user",
  usage: "!reputation [@user]",
  cooldown: 10,
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName("reputation")
    .setDescription("Shows detailed reputation information for a user")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to check reputation for (defaults to yourself)")
        .setRequired(false),
    ),

  async execute(interaction, args, client) {
    await deferInteraction(interaction);

    try {
      let targetUser;

      if (isSlashCommand(interaction)) {
        // Slash command handling
        targetUser = interaction.options.getUser("user") || interaction.user;
      } else {
        // Prefix command handling
        if (args && args.length > 0) {
          const mention = args[0];
          const userId = mention.replace(/[<@!>]/g, "");
          try {
            targetUser = await client.users.fetch(userId);
          } catch (error) {
            return await replyToInteraction(interaction, {
              content: "❌ Invalid user mention.",
            });
          }
        } else {
          targetUser = interaction.user;
        }
      }

      const guildId = isSlashCommand(interaction)
        ? interaction.guildId
        : interaction.guild.id;
      const userData = await User.findOrCreate(targetUser.id, guildId, {
        username: targetUser.username,
        discriminator: targetUser.discriminator || "0",
        avatar: targetUser.avatar,
      });

      const repData = userData.reputation || {
        score: 0,
        totalEndorsements: 0,
        endorsements: [],
      };
      const recentEndorsements = repData.endorsements.slice(-5).reverse();

      const embed = new EmbedBuilder()
        .setColor("#7289da")
        .setTitle(`📊 Reputation Profile: ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: `Reputation System • ${interaction.guild.name}` });

      // Main reputation stats
      embed.addFields(
        {
          name: "🏆 Reputation Score",
          value: `**${repData.score}** points`,
          inline: true,
        },
        {
          name: "🤝 Total Endorsements",
          value: `**${repData.totalEndorsements}** endorsements`,
          inline: true,
        },
        {
          name: "📈 Reputation Rank",
          value: await this.getReputationRank(guildId, targetUser.id),
          inline: true,
        },
      );

      // Reputation badges
      const badges = this.getReputationBadges(
        repData.score,
        repData.totalEndorsements,
      );
      if (badges.length > 0) {
        embed.addFields({
          name: "🏅 Reputation Badges",
          value: badges.join(" "),
          inline: false,
        });
      }

      // Recent endorsements
      if (recentEndorsements.length > 0) {
        let endorsementsText = "";
        for (const endorsement of recentEndorsements) {
          const endorser = await client.users
            .fetch(endorsement.givenBy)
            .catch(() => null);
          const endorserName = endorser ? endorser.username : "Unknown User";
          const date = new Date(endorsement.timestamp).toLocaleDateString();
          endorsementsText += `• **${endorserName}** - ${date}\n`;
        }

        embed.addFields({
          name: "📝 Recent Endorsements",
          value: endorsementsText,
          inline: false,
        });
      } else {
        embed.addFields({
          name: "📝 Recent Endorsements",
          value: "No endorsements yet",
          inline: false,
        });
      }

      // Server statistics
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
        "reputation command",
        console,
        "An error occurred while fetching reputation information.",
      );
      return await replyToInteraction(interaction, { embeds: [errorEmbed] });
    }
  },

  async getReputationRank(guildId, userId) {
    const rank = await User.countDocuments({
      guildId,
      "reputation.score": { $gt: 0 },
      $or: [{ "reputation.score": { $gt: 0 } }, { userId: { $lt: userId } }],
    });
    return `**#${rank + 1}**`;
  },

  getReputationBadges(score, endorsements) {
    const badges = [];

    // Reputation score badges
    if (score >= 100) badges.push("👑 Legend");
    else if (score >= 50) badges.push("🥈 Elite");
    else if (score >= 25) badges.push("🥉 Veteran");
    else if (score >= 10) badges.push("✅ Trusted");
    else if (score >= 5) badges.push("📈 Rising");

    // Endorsement count badges
    if (endorsements >= 50) badges.push("🏆 Endorsement Master");
    else if (endorsements >= 25) badges.push("🎯 Endorsement Expert");
    else if (endorsements >= 10) badges.push("💖 Popular");

    return badges;
  },
};
