const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const logger = require('../../utils/logger');

module.exports = {
    name: 'stats',
    aliases: ['rank', 'gamestats'],
    description: 'Displays your game statistics for the server.',
    usage: 'stats [@user]',
    cooldown: 10,
    guildOnly: true,
    async execute(message, args, client) {
        try {
            const targetUser = message.mentions.users.first() || message.author;

            const dbUser = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });

            if (!dbUser || !dbUser.gameStats || dbUser.gameStats.coinFlips.total === 0) {
                const isSelf = targetUser.id === message.author.id;
                return message.reply(isSelf ? "You haven't played any games yet! Use `!flip` to start." : "This user hasn't played any games yet.");
            }

            const stats = dbUser.gameStats.coinFlips;
            const winRate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : 0;

            const statsEmbed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(`📊 Game Statistics for ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: 'Game', value: 'Coin Flips', inline: false },
                    { name: 'Total Flips', value: `\`${stats.total}\``, inline: true },
                    { name: 'Wins', value: `\`${stats.wins}\``, inline: true },
                    { name: 'Losses', value: `\`${stats.losses}\``, inline: true },
                    { name: 'Win Rate', value: `\`${winRate}%\``, inline: true },
                    { name: 'Current Streak', value: `\`${stats.streak}\``, inline: true },
                    { name: 'Best Streak', value: `\`${stats.bestStreak}\``, inline: true }
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