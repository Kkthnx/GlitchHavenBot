const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    name: 'rep',
    aliases: ['reputation'],
    description: 'Give reputation to another user',
    usage: '!rep <@user> [reason]',
    cooldown: 5,
    guildOnly: true,

    async execute(interaction, args, client) {
        try {
            if (!args || args.length === 0) {
                return interaction.reply('❌ Please specify a user to give reputation to. Usage: `!rep @user [message]`');
            }

            const userId = args[0].replace(/[<@!>]/g, '');
            const targetUser = await client.users.fetch(userId).catch(() => null);

            if (!targetUser) {
                return interaction.reply('❌ I couldn\'t find that user.');
            }

            const message = args.slice(1).join(' ').substring(0, 100); // Limit to 100 chars
            const giver = interaction.author;

            // Prevent self-endorsement
            if (targetUser.id === giver.id) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff4444')
                    .setTitle('❌ Cannot Endorse Yourself')
                    .setDescription('You cannot give reputation to yourself!')
                    .setFooter({ text: 'Reputation System' });

                return interaction.reply({ embeds: [errorEmbed] });
            }

            // Get or create both users
            const guildId = interaction.guild.id;
            const [giverData, targetData] = await Promise.all([
                User.findOrCreate(giver.id, guildId, {
                    username: giver.username,
                    discriminator: giver.discriminator || '0',
                    avatar: giver.avatar
                }),
                User.findOrCreate(targetUser.id, guildId, {
                    username: targetUser.username,
                    discriminator: targetUser.discriminator || '0',
                    avatar: targetUser.avatar
                })
            ]);

            // Check if giver can give rep today
            if (!giverData.canGiveRep()) {
                const now = new Date();
                const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                const timeUntilReset = tomorrow - now;
                const hoursUntilReset = Math.ceil(timeUntilReset / (1000 * 60 * 60));

                const limitEmbed = new EmbedBuilder()
                    .setColor('#ff8800')
                    .setTitle('⏰ Daily Limit Reached')
                    .setDescription(`You've already given 3 reputation points today.\nYou can give more reputation in **${hoursUntilReset} hours**.`)
                    .setFooter({ text: 'Reputation System • Daily Limit: 3 reps' });

                return interaction.reply({ embeds: [limitEmbed] });
            }

            // Try to add the endorsement
            try {
                await targetData.addEndorsement(giver.id, giver.username, message);
                await giverData.recordRepGiven();

                // Get updated reputation rank
                const newRank = await targetData.getReputationRank();

                const embed = new EmbedBuilder()
                    .setColor('#00ff88')
                    .setTitle('⭐ Reputation Given!')
                    .setDescription(`**${giver.username}** has endorsed **${targetUser.username}**!`)
                    .addFields(
                        { name: 'New Reputation Score', value: `${targetData.reputation.score}`, inline: true },
                        { name: 'Total Endorsements', value: `${targetData.reputation.totalEndorsements}`, inline: true },
                        { name: 'Server Rank', value: `#${newRank}`, inline: true }
                    )
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .setTimestamp()
                    .setFooter({ text: `Reputation System • ${giverData.reputation.repGivenToday}/3 used today` });

                if (message) {
                    embed.addFields({ name: 'Message', value: `"${message}"`, inline: false });
                }

                // Add reputation badges based on score
                const badges = [];
                if (targetData.reputation.score >= 50) badges.push('🏆 Legend');
                else if (targetData.reputation.score >= 25) badges.push('⭐ Elite');
                else if (targetData.reputation.score >= 10) badges.push('🌟 Trusted');
                else if (targetData.reputation.score >= 5) badges.push('👍 Reliable');

                if (badges.length > 0) {
                    embed.addFields({ name: 'Badges', value: badges.join(' • '), inline: false });
                }

                return interaction.reply({ embeds: [embed] });

            } catch (error) {
                if (error.message === 'You have already endorsed this user') {
                    const alreadyEmbed = new EmbedBuilder()
                        .setColor('#ff8800')
                        .setTitle('⚠️ Already Endorsed')
                        .setDescription(`You have already given reputation to **${targetUser.username}**.\nYou can only endorse each user once!`)
                        .setFooter({ text: 'Reputation System' });

                    return interaction.reply({ embeds: [alreadyEmbed] });
                }
                throw error;
            }

        } catch (error) {
            console.error('Error in rep command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff4444')
                .setTitle('❌ Error')
                .setDescription('An error occurred while processing your reputation request.')
                .setFooter({ text: 'Reputation System' });

            return interaction.reply({ embeds: [errorEmbed] });
        }
    },
}; 