const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const databaseService = require("../../utils/databaseService");
const {
  guildCache,
  userCache,
  leaderboardCache,
  gameCache,
} = require("../../utils/cache");
const memoryOptimizer = require("../../utils/memoryOptimizer");
const cleanupUtility = require("../../utils/cleanup");

module.exports = {
  name: "performance",
  aliases: ["perf", "stats"],
  description: "View bot performance metrics and system statistics",
  usage: "!performance",
  cooldown: 30,
  guildOnly: true,
  permissions: [PermissionFlagsBits.Administrator],

  data: new SlashCommandBuilder()
    .setName("performance")
    .setDescription("View bot performance statistics and memory usage")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("memory")
        .setDescription("View detailed memory usage statistics"),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("cleanup").setDescription("Force a cleanup operation"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("optimize")
        .setDescription("Force memory optimization"),
    ),

  async execute(interaction) {
    // Check if user has admin permissions
    if (!interaction.member.permissions.has("Administrator")) {
      return interaction.reply({
        content: "❌ You need Administrator permissions to use this command.",
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "memory":
        await this.showMemoryStats(interaction);
        break;
      case "cleanup":
        await this.forceCleanup(interaction);
        break;
      case "optimize":
        await this.forceOptimize(interaction);
        break;
    }
  },

  async showMemoryStats(interaction) {
    const memStats = memoryOptimizer.getMemoryStats();
    const cleanupStats = cleanupUtility.getCleanupStats();

    const embed = new EmbedBuilder()
      .setTitle("🤖 Bot Performance Statistics")
      .setColor("#00ff00")
      .addFields(
        {
          name: "💾 Memory Usage",
          value: `**Heap Used:** ${memStats.heapUsed}MB\n**Heap Total:** ${memStats.heapTotal}MB\n**Usage Ratio:** ${memStats.usageRatio}%\n**External:** ${memStats.external}MB\n**RSS:** ${memStats.rss}MB`,
          inline: false,
        },
        {
          name: "🧹 Cleanup Status",
          value: `**Last Cleanup:** ${cleanupStats.hoursSinceLastCleanup} hours ago\n**Next Scheduled:** ${Math.max(0, 24 - cleanupStats.hoursSinceLastCleanup)} hours`,
          inline: false,
        },
        {
          name: "⚡ System Info",
          value: `**Node.js Version:** ${process.version}\n**Platform:** ${process.platform}\n**Architecture:** ${process.arch}\n**Uptime:** ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`,
          inline: false,
        },
      )
      .setTimestamp()
      .setFooter({ text: "Gridkeeper Bot Performance Monitor" });

    await interaction.reply({ embeds: [embed] });
  },

  async forceCleanup(interaction) {
    await interaction.deferReply();

    try {
      await cleanupUtility.performFullCleanup();

      const embed = new EmbedBuilder()
        .setTitle("🧹 Cleanup Completed")
        .setDescription("Forced cleanup operation completed successfully.")
        .setColor("#00ff00")
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Cleanup Failed")
        .setDescription(`Error during cleanup: ${error.message}`)
        .setColor("#ff0000")
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  },

  async forceOptimize(interaction) {
    await interaction.deferReply();

    try {
      memoryOptimizer.forceOptimization();

      const memStats = memoryOptimizer.getMemoryStats();

      const embed = new EmbedBuilder()
        .setTitle("⚡ Memory Optimization Completed")
        .setDescription("Memory optimization completed successfully.")
        .addFields({
          name: "Current Memory Usage",
          value: `**Heap Used:** ${memStats.heapUsed}MB\n**Heap Total:** ${memStats.heapTotal}MB\n**Usage Ratio:** ${memStats.usageRatio}%`,
          inline: false,
        })
        .setColor("#00ff00")
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Optimization Failed")
        .setDescription(`Error during optimization: ${error.message}`)
        .setColor("#ff0000")
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  },
};

async function getCacheStats() {
  const guildStats = guildCache.getStats();
  const userStats = userCache.getStats();
  const leaderboardStats = leaderboardCache.getStats();
  const gameStats = gameCache.getStats();

  const totalHits =
    guildStats.hits + userStats.hits + leaderboardStats.hits + gameStats.hits;
  const totalMisses =
    guildStats.misses +
    userStats.misses +
    leaderboardStats.misses +
    gameStats.misses;
  const totalHitRate =
    totalHits + totalMisses > 0
      ? ((totalHits / (totalHits + totalMisses)) * 100).toFixed(2)
      : 0;

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("📊 Cache Performance Statistics")
    .setDescription("Real-time cache performance metrics")
    .addFields(
      {
        name: "🎯 Overall Hit Rate",
        value: `${totalHitRate}% (${totalHits} hits, ${totalMisses} misses)`,
        inline: false,
      },
      {
        name: "🏛️ Guild Cache",
        value: `Hit Rate: ${guildStats.hitRate}\nSize: ${guildStats.size} entries\nMemory: ${guildStats.memoryUsage}`,
        inline: true,
      },
      {
        name: "👤 User Cache",
        value: `Hit Rate: ${userStats.hitRate}\nSize: ${userStats.size} entries\nMemory: ${userStats.memoryUsage}`,
        inline: true,
      },
      {
        name: "🏆 Leaderboard Cache",
        value: `Hit Rate: ${leaderboardStats.hitRate}\nSize: ${leaderboardStats.size} entries\nMemory: ${leaderboardStats.memoryUsage}`,
        inline: true,
      },
      {
        name: "🎮 Game Cache",
        value: `Hit Rate: ${gameStats.hitRate}\nSize: ${gameStats.size} entries\nMemory: ${gameStats.memoryUsage}`,
        inline: true,
      },
    )
    .setFooter({ text: "Cache statistics are updated in real-time" })
    .setTimestamp();

  return embed;
}

async function getDatabaseStats() {
  const stats = await databaseService.getDatabaseStats();

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle("🗄️ Database Performance Statistics")
    .setDescription("Database health and query performance")
    .addFields(
      {
        name: "📈 Query Statistics",
        value: `Total Queries: ${stats.queries.totalQueries}\nSlow Queries: ${stats.queries.slowQueries}\nCached Queries: ${stats.queries.cachedQueries}`,
        inline: false,
      },
      {
        name: "📊 Collection Sizes",
        value: `Users: ${stats.collections.users || 0}\nGuilds: ${stats.collections.guilds || 0}\nTurn Games: ${stats.collections.turngames || 0}\nPets: ${stats.collections.pets || 0}\nAdventures: ${stats.collections.adventures || 0}\nLFG Posts: ${stats.collections.lfgs || 0}`,
        inline: true,
      },
    )
    .setFooter({ text: "Database statistics are updated in real-time" })
    .setTimestamp();

  return embed;
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(" ");
}
