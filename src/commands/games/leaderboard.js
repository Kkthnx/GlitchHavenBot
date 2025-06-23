const { EmbedBuilder } = require('discord.js');
const databaseService = require('../../utils/databaseService');
const logger = require('../../config/logger');

module.exports = {
    name: 'leaderboard',
    aliases: ['top', 'lb', 'leaderboards'],
    description: 'Displays various server leaderboards including coin flips, levels, and RPS.',
    usage: '!leaderboard [coinflip|level|rps]',
    cooldown: 10,
    guildOnly: true,
    async execute(message, args, client) {
        try {
            const type = args[0]?.toLowerCase() || 'coinflip';

            // Validate leaderboard type
            const validTypes = ['coinflip', 'level', 'rps'];
            if (!validTypes.includes(type)) {
                return message.reply(`❌ Invalid leaderboard type. Use: ${validTypes.join(', ')}`);
            }

            // Get leaderboard data with caching
            const topUsers = await databaseService.getLeaderboard(message.guild.id, type, 10);

            if (topUsers.length === 0) {
                return message.reply(`There's no one on the ${type} leaderboard yet! Play some games to get started.`);
            }

            const leaderboardEmbed = new EmbedBuilder()
                .setColor(getLeaderboardColor(type))
                .setTitle(`🏆 ${getLeaderboardTitle(type)} - ${message.guild.name}`)
                .setThumbnail(message.guild.iconURL({ dynamic: true }))
                .setTimestamp();

            let description = '';
            for (let i = 0; i < topUsers.length; i++) {
                const dbUser = topUsers[i];
                // Fetch the Discord user to get their current username
                const discordUser = await client.users.fetch(dbUser.userId).catch(() => null);
                const username = discordUser ? discordUser.username : 'Unknown User';

                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;

                let statsText = '';
                switch (type) {
                    case 'coinflip':
                        const coinStats = dbUser.gameStats.coinFlips;
                        const winRate = coinStats.total > 0 ? ((coinStats.wins / coinStats.total) * 100).toFixed(1) : 0;
                        statsText = `Wins: \`${coinStats.wins}\` | Losses: \`${coinStats.losses}\` | Win Rate: \`${winRate}%\``;
                        break;
                    case 'level':
                        const levelStats = dbUser.leveling;
                        statsText = `Level: \`${levelStats.level}\` | XP: \`${levelStats.xp}\` | Total XP: \`${levelStats.totalXp.toLocaleString()}\``;
                        break;
                    case 'rps':
                        const rpsStats = dbUser.gameStats.rps;
                        const rpsWinRate = rpsStats.total > 0 ? ((rpsStats.wins / rpsStats.total) * 100).toFixed(1) : 0;
                        statsText = `Wins: \`${rpsStats.wins}\` | Losses: \`${rpsStats.losses}\` | Win Rate: \`${rpsWinRate}%\``;
                        break;
                }

                description += `${medal} **${username}**\n`;
                description += `> ${statsText}\n\n`;
            }

            leaderboardEmbed.setDescription(description);
            leaderboardEmbed.setFooter({ text: `Use !leaderboard <type> to view different leaderboards` });

            await message.reply({ embeds: [leaderboardEmbed] });

        } catch (error) {
            logger.error('Error executing leaderboard command:', error);
            message.reply('❌ An error occurred while fetching the leaderboard.');
        }
    }
};

function getLeaderboardColor(type) {
    switch (type) {
        case 'coinflip': return 0xF1C40F; // Gold
        case 'level': return 0x00FF00; // Green
        case 'rps': return 0x3498DB; // Blue
        default: return 0xF1C40F;
    }
}

function getLeaderboardTitle(type) {
    switch (type) {
        case 'coinflip': return 'Coin Flip Leaderboard';
        case 'level': return 'Level Leaderboard';
        case 'rps': return 'Rock Paper Scissors Leaderboard';
        default: return 'Leaderboard';
    }
} 