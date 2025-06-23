const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    // Legacy command format for compatibility
    name: 'repleaderboard',
    aliases: ['replb', 'reptop'],
    description: 'Show the reputation leaderboard',
    usage: '!repleaderboard [limit]',
    cooldown: 10,
    guildOnly: true,

    // Slash command data
    data: new SlashCommandBuilder()
        .setName('repleaderboard')
        .setDescription('Show the reputation leaderboard')
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Number of users to show (1-25)')
                .setMinValue(1)
                .setMaxValue(25)
                .setRequired(false)),

    async execute(interaction, args, client) {
        // Handle both slash commands and prefix commands
        const isSlashCommand = interaction.options !== undefined;

        // Only defer for slash commands
        if (isSlashCommand) {
            await interaction.deferReply();
        }

        try {
            let limit = 10;

            if (isSlashCommand) {
                // Slash command handling
                limit = interaction.options.getInteger('limit') || 10;
            } else {
                // Prefix command handling
                if (args && args.length > 0) {
                    const parsedLimit = parseInt(args[0]);
                    if (!isNaN(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 25) {
                        limit = parsedLimit;
                    }
                }
            }

            const guildId = isSlashCommand ? interaction.guildId : interaction.guild.id;
            const leaderboard = await User.getReputationLeaderboard(guildId, limit);

            if (leaderboard.length === 0) {
                const noDataEmbed = new EmbedBuilder()
                    .setColor('#ff8800')
                    .setTitle('📊 Reputation Leaderboard')
                    .setDescription('No reputation data found for this server yet.\nStart giving reputation with `!rep`!')
                    .setFooter({ text: 'Reputation System' });

                return isSlashCommand ?
                    interaction.editReply({ embeds: [noDataEmbed] }) :
                    interaction.reply({ embeds: [noDataEmbed] });
            }

            const embed = new EmbedBuilder()
                .setColor('#7289da')
                .setTitle('🏆 Reputation Leaderboard')
                .setDescription(`Top ${leaderboard.length} most trusted members`)
                .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: `Reputation System • ${interaction.guild.name}` });

            let description = '';
            for (let i = 0; i < leaderboard.length; i++) {
                const user = leaderboard[i];
                const rank = i + 1;

                // Get user from Discord cache or mention them
                const discordUser = interaction.client.users.cache.get(user.userId);
                const displayName = discordUser ? discordUser.username : user.username;

                // Rank emoji
                let rankEmoji = '🔹';
                if (rank === 1) rankEmoji = '🥇';
                else if (rank === 2) rankEmoji = '🥈';
                else if (rank === 3) rankEmoji = '🥉';
                else if (rank <= 10) rankEmoji = '🔸';

                // Reputation badges
                let badge = '';
                if (user.reputation.score >= 50) badge = ' 🏆';
                else if (user.reputation.score >= 25) badge = ' ⭐';
                else if (user.reputation.score >= 10) badge = ' 🌟';
                else if (user.reputation.score >= 5) badge = ' 👍';

                description += `${rankEmoji} **${rank}.** ${displayName}${badge}\n`;
                description += `   Rep: **${user.reputation.score}** • Endorsements: **${user.reputation.totalEndorsements}**\n\n`;
            }

            embed.setDescription(description);

            // Add stats at the bottom
            const totalUsers = await User.countDocuments({ guildId: guildId });
            const usersWithRep = await User.countDocuments({
                guildId: guildId,
                'reputation.score': { $gt: 0 }
            });

            embed.addFields({
                name: '📈 Server Stats',
                value: `Total Members: **${totalUsers}**\nMembers with Rep: **${usersWithRep}**\nReputation Given: **${leaderboard.reduce((sum, user) => sum + user.reputation.totalEndorsements, 0)}**`,
                inline: false
            });

            return isSlashCommand ?
                interaction.editReply({ embeds: [embed] }) :
                interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in repleaderboard command:', error);
            return isSlashCommand ?
                interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#ff4444')
                            .setTitle('❌ Error')
                            .setDescription('An error occurred while fetching the reputation leaderboard.')
                            .setFooter({ text: 'Reputation System' })
                    ]
                }) :
                interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#ff4444')
                            .setTitle('❌ Error')
                            .setDescription('An error occurred while fetching the reputation leaderboard.')
                            .setFooter({ text: 'Reputation System' })
                    ]
                });
        }
    },
}; 