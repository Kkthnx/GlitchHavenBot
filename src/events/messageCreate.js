const { Collection } = require("discord.js");

const logger = require("../config/logger");
const databaseService = require("../utils/databaseService");
const { containsProfanity } = require("../utils/helpers");
const performanceMonitor = require("../utils/performance");

// Cooldown collection for XP (prevent spam)
const xpCooldowns = new Collection();
// Batch XP updates for better performance
const xpBatch = new Map();
const XP_BATCH_SIZE = 10;
const XP_BATCH_TIMEOUT = 5000; // 5 seconds

module.exports = {
  name: "messageCreate",
  async execute(message, client) {
    // Ignore bot messages and DMs
    if (message.author.bot || !message.guild) return;

    try {
      // Use database service for optimized queries with caching
      const [guildSettings, userData] = await Promise.all([
        databaseService.getGuildSettings(message.guild.id),
        databaseService.getOrCreateUser(message.author.id, message.guild.id, {
          username: message.author.username,
          discriminator: message.author.discriminator,
          avatar: message.author.avatar,
        }),
      ]);

      if (!guildSettings) return;

      // Update user's last seen timestamp
      if (userData) {
        await userData.updateLastSeen();
      }

      // Auto-moderation must be handled first
      if (guildSettings.moderation.autoMod.enabled) {
        const isActionTaken = await handleAutoModeration(
          message,
          guildSettings,
          userData,
          client,
        );
        // If automod took action (e.g., deleted the message), stop further processing.
        if (isActionTaken) return;
      }

      // Command handler
      const prefix = guildSettings.prefix || client.config.prefix;
      if (message.content.startsWith(prefix)) {
        return await handleCommands(message, client, prefix);
      }

      // Award XP for regular messages
      await handleXp(message, userData, guildSettings);
    } catch (error) {
      logger.error("Error in messageCreate event:", error);
    }
  },
};

async function handleAutoModeration(message, guildSettings, userData, client) {
  const { autoMod } = guildSettings.moderation;

  if (autoMod.wordFilter && autoMod.bannedWords.length > 0) {
    if (containsProfanity(message.content, autoMod.bannedWords)) {
      await handleViolation(
        message,
        "Inappropriate language",
        userData,
        client,
      );
      return true; // Indicates an action was taken
    }
  }

  // Add other automod checks here like link filtering or spam detection
  // For now, we only have word filter.

  return false; // No action taken
}

async function handleViolation(message, reason, user, client) {
  try {
    await message.delete();

    if (user) {
      await user.addWarning(reason, client.user.id, client.user.tag);
    }

    const warningEmbed = {
      color: 0xff0000,
      title: "Auto-Moderation Action",
      description: `Your message was removed for the following reason: **${reason}**.`,
      footer: { text: "Repeated violations may result in further action." },
    };

    message.author.send({ embeds: [warningEmbed] }).catch(() => {
      message.channel
        .send(
          `${message.author}, your message was removed for violating our server rules.`,
        )
        .then((msg) => {
          setTimeout(() => msg.delete(), 10000);
        });
    });
  } catch (error) {
    logger.error(
      `Error handling auto-mod violation for ${message.author.tag}:`,
      error,
    );
  }
}

async function handleCommands(message, client, prefix) {
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command =
    client.commands.get(commandName) ||
    client.commands.find(
      (cmd) => cmd.aliases && cmd.aliases.includes(commandName),
    );

  if (!command) return;

  // Cooldown check
  const { cooldowns } = client;
  if (!cooldowns.has(command.name)) {
    cooldowns.set(command.name, new Collection());
  }
  const now = Date.now();
  const timestamps = cooldowns.get(command.name);
  const cooldownAmount = (command.cooldown || 5) * 1000;

  if (timestamps.has(message.author.id)) {
    const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      return message.reply(
        `Please wait ${timeLeft.toFixed(1)} more second(s) before using the \`${command.name}\` command.`,
      );
    }
  }
  timestamps.set(message.author.id, now);
  setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

  // Execute command with performance monitoring
  try {
    await performanceMonitor.monitorCommand(async () => {
      await command.execute(message, args, client);
    }, command.name);
  } catch (error) {
    logger.error(`Error executing command ${command.name}:`, error);
    message.reply("There was an error executing that command!").catch(() => {});
  }
}

async function handleXp(message, user, guildSettings) {
  if (!guildSettings.leveling.enabled) return;

  const cooldownKey = `${message.author.id}-${message.guild.id}`;
  const cooldownTime = guildSettings.leveling.xpCooldown || 60000;

  if (
    xpCooldowns.has(cooldownKey) &&
    Date.now() - xpCooldowns.get(cooldownKey) < cooldownTime
  ) {
    return;
  }

  const xpToAward = Math.floor(Math.random() * 11) + 15;
  const guildKey = message.guild.id;

  // Add to batch for bulk processing
  if (!xpBatch.has(guildKey)) {
    xpBatch.set(guildKey, []);

    // Set timeout to process batch
    setTimeout(() => processXpBatch(guildKey), XP_BATCH_TIMEOUT);
  }

  const batch = xpBatch.get(guildKey);
  batch.push({
    userId: message.author.id,
    guildId: message.guild.id,
    xp: xpToAward,
    user,
  });

  // Process batch if it reaches the size limit
  if (batch.length >= XP_BATCH_SIZE) {
    await processXpBatch(guildKey);
  }

  xpCooldowns.set(cooldownKey, Date.now());
}

async function processXpBatch(guildKey) {
  const batch = xpBatch.get(guildKey);
  if (!batch || batch.length === 0) return;

  xpBatch.delete(guildKey);

  try {
    const User = require("../models/User");
    const updates = [];
    const levelUps = [];

    // Process each user in the batch
    for (const item of batch) {
      const oldLevel = item.user.leveling.level;
      item.user.leveling.xp += item.xp;
      item.user.leveling.totalXp += item.xp;
      item.user.leveling.lastMessage = new Date();

      const newLevel = Math.floor(0.1 * Math.sqrt(item.user.leveling.xp));

      if (newLevel > oldLevel) {
        // Level up - need to save individually for level up history
        item.user.leveling.level = newLevel;
        item.user.leveling.levelUpHistory.push({
          level: newLevel,
          timestamp: new Date(),
        });
        levelUps.push({
          user: item.user,
          oldLevel,
          newLevel,
          xpGained: item.xp,
        });
      } else {
        // No level up - add to bulk update
        updates.push({
          userId: item.userId,
          guildId: item.guildId,
          xp: item.xp,
        });
      }
    }

    // Execute bulk update for non-level-up XP
    if (updates.length > 0) {
      await User.bulkUpdateXP(updates);
    }

    // Handle level ups individually (they need special processing)
    for (const levelUp of levelUps) {
      await levelUp.user.save();
      // Note: Level up notifications would need to be handled differently
      // since we don't have the message context in batch processing
    }
  } catch (error) {
    logger.error("Error processing XP batch:", error);
  }
}
