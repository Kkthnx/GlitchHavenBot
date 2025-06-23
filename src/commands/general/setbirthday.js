const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const logger = require('../../config/logger');

module.exports = {
    name: 'setbirthday',
    aliases: ['setbday', 'mybirthday'],
    description: 'Sets your birthday to be announced in the server.',
    usage: '!setbirthday <MM/DD>',
    cooldown: 10,
    guildOnly: true,
    async execute(message, args, client) {
        if (!args[0]) {
            return message.reply('Please provide your birthday in `MM/DD` format. For example: `!setbirthday 07/21`.');
        }

        const dateRegex = /^(0[1-9]|1[0-2])[\/-](0[1-9]|[12]\d|3[01])$/;
        const match = args[0].match(dateRegex);

        if (!match) {
            return message.reply('Invalid date format. Please use `MM/DD` (e.g., `07/21`).');
        }

        const month = parseInt(match[1]);
        const day = parseInt(match[2]);

        // A simple check for invalid dates like 02/30
        const date = new Date(2000, month - 1, day); // Use a non-leap year for validation
        if (date.getMonth() + 1 !== month || date.getDate() !== day) {
            return message.reply("That's not a real date! Please provide a valid date.");
        }

        try {
            const user = await User.findOrCreate(message.author.id, message.guild.id, {
                username: message.author.username,
                discriminator: message.author.discriminator,
                avatar: message.author.avatar
            });

            // Store the date with a placeholder year. We only care about month and day.
            user.birthday = new Date(Date.UTC(2000, month - 1, day));
            await user.save();

            const successEmbed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('🎂 Birthday Set!')
                .setDescription(`Your birthday has been successfully set to **${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}**.`)
                .setFooter({ text: 'We will celebrate with you!' });

            message.reply({ embeds: [successEmbed] });

        } catch (error) {
            logger.error("Error setting birthday:", error);
            return message.reply('❌ An error occurred while setting your birthday.');
        }
    }
}; 