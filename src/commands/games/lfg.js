const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const LFG = require('../../models/LFG');
const logger = require('../../config/logger');

module.exports = {
    name: 'lfg',
    aliases: ['lookingforgroup'],
    description: 'Create a Looking-For-Group post to find teammates.',
    usage: '!lfg <slots> <game> <description>',
    cooldown: 10, // Reduced from 60 to 10 seconds
    guildOnly: true,
    async execute(message, args, client) {
        if (args.length < 3) {
            return message.reply(`❌ **Incorrect Usage!**\nPlease use the format: \`${client.config.prefix}lfg <slots> <game> <description>\`\n*Example: \`${client.config.prefix}lfg 3 Valorant Chill ranked, need players with mics\`*`);
        }

        const slots = parseInt(args[0]);
        if (isNaN(slots) || slots <= 0 || slots > 20) {
            return message.reply('❌ Please provide a valid number of slots (1-20).');
        }

        const game = args[1];
        const description = args.slice(2).join(' ');

        if (description.length > 256) {
            return message.reply('❌ The description cannot be longer than 256 characters.');
        }

        const creator = message.author;

        // Build the LFG Embed
        const lfgEmbed = new EmbedBuilder()
            .setColor(0x5865F2) // Discord Blurple
            .setTitle(`🎮 Looking for Group: ${game}`)
            .setDescription(description)
            .setAuthor({ name: `Hosted by ${creator.username}`, iconURL: creator.displayAvatarURL({ dynamic: true }) })
            .addFields(
                { name: 'Slots Available', value: `**${slots}**`, inline: true },
                { name: 'Players Joined', value: 'None yet!', inline: true }
            )
            .setFooter({ text: 'Use the Close button when you\'re done or have enough players.' })
            .setTimestamp();

        // Build the Interactive Buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('lfg-join')
                    .setLabel('Join')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId('lfg-leave')
                    .setLabel('Leave')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌'),
                new ButtonBuilder()
                    .setCustomId('lfg-close')
                    .setLabel('Close')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔒')
            );

        try {
            const lfgMessage = await message.channel.send({ embeds: [lfgEmbed], components: [row] });

            // Save the LFG session to the database
            const lfgSession = new LFG({
                guildId: message.guild.id,
                channelId: message.channel.id,
                messageId: lfgMessage.id,
                creatorId: creator.id,
                game: game,
                description: description,
                slots: slots,
                players: []
            });

            await lfgSession.save();

            // Delete the original command message to keep the channel clean
            await message.delete().catch(() => { });

        } catch (error) {
            logger.error("Error creating LFG post:", error);
            return message.reply('❌ An error occurred while creating the LFG post.');
        }
    }
}; 