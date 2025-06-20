const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    name: 'rps',
    aliases: ['rockpaperscissors'],
    description: 'Challenge someone to a game of Rock, Paper, Scissors!',
    usage: 'rps <@user>',
    category: 'Games',
    cooldown: 10,
    async execute(message, args, client) {
        // Check if a user was mentioned
        if (args.length === 0) {
            return message.reply('❌ Please mention a user to challenge! Usage: `!rps @user`');
        }

        const targetUser = message.mentions.users.first();
        if (!targetUser) {
            return message.reply('❌ Please mention a valid user to challenge!');
        }

        // Can't challenge yourself
        if (targetUser.id === message.author.id) {
            return message.reply('❌ You cannot challenge yourself!');
        }

        // Can't challenge bots
        if (targetUser.bot) {
            return message.reply('❌ You cannot challenge bots!');
        }

        // Create challenge embed
        const challengeEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🎮 Rock, Paper, Scissors Challenge!')
            .setDescription(`${message.author} has challenged ${targetUser} to a game of Rock, Paper, Scissors!`)
            .addFields(
                { name: 'Challenger', value: message.author.toString(), inline: true },
                { name: 'Opponent', value: targetUser.toString(), inline: true },
                { name: 'Status', value: '⏳ Waiting for response...', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Click Accept to join the game!' });

        // Create challenge buttons
        const challengeRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('rps_accept')
                    .setLabel('✅ Accept Challenge')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('rps_decline')
                    .setLabel('❌ Decline Challenge')
                    .setStyle(ButtonStyle.Danger)
            );

        const challengeMsg = await message.reply({
            embeds: [challengeEmbed],
            components: [challengeRow]
        });

        // Store challenge data
        const challengeData = {
            challenger: message.author.id,
            opponent: targetUser.id,
            messageId: challengeMsg.id,
            channelId: message.channel.id,
            status: 'pending',
            startTime: Date.now()
        };

        // Store in client for later access
        if (!client.rpsChallenges) client.rpsChallenges = new Map();
        client.rpsChallenges.set(challengeMsg.id, challengeData);

        // Set timeout to expire challenge after 30 seconds
        setTimeout(() => {
            if (client.rpsChallenges.has(challengeMsg.id)) {
                const data = client.rpsChallenges.get(challengeMsg.id);
                if (data.status === 'pending') {
                    const expiredEmbed = EmbedBuilder.from(challengeEmbed)
                        .setColor(0xFF0000)
                        .setDescription(`${message.author}'s challenge to ${targetUser} has expired!`)
                        .spliceFields(2, 1, { name: 'Status', value: '⏰ Challenge expired', inline: true });

                    challengeMsg.edit({
                        embeds: [expiredEmbed],
                        components: []
                    }).catch(() => { });
                    client.rpsChallenges.delete(challengeMsg.id);
                }
            }
        }, 30000);
    }
}; 