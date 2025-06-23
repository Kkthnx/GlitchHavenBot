const { EmbedBuilder } = require('discord.js');
const databaseService = require('../../utils/databaseService');
const { guildCache, userCache, leaderboardCache, gameCache } = require('../../utils/cache');
const logger = require('../../config/logger');

module.exports = {
    name: 'performance',
    aliases: ['perf', 'stats'],
    description: 'View bot performance statistics and cache information',
    usage: 'performance [cache|database|all]',
    cooldown: 10,
    guildOnly: true,
    async execute(message, args, client) {
        // Check if user has admin permissions
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('❌ You need Administrator permissions to use this command.');
        }

        const type = args[0]?.toLowerCase() || 'all';

        try {
            let embed;

            switch (type) {
                case 'cache':
                    embed = await getCacheStats();
                    break;
                case 'database':
                    embed = await getDatabaseStats();
                    break;
                case 'all':
                default:
                    embed = await getAllStats();
                    break;
            }

            await message.reply({ embeds: [embed] });

        } catch (error) {
            logger.error('Error in performance command:', error);
            message.reply('❌ An error occurred while fetching performance statistics.');
        }
    }
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