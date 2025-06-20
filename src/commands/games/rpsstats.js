const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    name: 'rpsstats',
    aliases: ['rps-stats', 'rockpaperscissorsstats'],
    description: 'View Rock, Paper, Scissors statistics for yourself or another user',
    usage: 'rpsstats [@user]',
    category: 'Games',
    cooldown: 5,
    async execute(message, args, client) {
        const targetUser = message.mentions.users.first() || message.author;
        const userData = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });

        if (!userData || !userData.gameStats.rps || userData.gameStats.rps.total === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x808080)
                .setTitle('🎮 RPS Statistics')
                .setDescription(`${targetUser} hasn't played any Rock, Paper, Scissors games yet!`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        const stats = userData.gameStats.rps;
        const winRate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : 0;

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🎮 Rock, Paper, Scissors Statistics')
            .setDescription(`Statistics for ${targetUser}`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'Total Games', value: stats.total.toString(), inline: true },
                { name: 'Wins', value: stats.wins.toString(), inline: true },
                { name: 'Losses', value: stats.losses.toString(), inline: true },
                { name: 'Ties', value: stats.ties.toString(), inline: true },
                { name: 'Win Rate', value: `${winRate}%`, inline: true },
                { name: 'Best Streak', value: stats.bestStreak ? stats.bestStreak.toString() : '0', inline: true }
            )
            .setTimestamp();

        message.reply({ embeds: [embed] });
    }
}; 