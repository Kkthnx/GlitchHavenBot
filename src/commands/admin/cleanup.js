const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const cleanupUtility = require('../../utils/cleanup');
const memoryOptimizer = require('../../utils/memoryOptimizer');
const { guildCache, userCache, leaderboardCache, gameCache } = require('../../utils/cache');

module.exports = {
    name: 'cleanup',
    aliases: ['maintenance', 'optimize'],
    description: 'Perform bot maintenance and cleanup tasks',
    usage: '!cleanup [type]',
    cooldown: 300, // 5 minutes
    guildOnly: true,
    permissions: [PermissionFlagsBits.Administrator],

    data: new SlashCommandBuilder()
        .setName('cleanup')
        .setDescription('Perform bot maintenance and cleanup tasks')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of cleanup to perform')
                .addChoices(
                    { name: 'Full Cleanup', value: 'full' },
                    { name: 'Cache Only', value: 'cache' },
                    { name: 'Database Only', value: 'database' },
                    { name: 'Memory Only', value: 'memory' }
                )
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, args, client) {
        const isSlashCommand = interaction.options !== undefined;

        if (isSlashCommand) {
            await interaction.deferReply();
        }

        try {
            let cleanupType = 'full';

            if (isSlashCommand) {
                cleanupType = interaction.options.getString('type') || 'full';
            } else {
                if (args && args.length > 0) {
                    cleanupType = args[0].toLowerCase();
                }
            }

            const embed = new EmbedBuilder()
                .setColor('#00ff88')
                .setTitle('🧹 Bot Maintenance')
                .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: 'Maintenance System' });

            switch (cleanupType) {
                case 'cache':
                    await this.handleCacheCleanup(embed);
                    break;
                case 'database':
                    await this.handleDatabaseCleanup(embed);
                    break;
                case 'memory':
                    await this.handleMemoryCleanup(embed);
                    break;
                case 'full':
                default:
                    await this.handleFullCleanup(embed);
                    break;
            }

            return isSlashCommand ?
                interaction.editReply({ embeds: [embed] }) :
                interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in cleanup command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('❌ Error')
                .setDescription('An error occurred during cleanup.')
                .setFooter({ text: 'Maintenance System' });

            return isSlashCommand ?
                interaction.editReply({ embeds: [errorEmbed] }) :
                interaction.reply({ embeds: [errorEmbed] });
        }
    },

    async handleCacheCleanup(embed) {
        const beforeStats = {
            guild: guildCache.getStats(),
            user: userCache.getStats(),
            leaderboard: leaderboardCache.getStats(),
            game: gameCache.getStats()
        };

        // Clear all caches
        guildCache.clear();
        userCache.clear();
        leaderboardCache.clear();
        gameCache.clear();

        const totalBefore = Object.values(beforeStats).reduce((sum, stats) => sum + stats.size, 0);

        embed.addFields({
            name: '🗂️ Cache Cleanup Complete',
            value: `**Cleared:** ${totalBefore} cache entries\n` +
                `**Caches:** Guild, User, Leaderboard, Game\n` +
                `**Status:** All caches refreshed`,
            inline: false
        });
    },

    async handleDatabaseCleanup(embed) {
        embed.addFields({
            name: '🗄️ Database Cleanup Started',
            value: 'Cleaning up expired data and optimizing database...',
            inline: false
        });

        try {
            await cleanupUtility.cleanupExpiredData();
            await cleanupUtility.optimizeDatabase();

            embed.addFields({
                name: '✅ Database Cleanup Complete',
                value: 'Expired data removed and database optimized.',
                inline: false
            });
        } catch (error) {
            embed.addFields({
                name: '⚠️ Database Cleanup Issues',
                value: 'Some cleanup tasks encountered errors. Check logs for details.',
                inline: false
            });
        }
    },

    async handleMemoryCleanup(embed) {
        const beforeStats = memoryOptimizer.getMemoryStats();

        // Perform memory optimization
        memoryOptimizer.forceOptimization();

        // Wait for optimization to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        const afterStats = memoryOptimizer.getMemoryStats();
        const memoryFreed = beforeStats.heapUsed - afterStats.heapUsed;

        embed.addFields({
            name: '🧠 Memory Cleanup Complete',
            value: `**Memory Freed:** ${memoryFreed > 0 ? '+' : ''}${memoryFreed}MB\n` +
                `**Before:** ${beforeStats.heapUsed}MB / ${beforeStats.heapTotal}MB\n` +
                `**After:** ${afterStats.heapUsed}MB / ${afterStats.heapTotal}MB\n` +
                `**Usage:** ${afterStats.usageRatio}%`,
            inline: false
        });
    },

    async handleFullCleanup(embed) {
        embed.addFields({
            name: '🚀 Full Cleanup Started',
            value: 'Performing comprehensive maintenance...\nThis may take a few moments.',
            inline: false
        });

        try {
            // Perform full cleanup
            await cleanupUtility.performFullCleanup();

            // Get final stats
            const memStats = memoryOptimizer.getMemoryStats();
            const cleanupStats = cleanupUtility.getCleanupStats();

            embed.addFields({
                name: '✅ Full Cleanup Complete',
                value: `**Memory Usage:** ${memStats.heapUsed}MB / ${memStats.heapTotal}MB (${memStats.usageRatio}%)\n` +
                    `**Next Auto-Cleanup:** ${cleanupStats.hoursSinceLastCleanup} hours\n` +
                    `**Status:** All systems optimized`,
                inline: false
            });

            embed.addFields({
                name: '📋 Cleanup Summary',
                value: '• All caches cleared\n' +
                    '• Expired data removed\n' +
                    '• Database optimized\n' +
                    '• Memory optimized\n' +
                    '• Module cache cleared',
                inline: false
            });

        } catch (error) {
            embed.addFields({
                name: '⚠️ Cleanup Issues',
                value: 'Some cleanup tasks encountered errors. Check logs for details.',
                inline: false
            });
        }
    }
}; 