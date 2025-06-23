const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const logger = require('../../config/logger');

module.exports = {
    name: 'stats',
    aliases: ['gamestats', 'mystats'],
    description: 'Displays comprehensive game statistics for yourself or another user.',
    usage: 'stats [@user]',
    cooldown: 10,
    guildOnly: true,
    async execute(message, args, client) {
        try {
            const targetUser = message.mentions.users.first() || message.author;

            const dbUser = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });

            if (!dbUser) {
                const isSelf = targetUser.id === message.author.id;
                return message.reply(isSelf ? "You haven't played any games yet! Use `!flip` or `!rps` to start." : "This user hasn't played any games yet.");
            }

            const coinStats = dbUser.gameStats.coinFlips;
            const rpsStats = dbUser.gameStats.rps;
            const levelStats = dbUser.leveling;

            const coinWinRate = coinStats.total > 0 ? ((coinStats.wins / coinStats.total) * 100).toFixed(1) : 0;
            const rpsWinRate = rpsStats.total > 0 ? ((rpsStats.wins / rpsStats.total) * 100).toFixed(1) : 0;

            const statsEmbed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(`📊 Game Statistics for ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    {
                        name: '🎮 Coin Flips',
                        value: coinStats.total > 0 ?
                            `Total: \`${coinStats.total}\` | Wins: \`${coinStats.wins}\` | Losses: \`${coinStats.losses}\`\nWin Rate: \`${coinWinRate}%\` | Current Streak: \`${coinStats.streak}\` | Best Streak: \`${coinStats.bestStreak}\`` :
                            'No games played yet',
                        inline: false
                    },
                    {
                        name: '✂️ Rock Paper Scissors',
                        value: rpsStats.total > 0 ?
                            `Total: \`${rpsStats.total}\` | Wins: \`${rpsStats.wins}\` | Losses: \`${rpsStats.losses}\` | Ties: \`${rpsStats.ties}\`\nWin Rate: \`${rpsWinRate}%\` | Best Streak: \`${rpsStats.bestStreak || 0}\`` :
                            'No games played yet',
                        inline: false
                    },
                    {
                        name: '📈 Leveling',
                        value: `Level: \`${levelStats.level}\` | XP: \`${levelStats.xp}\` | Total XP: \`${levelStats.totalXp.toLocaleString()}\``,
                        inline: false
                    }
                )
                .setFooter({ text: `Requested by ${message.author.tag}` })
                .setTimestamp();

            await message.reply({ embeds: [statsEmbed] });

        } catch (error) {
            logger.error("Error executing stats command:", error);
            return message.reply('❌ An error occurred while fetching statistics.');
        }
    }
}; 