const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    // Legacy command format for compatibility
    name: 'repgiven',
    aliases: ['repgiven', 'repout'],
    description: 'Show who a user has given reputation to',
    usage: '!repgiven [@user]',
    cooldown: 5,
    guildOnly: true,

    // Slash command data
    data: new SlashCommandBuilder()
        .setName('repgiven')
        .setDescription('Show who a user has given reputation to')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check (defaults to yourself)')
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

            // Find all users this person has endorsed
            const endorsedUsers = await User.find({
                guildId,
                'reputation.endorsements.fromUserId': targetUser.id
            }).sort({ 'reputation.endorsements.timestamp': -1 });

            if (endorsedUsers.length === 0) {
                const noDataEmbed = new EmbedBuilder()
                    .setColor('#ff8800')
                    .setTitle('📊 Reputation Given')
                    .setDescription(`${targetUser.username} hasn't given any reputation yet.`)
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .setFooter({ text: 'Reputation System' });

                return isSlashCommand ?
                    interaction.editReply({ embeds: [noDataEmbed] }) :
                    interaction.reply({ embeds: [noDataEmbed] });
            }

            const embed = new EmbedBuilder()
                .setColor('#7289da')
                .setTitle(`📊 Reputation Given by ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: `Reputation System • ${endorsedUsers.length} endorsements given` });

            let description = '';
            for (let i = 0; i < Math.min(endorsedUsers.length, 10); i++) {
                const endorsedUser = endorsedUsers[i];
                const endorsement = endorsedUser.reputation.endorsements.find(
                    end => end.fromUserId === targetUser.id
                );

                // Get user from Discord cache or use stored username
                const discordUser = interaction.client.users.cache.get(endorsedUser.userId);
                const displayName = discordUser ? discordUser.username : endorsedUser.username;

                const date = new Date(endorsement.timestamp).toLocaleDateString();
                const message = endorsement.message ? ` - "${endorsement.message}"` : '';

                description += `${i + 1}. **${displayName}** (${date})${message}\n`;
            }

            if (endorsedUsers.length > 10) {
                description += `\n*... and ${endorsedUsers.length - 10} more endorsements*`;
            }

            embed.setDescription(description);

            // Add stats
            const totalRepGiven = endorsedUsers.length;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const repGivenToday = endorsedUsers.filter(user => {
                const endorsement = user.reputation.endorsements.find(
                    end => end.fromUserId === targetUser.id
                );
                return new Date(endorsement.timestamp) >= today;
            }).length;

            embed.addFields({
                name: '📈 Stats',
                value: `Total Given: **${totalRepGiven}**\nGiven Today: **${repGivenToday}**\nDaily Limit: **${userData.reputation.repGivenToday}/3**`,
                inline: false
            });

            return isSlashCommand ?
                interaction.editReply({ embeds: [embed] }) :
                interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in repgiven command:', error);
            return isSlashCommand ?
                interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#ff4444')
                            .setTitle('❌ Error')
                            .setDescription('An error occurred while fetching reputation data.')
                            .setFooter({ text: 'Reputation System' })
                    ]
                }) :
                interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#ff4444')
                            .setTitle('❌ Error')
                            .setDescription('An error occurred while fetching reputation data.')
                            .setFooter({ text: 'Reputation System' })
                    ]
                });
        }
    },
}; 