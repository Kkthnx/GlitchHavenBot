const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const User = require("../../models/User");
const {
  handleCommandError,
  isSlashCommand,
  replyToInteraction,
  deferInteraction,
} = require("../../utils/helpers");

module.exports = {
  name: "repgiven",
  aliases: ["myreps", "givenrep"],
  description: "Shows who you have given reputation to",
  usage: "!repgiven",
  cooldown: 30,
  guildOnly: true,

  data: new SlashCommandBuilder()
    .setName("repgiven")
    .setDescription("Shows who you have given reputation to"),

  async execute(interaction, args, client) {
    await deferInteraction(interaction);

    try {
      const guildId = isSlashCommand(interaction)
        ? interaction.guildId
        : interaction.guild.id;
      const userId = isSlashCommand(interaction)
        ? interaction.user.id
        : interaction.author.id;

      const userData = await User.findOne({ userId, guildId });
      if (
        !userData ||
        !userData.reputation ||
        userData.reputation.endorsements.length === 0
      ) {
        const noDataEmbed = new EmbedBuilder()
          .setColor("#ff8800")
          .setTitle("📊 Reputation Given")
          .setDescription(
            "You haven't given any reputation yet.\nUse `!rep @user` to give reputation!",
          )
          .setFooter({ text: "Reputation System" });

        return await replyToInteraction(interaction, { embeds: [noDataEmbed] });
      }

      const { endorsements } = userData.reputation;
      const totalGiven = endorsements.length;

      const embed = new EmbedBuilder()
        .setColor("#7289da")
        .setTitle("📊 Reputation Given")
        .setDescription(`You have given reputation to **${totalGiven}** users`)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: `Reputation System • ${interaction.guild.name}` });

      // Sort by most recent endorsement
      const sortedUsers = endorsements
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10); // Show top 10

      let description = "";
      for (const endorsement of sortedUsers) {
        try {
          const targetUser = await client.users.fetch(endorsement.givenTo);
          const date = new Date(endorsement.timestamp).toLocaleDateString();
          const messageText = endorsement.message ? ` (${endorsement.message})` : "";

          description += `• **${targetUser.username}** - ${date}${messageText}\n`;
        } catch (error) {
          // User no longer exists
          description += `• **Unknown User** - ${new Date(endorsement.timestamp).toLocaleDateString()}\n`;
        }
      }

      if (description) {
        embed.addFields({
          name: "🤝 Recent Endorsements",
          value: description,
          inline: false,
        });
      }

      // Statistics
      const totalMessages = endorsements.filter((e) => e.message).length;
      const messagePercentage =
        totalGiven > 0 ? Math.round((totalMessages / totalGiven) * 100) : 0;

      embed.addFields({
        name: "📈 Statistics",
        value: `Total Given: **${totalGiven}**\nWith Messages: **${totalMessages}** (${messagePercentage}%)\nUnique Users: **${endorsements.length}**`,
        inline: false,
      });

      return await replyToInteraction(interaction, { embeds: [embed] });
    } catch (error) {
      const errorEmbed = handleCommandError(
        error,
        "repgiven command",
        console,
        "An error occurred while fetching reputation data.",
      );
      return await replyToInteraction(interaction, { embeds: [errorEmbed] });
    }
  },
};
