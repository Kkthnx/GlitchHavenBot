const { EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const Guild = require('../../models/Guild');

module.exports = {
    name: 'birthdays',
    aliases: ['bdayconfig', 'bday'],
    description: 'Configure the birthday announcement system.',
    usage: '!birthdays <enable|disable|channel|message> [#channel] [new message]',
    category: 'Admin',
    guildOnly: true,
    cooldown: 5,
    permissions: [PermissionsBitField.Flags.ManageGuild],

    async execute(message, args, client) {
        const [subcommand, ...rest] = args;

        if (!subcommand) {
            return message.reply('Please specify a subcommand: `enable`, `disable`, `channel`, or `message`.');
        }

        const guildData = await Guild.findOne({ guildId: message.guild.id });

        switch (subcommand.toLowerCase()) {
            case 'enable':
                guildData.birthdays.enabled = true;
                await guildData.save();
                message.reply('✅ Birthday announcements have been **enabled**.');
                break;
            case 'disable':
                guildData.birthdays.enabled = false;
                await guildData.save();
                message.reply('❌ Birthday announcements have been **disabled**.');
                break;
            case 'channel':
                const channel = message.mentions.channels.first() || message.guild.channels.cache.get(rest[0]);
                if (!channel || channel.type !== ChannelType.GuildText) {
                    return message.reply('Please provide a valid text channel.');
                }
                guildData.birthdays.channelId = channel.id;
                await guildData.save();
                message.reply(`✅ Birthday announcements will now be sent to ${channel}.`);
                break;
            case 'message':
                const newMessage = rest.join(' ');
                if (!newMessage) {
                    return message.reply('Please provide a new birthday message. Use `{user}` to mention the user.');
                }
                guildData.birthdays.message = newMessage;
                await guildData.save();
                message.reply(`✅ Birthday message updated to: \`${newMessage}\``);
                break;
            default:
                message.reply('Invalid subcommand. Use `enable`, `disable`, `channel`, or `message`.');
        }
    }
}; 