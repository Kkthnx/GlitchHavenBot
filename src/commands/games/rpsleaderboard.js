const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    name: 'rpsleaderboard',
    aliases: ['rps-lb', 'rpsboard', 'rockpaperscissorsleaderboard'],
    description: 'View the Rock, Paper, Scissors leaderboard',
    usage: 'rpsleaderboard',
    category: 'Games',
    cooldown: 10,
    async execute(message, args, client) {
        const users = await User.find({
            guildId: message.guild.id,
            'gameStats.rps.total': { $gt: 0 }
        })
            .sort({ 'gameStats.rps.wins': -1, 'gameStats.rps.total': -1 })
            .limit(10);

        if (users.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(0x808080)
                .setTitle('🎮 RPS Leaderboard')
                .setDescription('No one has played Rock, Paper, Scissors yet!')
                .setTimestamp();

            return message.reply({ embeds: [embed] });
        }

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🎮 Rock, Paper, Scissors Leaderboard')
            .setDescription('Top players ranked by wins')
            .setThumbnail(message.guild.iconURL({ dynamic: true }))
            .setTimestamp();

        let description = '';
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const stats = user.gameStats.rps;
            const winRate = ((stats.wins / stats.total) * 100).toFixed(1);
            const member = message.guild.members.cache.get(user.userId);
            const username = member ? member.displayName : user.username;

            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            description += `${medal} **${username}** - ${stats.wins} wins (${winRate}% win rate)\n`;
        }

        embed.setDescription(description);

        message.reply({ embeds: [embed] });
    }
}; 