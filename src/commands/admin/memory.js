const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const memoryOptimizer = require("../../utils/memoryOptimizer");
const {
  guildCache,
  userCache,
  leaderboardCache,
  gameCache,
} = require("../../utils/cache");

module.exports = {
  name: "memory",
  aliases: ["mem", "gc"],
  description: "View and manage bot memory usage",
  usage: "!memory [optimize]",
  cooldown: 30,
  guildOnly: true,
  permissions: [PermissionFlagsBits.Administrator],

  data: new SlashCommandBuilder()
    .setName("memory")
    .setDescription("View and manage bot memory usage")
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("Action to perform")
        .addChoices(
          { name: "View Stats", value: "stats" },
          { name: "Optimize Memory", value: "optimize" },
          { name: "Clear Caches", value: "clear" },
        )
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, args, client) {
    const isSlashCommand = interaction.options !== undefined;

    if (isSlashCommand) {
      await interaction.deferReply();
    }

    try {
      let action = "stats";

      if (isSlashCommand) {
        action = interaction.options.getString("action") || "stats";
      } else if (args && args.length > 0) {
        action = args[0].toLowerCase();
      }

      const embed = new EmbedBuilder()
        .setColor("#00ff88")
        .setTitle("🧠 Memory Management")
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: "Memory Optimizer" });

      switch (action) {
        case "optimize":
          await this.handleOptimize(embed);
          break;
        case "clear":
          await this.handleClear(embed);
          break;
        case "stats":
        default:
          await this.handleStats(embed);
          break;
      }

      return isSlashCommand
        ? interaction.editReply({ embeds: [embed] })
        : interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in memory command:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff4444")
        .setTitle("❌ Error")
        .setDescription("An error occurred while managing memory.")
        .setFooter({ text: "Memory Optimizer" });

      return isSlashCommand
        ? interaction.editReply({ embeds: [errorEmbed] })
        : interaction.reply({ embeds: [errorEmbed] });
    }
  },

  async handleStats(embed) {
    const memStats = memoryOptimizer.getMemoryStats();
    const cacheStats = {
      guild: guildCache.getStats(),
      user: userCache.getStats(),
      leaderboard: leaderboardCache.getStats(),
      game: gameCache.getStats(),
    };

    // Memory Overview
    embed.addFields({
      name: "🖥️ Memory Overview",
      value:
        `**Heap Used:** ${memStats.heapUsed}MB / ${memStats.heapTotal}MB\n` +
        `**Usage Ratio:** ${memStats.usageRatio}%\n` +
        `**External Memory:** ${memStats.external}MB\n` +
        `**RSS:** ${memStats.rss}MB`,
      inline: false,
    });

    // Cache Memory Usage
    let totalCacheSize = 0;
    let totalCacheHits = 0;
    let totalCacheMisses = 0;

    for (const _ in cacheStats) {
      totalCacheSize += cacheStats[_].size;
      totalCacheHits += cacheStats[_].hits;
      totalCacheMisses += cacheStats[_].misses;
    }

    const overallHitRate =
      totalCacheHits + totalCacheMisses > 0
        ? (
          (totalCacheHits / (totalCacheHits + totalCacheMisses)) *
          100
        ).toFixed(1)
        : 0;

    embed.addFields({
      name: "💾 Cache Overview",
      value:
        `**Total Cache Size:** ${totalCacheSize} items\n` +
        `**Overall Hit Rate:** ${overallHitRate}%\n` +
        `**Total Hits:** ${totalCacheHits}\n` +
        `**Total Misses:** ${totalCacheMisses}`,
      inline: true,
    });

    // Individual Cache Stats
    let cacheDetails = "";
    for (const _ in cacheStats) {
      cacheDetails += `**${_}:** ${cacheStats[_].size}/${cacheStats[_].maxSize} items (${cacheStats[_].hitRate})\n`;
    }

    embed.addFields({
      name: "🗂️ Cache Details",
      value: cacheDetails,
      inline: true,
    });

    // Memory Alerts
    const alerts = [];
    if (parseFloat(memStats.usageRatio) > 80) {
      alerts.push("⚠️ High memory usage detected");
    }
    if (parseFloat(overallHitRate) < 50) {
      alerts.push("💾 Low cache hit rate");
    }
    if (totalCacheSize > 300) {
      alerts.push("🗂️ Large cache size");
    }

    if (alerts.length > 0) {
      embed.addFields({
        name: "🚨 Memory Alerts",
        value: alerts.join("\n"),
        inline: false,
      });
    }
  },

  async handleOptimize(embed) {
    const beforeStats = memoryOptimizer.getMemoryStats();

    // Perform optimization
    memoryOptimizer.forceOptimization();

    // Wait a moment for optimization to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const afterStats = memoryOptimizer.getMemoryStats();
    const memoryFreed = beforeStats.heapUsed - afterStats.heapUsed;

    embed.addFields({
      name: "✅ Memory Optimization Complete",
      value:
        `**Memory Freed:** ${memoryFreed > 0 ? "+" : ""}${memoryFreed}MB\n` +
        `**Before:** ${beforeStats.heapUsed}MB / ${beforeStats.heapTotal}MB\n` +
        `**After:** ${afterStats.heapUsed}MB / ${afterStats.heapTotal}MB\n` +
        `**Usage:** ${afterStats.usageRatio}%`,
      inline: false,
    });

    // Clear expired cache entries
    guildCache.cleanup();
    userCache.cleanup();
    leaderboardCache.cleanup();
    gameCache.cleanup();

    embed.addFields({
      name: "🧹 Cache Cleanup",
      value: "Expired cache entries have been removed.",
      inline: false,
    });
  },

  async handleClear(embed) {
    // Clear all caches
    guildCache.clear();
    userCache.clear();
    leaderboardCache.clear();
    gameCache.clear();

    // Force garbage collection
    if (global.gc) {
      global.gc();
    }

    const memStats = memoryOptimizer.getMemoryStats();

    embed.addFields({
      name: "🗑️ Cache Cleared",
      value:
        "**All caches have been cleared**\n" +
        `**Current Memory:** ${memStats.heapUsed}MB / ${memStats.heapTotal}MB\n` +
        `**Usage:** ${memStats.usageRatio}%`,
      inline: false,
    });
  },
};
