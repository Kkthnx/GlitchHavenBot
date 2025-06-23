const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const mongoose = require("mongoose");

const performanceMonitor = require("../../utils/performance");
const memoryOptimizer = require("../../utils/memoryOptimizer");
const databaseService = require("../../utils/databaseService");
const {
  guildCache,
  userCache,
  leaderboardCache,
  gameCache,
} = require("../../utils/cache");

module.exports = {
  name: "health",
  aliases: ["status", "bothealth"],
  description: "Comprehensive bot health check and system status",
  usage: "!health",
  cooldown: 60,
  guildOnly: true,
  permissions: [PermissionFlagsBits.Administrator],

  data: new SlashCommandBuilder()
    .setName("health")
    .setDescription("Comprehensive bot health check and system status")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, args, client) {
    const isSlashCommand = interaction.options !== undefined;

    if (isSlashCommand) {
      await interaction.deferReply();
    }

    try {
      const embed = new EmbedBuilder()
        .setColor("#00ff88")
        .setTitle("🏥 Bot Health Check")
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: "System Health Monitor" });

      // System Health
      await this.addSystemHealth(embed, client);

      // Database Health
      await this.addDatabaseHealth(embed);

      // Cache Health
      await this.addCacheHealth(embed);

      // Performance Health
      await this.addPerformanceHealth(embed);

      // Memory Health
      await this.addMemoryHealth(embed);

      // Overall Status
      await this.addOverallStatus(embed);

      return isSlashCommand
        ? interaction.editReply({ embeds: [embed] })
        : interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in health command:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff4444")
        .setTitle("❌ Error")
        .setDescription("An error occurred while checking bot health.")
        .setFooter({ text: "System Health Monitor" });

      return isSlashCommand
        ? interaction.editReply({ embeds: [errorEmbed] })
        : interaction.reply({ embeds: [errorEmbed] });
    }
  },

  async addSystemHealth(embed, client) {
    const uptime = process.uptime();
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);
    const uptimeSeconds = Math.floor(uptime % 60);

    const { ping } = client.ws;
    const guildCount = client.guilds.cache.size;
    const userCount = client.users.cache.size;

    embed.addFields({
      name: "🖥️ System Status",
      value:
        `**Uptime:** ${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s\n` +
        `**Ping:** ${ping}ms\n` +
        `**Guilds:** ${guildCount}\n` +
        `**Users:** ${userCount}\n` +
        `**Node Version:** ${process.version}`,
      inline: true,
    });
  },

  async addDatabaseHealth(embed) {
    const dbState = mongoose.connection.readyState;
    const dbStates = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    const dbStatus = dbStates[dbState] || "unknown";
    const dbColor = dbState === 1 ? "🟢" : "🔴";

    try {
      const stats = await databaseService.getDatabaseStats();
      const collectionCounts = Object.values(stats.collections || {}).reduce(
        (a, b) => a + b,
        0,
      );

      embed.addFields({
        name: "🗄️ Database Status",
        value:
          `${dbColor} **Status:** ${dbStatus}\n` +
          `**Collections:** ${collectionCounts} total documents\n` +
          `**Host:** ${mongoose.connection.host}\n` +
          `**Database:** ${mongoose.connection.name}`,
        inline: true,
      });
    } catch (error) {
      embed.addFields({
        name: "🗄️ Database Status",
        value: "🔴 **Error:** Unable to fetch database stats",
        inline: true,
      });
    }
  },

  async addCacheHealth(embed) {
    const caches = {
      guild: guildCache.getStats(),
      user: userCache.getStats(),
      leaderboard: leaderboardCache.getStats(),
      game: gameCache.getStats(),
    };

    let totalSize = 0;
    let totalHits = 0;
    let totalMisses = 0;

    for (const _ in caches) {
      totalSize += caches[_].size;
      totalHits += caches[_].hits;
      totalMisses += caches[_].misses;
    }

    const overallHitRate =
      totalHits + totalMisses > 0
        ? ((totalHits / (totalHits + totalMisses)) * 100).toFixed(1)
        : 0;

    const cacheColor = parseFloat(overallHitRate) > 50 ? "🟢" : "🟡";

    embed.addFields({
      name: "💾 Cache Status",
      value:
        `${cacheColor} **Hit Rate:** ${overallHitRate}%\n` +
        `**Total Items:** ${totalSize}\n` +
        `**Hits:** ${totalHits}\n` +
        `**Misses:** ${totalMisses}`,
      inline: true,
    });
  },

  async addPerformanceHealth(embed) {
    const perfStats = performanceMonitor.getStats();

    const queryHealth = perfStats.queries.slow === 0 ? "🟢" : "🟡";
    const commandHealth = perfStats.commands.errors === 0 ? "🟢" : "🟡";

    embed.addFields({
      name: "⚡ Performance Status",
      value:
        `${queryHealth} **Queries:** ${perfStats.queries.total} (${perfStats.queries.slow} slow)\n` +
        `${commandHealth} **Commands:** ${perfStats.commands.total} (${perfStats.commands.errors} errors)\n` +
        `**Avg Query Time:** ${perfStats.queries.averageTime.toFixed(2)}ms\n` +
        `**Avg Command Time:** ${perfStats.commands.averageTime.toFixed(2)}ms`,
      inline: false,
    });
  },

  async addMemoryHealth(embed) {
    const memStats = memoryOptimizer.getMemoryStats();
    const usageRatio = parseFloat(memStats.usageRatio);

    let memoryColor = "🟢";
    if (usageRatio > 80) memoryColor = "🔴";
    else if (usageRatio > 60) memoryColor = "🟡";

    embed.addFields({
      name: "🧠 Memory Status",
      value:
        `${memoryColor} **Usage:** ${memStats.usageRatio}%\n` +
        `**Heap:** ${memStats.heapUsed}MB / ${memStats.heapTotal}MB\n` +
        `**External:** ${memStats.external}MB\n` +
        `**RSS:** ${memStats.rss}MB`,
      inline: true,
    });
  },

  async addOverallStatus(embed) {
    const alerts = [];
    const perfStats = performanceMonitor.getStats();
    const memStats = memoryOptimizer.getMemoryStats();

    // Check for issues
    if (perfStats.queries.slow > 0) {
      alerts.push("⚠️ Slow database queries detected");
    }
    if (perfStats.commands.errors > 0) {
      alerts.push("❌ Command errors detected");
    }
    if (parseFloat(memStats.usageRatio) > 80) {
      alerts.push("🧠 High memory usage");
    }
    if (mongoose.connection.readyState !== 1) {
      alerts.push("🗄️ Database connection issues");
    }

    if (alerts.length === 0) {
      embed.addFields({
        name: "✅ Overall Status",
        value:
          "🟢 **All systems operational**\nBot is running smoothly with no issues detected.",
        inline: false,
      });
    } else {
      embed.addFields({
        name: "⚠️ Health Alerts",
        value: alerts.join("\n"),
        inline: false,
      });
    }

    // Add recommendations
    const recommendations = [];
    if (parseFloat(memStats.usageRatio) > 70) {
      recommendations.push("• Consider running `/memory optimize`");
    }
    if (perfStats.queries.slow > 0) {
      recommendations.push("• Monitor database performance");
    }
    if (perfStats.commands.errors > 0) {
      recommendations.push("• Check command error logs");
    }

    if (recommendations.length > 0) {
      embed.addFields({
        name: "💡 Recommendations",
        value: recommendations.join("\n"),
        inline: false,
      });
    }
  },
};
