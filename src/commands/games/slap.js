const { EmbedBuilder } = require("discord.js");

const databaseService = require("../../utils/databaseService");
const logger = require("../../config/logger");

module.exports = {
  name: "slap",
  aliases: ["smack", "hit"],
  description: "Slap another user! Fun command with cooldown to prevent spam.",
  usage: "!slap @user",
  cooldown: 30, // 30 second cooldown
  guildOnly: true,
  async execute(message, _args, _client) {
    try {
      // Check if user mentioned someone
      const target = message.mentions.users.first();
      if (!target) {
        return message.reply(
          "❌ Please mention a user to slap! Usage: `!slap @user`",
        );
      }

      // Prevent self-slapping
      if (target.id === message.author.id) {
        return message.reply(
          "🤔 You can't slap yourself! That's just weird...",
        );
      }

      // Prevent slapping bots
      if (target.bot) {
        return message.reply(
          "🤖 You can't slap bots! They have feelings too...",
        );
      }

      const guildSettings = await databaseService.getGuildSettings(
        message.guild.id,
      );
      const cooldownTime = (guildSettings.games?.slap?.cooldown || 30) * 1000; // 30 seconds default

      // Get or create user data
      const user = await databaseService.getOrCreateUser(
        message.author.id,
        message.guild.id,
        {
          username: message.author.username,
          discriminator: message.author.discriminator,
          avatar: message.author.avatar,
        },
      );

      // Check cooldown
      const now = Date.now();
      if (
        user.gameStats.slaps.lastSlapGiven &&
        now - user.gameStats.slaps.lastSlapGiven.getTime() < cooldownTime
      ) {
        const remainingTime = Math.ceil(
          (cooldownTime -
            (now - user.gameStats.slaps.lastSlapGiven.getTime())) /
          1000,
        );
        return message.reply(
          `⏰ Slow down! You can slap again in **${remainingTime} seconds**!`,
        );
      }

      // Get or create target user data
      const targetUser = await databaseService.getOrCreateUser(
        target.id,
        message.guild.id,
        {
          username: target.username,
          discriminator: target.discriminator,
          avatar: target.avatar,
        },
      );

      // Record the slap
      await user.recordSlap(true); // Slapper
      await targetUser.recordSlap(false); // Slapped

      // Fun slap messages
      const slapMessages = [
        `👋 **${message.author.username}** slaps **${target.username}** with a wet fish! 🐟`,
        `💥 **${message.author.username}** gives **${target.username}** a powerful slap! 💪`,
        `🖐️ **${message.author.username}** smacks **${target.username}** with a pillow! 🛏️`,
        `⚡ **${message.author.username}** delivers a lightning-fast slap to **${target.username}**! ⚡`,
        `🎭 **${message.author.username}** dramatically slaps **${target.username}**! 🎬`,
        `🌪️ **${message.author.username}** creates a slap tornado around **${target.username}**! 🌪️`,
        `🎪 **${message.author.username}** performs a circus-worthy slap on **${target.username}**! 🎪`,
        `🏆 **${message.author.username}** wins the slap championship against **${target.username}**! 🏆`,
        `🎯 **${message.author.username}** lands a perfect slap on **${target.username}**! 🎯`,
        `🌟 **${message.author.username}** gives **${target.username}** a star-worthy slap! ⭐`,
      ];

      const randomMessage =
        slapMessages[Math.floor(Math.random() * slapMessages.length)];

      // Create embed
      const slapEmbed = new EmbedBuilder()
        .setColor(0xff6b6b) // Red color for slap
        .setTitle("💥 SLAP ATTACK! 💥")
        .setDescription(randomMessage)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({
          text: `Use !slapstats to see your slap statistics!`,
        });

      await message.reply({ embeds: [slapEmbed] });
    } catch (error) {
      logger.error("Error executing slap command:", error);
      message.reply("❌ An error occurred while processing the slap command.");
    }
  },
};
