const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const performanceMonitor = require('../../utils/performance');
const databaseService = require('../../utils/databaseService');
const { guildCache, userCache, leaderboardCache, gameCache } = require('../../utils/cache');
const logger = require('../../config/logger');

module.exports = {
    name: 'performance',
    aliases: ['perf', 'stats'],
    description: 'View bot performance metrics and system statistics',
    usage: '!performance',
    cooldown: 30,
    guildOnly: true,
    permissions: [PermissionFlagsBits.Administrator],

    data: new SlashCommandBuilder()
        .setName('performance')
        .setDescription('View bot performance metrics and system statistics')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, args, client) {
        const isSlashCommand = interaction.options !== undefined;

        if (isSlashCommand) {
            await interaction.deferReply();
        }

        try {
            // Get performance metrics
            const perfStats = performanceMonitor.getStats();
            const dbStats = await databaseService.getDatabaseStats();

            const embed = new EmbedBuilder()
                .setColor('#00ff88')
                .setTitle('📊 Bot Performance Metrics')
                .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: 'Performance Monitor' });

            // System Overview
            embed.addFields({
                name: '🖥️ System Overview',
                value: `**Uptime:** ${perfStats.uptime.formatted}\n` +
                    `**Memory Used:** ${perfStats.memory.heapUsed}MB / ${perfStats.memory.heapTotal}MB\n` +
                    `**External Memory:** ${perfStats.memory.external}MB`,
                inline: false
            });

            // Database Performance
            embed.addFields({
                name: '🗄️ Database Performance',
                value: `**Total Queries:** ${perfStats.queries.total}\n` +
                    `**Slow Queries:** ${perfStats.queries.slow}\n` +
                    `**Avg Query Time:** ${perfStats.queries.averageTime.toFixed(2)}ms\n` +
                    `**P95 Query Time:** ${perfStats.performance.queryPercentiles.p95}ms`,
                inline: true
            });

            // Command Performance
            embed.addFields({
                name: '⚡ Command Performance',
                value: `**Total Commands:** ${perfStats.commands.total}\n` +
                    `**Errors:** ${perfStats.commands.errors}\n` +
                    `**Avg Command Time:** ${perfStats.commands.averageTime.toFixed(2)}ms\n` +
                    `**P95 Command Time:** ${perfStats.performance.commandPercentiles.p95}ms`,
                inline: true
            });

            // Cache Performance
            embed.addFields({
                name: '💾 Cache Performance',
                value: `**Hit Rate:** ${perfStats.cache.hitRate.toFixed(1)}%\n` +
                    `**Hits:** ${perfStats.cache.hits}\n` +
                    `**Misses:** ${perfStats.cache.misses}`,
                inline: true
            });

            // Database Collections
            if (dbStats.collections) {
                let collectionsText = '';
                for (const [collection, count] of Object.entries(dbStats.collections)) {
                    collectionsText += `**${collection}:** ${count.toLocaleString()}\n`;
                }

                embed.addFields({
                    name: '📚 Database Collections',
                    value: collectionsText,
                    inline: false
                });
            }

            // Cache Details
            const cacheStats = dbStats.cache || {};
            let cacheDetails = '';
            for (const [cacheName, stats] of Object.entries(cacheStats)) {
                if (stats && typeof stats === 'object') {
                    cacheDetails += `**${cacheName}:** ${stats.hitRate} (${stats.size} items)\n`;
                }
            }

            if (cacheDetails) {
                embed.addFields({
                    name: '🗂️ Cache Details',
                    value: cacheDetails,
                    inline: false
                });
            }

            // Performance Alerts
            const alerts = [];
            if (perfStats.queries.slow > 0) {
                alerts.push('⚠️ Slow database queries detected');
            }
            if (perfStats.commands.errors > 0) {
                alerts.push('❌ Command errors detected');
            }
            if (perfStats.cache.hitRate < 50) {
                alerts.push('💾 Low cache hit rate');
            }
            if (perfStats.memory.heapUsed > perfStats.memory.heapTotal * 0.8) {
                alerts.push('🧠 High memory usage');
            }

            if (alerts.length > 0) {
                embed.addFields({
                    name: '🚨 Performance Alerts',
                    value: alerts.join('\n'),
                    inline: false
                });
            }

            return isSlashCommand ?
                interaction.editReply({ embeds: [embed] }) :
                interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in performance command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('❌ Error')
                .setDescription('An error occurred while fetching performance metrics.')
                .setFooter({ text: 'Performance Monitor' });

            return isSlashCommand ?
                interaction.editReply({ embeds: [errorEmbed] }) :
                interaction.reply({ embeds: [errorEmbed] });
        }
    },
};

async function getCacheStats() {
    const guildStats = guildCache.getStats();
    const userStats = userCache.getStats();
    const leaderboardStats = leaderboardCache.getStats();
    const gameStats = gameCache.getStats();

    const totalHits = guildStats.hits + userStats.hits + leaderboardStats.hits + gameStats.hits;
    const totalMisses = guildStats.misses + userStats.misses + leaderboardStats.misses + gameStats.misses;
    const totalHitRate = totalHits + totalMisses > 0
        ? (totalHits / (totalHits + totalMisses) * 100).toFixed(2)
        : 0;

    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('📊 Cache Performance Statistics')
        .setDescription('Real-time cache performance metrics')
        .addFields(
            {
                name: '🎯 Overall Hit Rate',
                value: `${totalHitRate}% (${totalHits} hits, ${totalMisses} misses)`,
                inline: false
            },
            {
                name: '🏛️ Guild Cache',
                value: `Hit Rate: ${guildStats.hitRate}\nSize: ${guildStats.size} entries\nMemory: ${guildStats.memoryUsage}`,
                inline: true
            },
            {
                name: '👤 User Cache',
                value: `Hit Rate: ${userStats.hitRate}\nSize: ${userStats.size} entries\nMemory: ${userStats.memoryUsage}`,
                inline: true
            },
            {
                name: '🏆 Leaderboard Cache',
                value: `Hit Rate: ${leaderboardStats.hitRate}\nSize: ${leaderboardStats.size} entries\nMemory: ${leaderboardStats.memoryUsage}`,
                inline: true
            },
            {
                name: '🎮 Game Cache',
                value: `Hit Rate: ${gameStats.hitRate}\nSize: ${gameStats.size} entries\nMemory: ${gameStats.memoryUsage}`,
                inline: true
            }
        )
        .setFooter({ text: 'Cache statistics are updated in real-time' })
        .setTimestamp();

    return embed;
}

async function getDatabaseStats() {
    const stats = await databaseService.getDatabaseStats();

    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('🗄️ Database Performance Statistics')
        .setDescription('Database health and query performance')
        .addFields(
            {
                name: '📈 Query Statistics',
                value: `Total Queries: ${stats.queries.totalQueries}\nSlow Queries: ${stats.queries.slowQueries}\nCached Queries: ${stats.queries.cachedQueries}`,
                inline: false
            },
            {
                name: '📊 Collection Sizes',
                value: `Users: ${stats.collections.users || 0}\nGuilds: ${stats.collections.guilds || 0}\nTurn Games: ${stats.collections.turngames || 0}\nPets: ${stats.collections.pets || 0}\nAdventures: ${stats.collections.adventures || 0}\nLFG Posts: ${stats.collections.lfgs || 0}`,
                inline: true
            }
        )
        .setFooter({ text: 'Database statistics are updated in real-time' })
        .setTimestamp();

    return embed;
}

async function getAllStats() {
    const [cacheStats, dbStats] = await Promise.all([
        getCacheStats(),
        getDatabaseStats()
    ]);

    // Combine the embeds
    const embed = new EmbedBuilder()
        .setColor(0xFF6B35)
        .setTitle('🚀 Bot Performance Overview')
        .setDescription('Comprehensive performance metrics for Gridkeeper Bot')
        .addFields(
            {
                name: '📊 Cache Performance',
                value: cacheStats.data?.fields?.[0]?.value || 'N/A',
                inline: false
            },
            {
                name: '🗄️ Database Performance',
                value: dbStats.data?.fields?.[0]?.value || 'N/A',
                inline: false
            },
            {
                name: '💾 Memory Usage',
                value: `Heap Used: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\nHeap Total: ${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB\nExternal: ${(process.memoryUsage().external / 1024 / 1024).toFixed(2)} MB`,
                inline: true
            },
            {
                name: '⏱️ Uptime',
                value: formatUptime(process.uptime()),
                inline: true
            }
        )
        .setFooter({ text: 'Performance metrics are updated in real-time' })
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

    return parts.join(' ');
} 