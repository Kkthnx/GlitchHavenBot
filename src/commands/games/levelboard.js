const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const logger = require('../../config/logger');

module.exports = {
    name: 'levelboard',
    aliases: ['lbtop', 'xptop', 'leveltop'],
    description: 'Displays the server\'s level leaderboard.',
    usage: 'levelboard',
    cooldown: 30,
    guildOnly: true,
    async execute(message, args, client) {
        try {
            // Find top 10 users, sorted by level and XP
            const topUsers = await User.find({
                guildId: message.guild.id,
                'leveling.level': { $gt: 0 } // Only include users with at least level 1
            })
                .sort({ 'leveling.level': -1, 'leveling.xp': -1 })
                .limit(10);

            if (topUsers.length === 0) {
                return message.reply("There's no one on the level leaderboard yet! Start chatting to gain XP and levels.");
            }

            const leaderboardEmbed = new EmbedBuilder()
                .setColor(0xE74C3C) // Red color
                .setTitle(`🏆 Level Leaderboard - ${message.guild.name}`)
                .setTimestamp();

            let description = '';
            for (let i = 0; i < topUsers.length; i++) {
                const dbUser = topUsers[i];
                // Fetch the Discord user to get their current username
                const discordUser = await client.users.fetch(dbUser.userId).catch(() => null);
                const username = discordUser ? discordUser.username : 'Unknown User';

                const leveling = dbUser.leveling;
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;

                description += `${medal} **${username}**\n`;
                description += `> Level: \`${leveling.level}\` | XP: \`${leveling.totalXp.toLocaleString()}\`\n\n`;
            }

            leaderboardEmbed.setDescription(description);

            await message.reply({ embeds: [leaderboardEmbed] });

        } catch (error) {
            logger.error('Error executing levelboard command:', error);
            message.reply('❌ An error occurred while fetching the level leaderboard.');
        }
    }
}; 