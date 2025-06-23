const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    // Legacy command format for compatibility
    name: 'reputation',
    aliases: ['repinfo', 'repstats'],
    description: 'View reputation information for a user',
    usage: '!reputation [@user]',
    cooldown: 5,
    guildOnly: true,

    // Slash command data
    data: new SlashCommandBuilder()
        .setName('reputation')
        .setDescription('View reputation information for a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to view reputation for')
                .setRequired(false)),

    async execute(interaction, args, client) {
        // Handle both slash commands and prefix commands
        const isSlashCommand = interaction.options !== undefined;

        // Only defer for slash commands
        if (isSlashCommand) {
            await interaction.deferReply();
        }

        try {
            let targetUser;

            if (isSlashCommand) {
                // Slash command handling
                targetUser = interaction.options.getUser('user') || interaction.user;
            } else {
                // Prefix command handling
                if (args && args.length > 0) {
                    const userId = args[0].replace(/[<@!>]/g, '');
                    targetUser = await client.users.fetch(userId).catch(() => null);

                    if (!targetUser) {
                        return interaction.reply('❌ I couldn\'t find that user.');
                    }
                } else {
                    targetUser = interaction.author;
                }
            }

            // Get user data
            const guildId = isSlashCommand ? interaction.guildId : interaction.guild.id;
            const userData = await User.findOrCreate(targetUser.id, guildId, {
                username: targetUser.username,
                discriminator: targetUser.discriminator || '0',
                avatar: targetUser.avatar
            });

            // Get reputation rank
            const rank = await userData.getReputationRank();

            const embed = new EmbedBuilder()
                .setColor('#7289da')
                .setTitle(`⭐ ${targetUser.username}'s Reputation`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: 'Reputation System' });

            // Main reputation stats
            embed.addFields(
                { name: '🏆 Reputation Score', value: `${userData.reputation.score}`, inline: true },
                { name: '📊 Total Endorsements', value: `${userData.reputation.totalEndorsements}`, inline: true },
                { name: '🥇 Server Rank', value: `#${rank}`, inline: true }
            );

            // Reputation badges
            const badges = [];
            if (userData.reputation.score >= 50) {
                badges.push('🏆 **Legend** - Elite status with 50+ reputation');
            } else if (userData.reputation.score >= 25) {
                badges.push('⭐ **Elite** - Highly trusted with 25+ reputation');
            } else if (userData.reputation.score >= 10) {
                badges.push('🌟 **Trusted** - Reliable member with 10+ reputation');
            } else if (userData.reputation.score >= 5) {
                badges.push('👍 **Reliable** - Good standing with 5+ reputation');
            } else if (userData.reputation.score >= 1) {
                badges.push('👋 **New** - Just getting started');
            } else {
                badges.push('🆕 **Fresh** - No reputation yet');
            }

            embed.addFields({
                name: '🎖️ Badges',
                value: badges.join('\n'),
                inline: false
            });

            // Recent endorsements (last 5)
            if (userData.reputation.endorsements.length > 0) {
                const recentEndorsements = userData.reputation.endorsements
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .slice(0, 5);

                let endorsementsText = '';
                for (const endorsement of recentEndorsements) {
                    const date = new Date(endorsement.timestamp).toLocaleDateString();
                    const message = endorsement.message ? ` - "${endorsement.message}"` : '';
                    endorsementsText += `• **${endorsement.fromUsername}** on ${date}${message}\n`;
                }

                if (userData.reputation.endorsements.length > 5) {
                    endorsementsText += `\n*... and ${userData.reputation.endorsements.length - 5} more endorsements*`;
                }

                embed.addFields({
                    name: '💬 Recent Endorsements',
                    value: endorsementsText,
                    inline: false
                });
            }

            // Progress to next badge
            if (userData.reputation.score < 50) {
                let nextBadge = '';
                let progress = 0;
                let target = 0;

                if (userData.reputation.score < 5) {
                    nextBadge = '👍 Reliable';
                    target = 5;
                    progress = (userData.reputation.score / 5) * 100;
                } else if (userData.reputation.score < 10) {
                    nextBadge = '🌟 Trusted';
                    target = 10;
                    progress = ((userData.reputation.score - 5) / 5) * 100;
                } else if (userData.reputation.score < 25) {
                    nextBadge = '⭐ Elite';
                    target = 25;
                    progress = ((userData.reputation.score - 10) / 15) * 100;
                } else if (userData.reputation.score < 50) {
                    nextBadge = '🏆 Legend';
                    target = 50;
                    progress = ((userData.reputation.score - 25) / 25) * 100;
                }

                if (nextBadge) {
                    const progressBar = createProgressBar(progress);
                    embed.addFields({
                        name: `🎯 Progress to ${nextBadge}`,
                        value: `${progressBar} ${userData.reputation.score}/${target} (${Math.round(progress)}%)`,
                        inline: false
                    });
                }
            }

            // Server comparison
            const totalUsers = await User.countDocuments({ guildId });
            const usersWithRep = await User.countDocuments({
                guildId,
                'reputation.score': { $gt: 0 }
            });

            const percentile = totalUsers > 0 ? Math.round(((totalUsers - rank + 1) / totalUsers) * 100) : 0;

            embed.addFields({
                name: '📈 Server Standing',
                value: `Top **${percentile}%** of ${totalUsers} members\n${usersWithRep} members have reputation`,
                inline: false
            });

            return isSlashCommand ?
                interaction.editReply({ embeds: [embed] }) :
                interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in reputation command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('❌ Error')
                .setDescription('An error occurred while fetching reputation information.')
                .setFooter({ text: 'Reputation System' });

            return isSlashCommand ?
                interaction.editReply({ embeds: [errorEmbed] }) :
                interaction.reply({ embeds: [errorEmbed] });
        }
    },
};

function createProgressBar(percentage) {
    const filled = Math.round((percentage / 100) * 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
} 