const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const logger = require('../../config/logger');

module.exports = {
    name: 'leaderboard',
    aliases: ['top', 'lb'],
    description: 'Displays the server\'s coin flip leaderboard.',
    usage: 'leaderboard',
    cooldown: 30,
    guildOnly: true,
    async execute(message, args, client) {
        try {
            // Find top 10 users, sorted by their coin flip wins in descending order
            const topUsers = await User.find({
                guildId: message.guild.id,
                'gameStats.coinFlips.wins': { $gt: 0 } // Only include users with at least one win
            })
                .sort({ 'gameStats.coinFlips.wins': -1 })
                .limit(10);

            if (topUsers.length === 0) {
                return message.reply("There's no one on the leaderboard yet! Play some games to get started.");
            }

            const leaderboardEmbed = new EmbedBuilder()
                .setColor(0xF1C40F) // Gold color
                .setTitle(`🏆 Coin Flip Leaderboard - ${message.guild.name}`)
                .setTimestamp();

            let description = '';
            for (let i = 0; i < topUsers.length; i++) {
                const dbUser = topUsers[i];
                // Fetch the Discord user to get their current username
                const discordUser = await client.users.fetch(dbUser.userId).catch(() => null);
                const username = discordUser ? discordUser.username : 'Unknown User';

                const stats = dbUser.gameStats.coinFlips;
                const winRate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : 0;
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;

                description += `${medal} **${username}**\n`;
                description += `> Wins: \`${stats.wins}\` | Losses: \`${stats.losses}\` | Win Rate: \`${winRate}%\`\n\n`;
            }

            leaderboardEmbed.setDescription(description);

            await message.reply({ embeds: [leaderboardEmbed] });

        } catch (error) {
            logger.error('Error executing leaderboard command:', error);
            message.reply('❌ An error occurred while fetching the leaderboard.');
        }
    }
}; 