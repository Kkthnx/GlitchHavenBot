const fs = require("fs");
const path = require("path");

const { EmbedBuilder, AttachmentBuilder } = require("discord.js");

const User = require("../../models/User");
const logger = require("../../config/logger");
const { createRankCard } = require("../../utils/rankCardGenerator");

module.exports = {
  name: "rankcard",
  aliases: ["card"],
  description: "Customize your rank card background.",
  usage: "!rankcard <set|list|view|clear> [background_name]",
  cooldown: 10,
  guildOnly: true,
  async execute(message, args) {
    const subcommand = args[0]?.toLowerCase();

    switch (subcommand) {
      case "set":
        await handleSet(message, args.slice(1));
        break;
      case "list":
        await handleList(message);
        break;
      case "view":
        await handleView(message);
        break;
      case "clear":
        await handleClear(message);
        break;
      default:
        await showHelp(message);
    }
  },
};

async function handleSet(message, args) {
  const backgroundName = args[0]?.toLowerCase();
  if (!backgroundName) {
    return message.reply(
      "Please provide the name of the background you want to set. Use `!rankcard list` to see available backgrounds.",
    );
  }

  const backgroundsPath = path.join(__dirname, "../../../assets/rankcards");
  const availableBackgrounds = fs
    .readdirSync(backgroundsPath)
    .filter((file) => file.endsWith(".png"))
    .map((file) => file.replace(".png", ""));

  if (!availableBackgrounds.includes(backgroundName)) {
    return message.reply(
      "That background does not exist. Use `!rankcard list` to see available backgrounds.",
    );
  }

  try {
    await User.findOneAndUpdate(
      { userId: message.author.id, guildId: message.guild.id },
      { "preferences.rankCardBackground": backgroundName },
      { new: true, upsert: true },
    );

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("Rank Card Updated")
      .setDescription(
        `Your rank card background has been set to **${backgroundName}**.`,
      )
      .setFooter({ text: "Use `!level` to see your new rank card." });

    await message.reply({ embeds: [embed] });
  } catch (error) {
    logger.error("Error setting rank card:", error);
    return message.reply("An error occurred while setting your rank card.");
  }
}

async function handleView(message) {
  try {
    await message.channel.sendTyping();

    const targetMember = message.member;
    const targetUser = targetMember.user;
    let dbUser = await User.findOne({
      userId: targetUser.id,
      guildId: message.guild.id,
    });

    if (!dbUser) {
      // Create a temporary user object for users not yet in the DB
      dbUser = new User({
        userId: targetUser.id,
        guildId: message.guild.id,
        username: targetUser.username,
        discriminator: targetUser.discriminator,
      });
    }

    const rank =
      (await User.find({
        "leveling.totalXp": { $gt: dbUser.leveling.totalXp },
        guildId: message.guild.id,
      }).countDocuments()) + 1;

    const progress = dbUser.getLevelProgress();

    const rankCardData = {
      avatarURL: targetUser.displayAvatarURL({ extension: "png", size: 256 }),
      username: targetUser.username,
      discriminator: targetUser.discriminator,
      level: progress.currentLevel,
      rank,
      currentXp: progress.xpInCurrentLevel,
      neededXp: progress.xpNeededForNextLevel,
    };

    const backgroundName = dbUser.preferences.rankCardBackground || "default";

    const imageBuffer = await createRankCard(
      rankCardData,
      backgroundName,
      targetUser,
      targetMember,
    );
    const attachment = new AttachmentBuilder(imageBuffer, {
      name: "rank-card.png",
    });

    await message.reply({ files: [attachment] });
  } catch (error) {
    logger.error("Error executing rankcard view command:", error);
    return message.reply("❌ An error occurred while fetching your rank card.");
  }
}

async function handleList(message) {
  const backgroundsPath = path.join(__dirname, "../../../assets/rankcards");
  try {
    const availableBackgrounds = fs
      .readdirSync(backgroundsPath)
      .filter((file) => file.endsWith(".png"))
      .map((file) => file.replace(".png", ""));

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("Available Rank Card Backgrounds")
      .setDescription(
        availableBackgrounds.map((bg) => `• ${bg}`).join("\n") ||
        "No backgrounds available yet. Admins can add .png files to `assets/rankcards`.",
      )
      .setFooter({ text: "Use `/rankcard set <name>` to choose one." });

    await message.reply({ embeds: [embed] });
  } catch (error) {
    logger.error("Error listing rank cards, could not find directory.", error);
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("Available Rank Card Backgrounds")
      .setDescription(
        "No backgrounds available yet. Admins can add .png files to `assets/rankcards`.",
      )
      .setFooter({ text: "Use `/rankcard set <name>` to choose one." });
    await message.reply({ embeds: [embed] });
  }
}

async function handleClear(message) {
  try {
    await User.findOneAndUpdate(
      { userId: message.author.id, guildId: message.guild.id },
      { "preferences.rankCardBackground": "default" },
      { new: true, upsert: true },
    );

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("Rank Card Cleared")
      .setDescription(
        "Your rank card background has been reset to the default.",
      )
      .setFooter({ text: "Use `!level` to see your rank card." });

    await message.reply({ embeds: [embed] });
  } catch (error) {
    logger.error("Error clearing rank card:", error);
    return message.reply("An error occurred while clearing your rank card.");
  }
}

async function showHelp(message) {
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("Rank Card Command Help")
    .setDescription("Customize your rank card background.")
    .addFields(
      {
        name: "`!rankcard set <name>`",
        value: "Set your rank card background.",
      },
      { name: "`!rankcard list`", value: "List available backgrounds." },
      { name: "`!rankcard view`", value: "View your current rank card." },
      {
        name: "`!rankcard clear`",
        value: "Reset your rank card to the default.",
      },
    );
  await message.reply({ embeds: [embed] });
}
