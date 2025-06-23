const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const { formatRelativeTime, formatAbsoluteTime } = require('../../utils/helpers');
const logger = require('../../config/logger');

module.exports = {
    name: 'userinfo',
    aliases: ['whois', 'user', 'ui'],
    description: 'Displays detailed information about a user.',
    usage: 'userinfo [@user or userID]',
    cooldown: 5,
    guildOnly: true,
    async execute(message, args, client) {
        try {
            let member;
            if (args.length > 0) {
                const userId = args[0].replace(/[<@!>]/g, '');
                member = await message.guild.members.fetch(userId).catch(() => null);
                if (!member) {
                    return message.reply("❌ I couldn't find that user in this server.");
                }
            } else {
                member = message.member;
            }

            const user = member.user;

            // Fetch user data from our database
            const dbUser = await User.findOne({ userId: user.id, guildId: message.guild.id });

            // Get user roles
            const roles = member.roles.cache
                .sort((a, b) => b.position - a.position)
                .map(role => role.toString())
                .slice(0, -1); // Exclude @everyone
            const rolesDisplay = roles.length > 0 ? roles.join(', ') : 'None';

            const infoEmbed = new EmbedBuilder()
                .setColor(member.displayHexColor === '#000000' ? '#99aab5' : member.displayHexColor)
                .setTitle(`👤 User Information: ${user.username}`)
                .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
                .addFields(
                    { name: 'Full Tag', value: `\`${user.tag}\``, inline: true },
                    { name: 'ID', value: `\`${user.id}\``, inline: true },
                    { name: 'Nickname', value: member.nickname || 'None', inline: true },

                    { name: 'Account Created', value: `${formatAbsoluteTime(user.createdAt)}\n(${formatRelativeTime(user.createdAt)})`, inline: true },
                    { name: 'Joined Server', value: `${formatAbsoluteTime(member.joinedAt)}\n(${formatRelativeTime(member.joinedAt)})`, inline: true },
                    { name: 'Booster', value: member.premiumSince ? `Since ${formatRelativeTime(member.premiumSince)}` : 'No', inline: true },

                    { name: `Roles [${roles.length}]`, value: roles.length > 10 ? `${roles.slice(0, 10).join(', ')}...` : rolesDisplay }
                )
                .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                .setTimestamp();

            // Add bot-specific information if available
            if (dbUser) {
                const warnings = dbUser.moderation.warnings.filter(w => w.active).length;
                const mutes = dbUser.moderation.mutes.filter(m => m.active).length;
                infoEmbed.addFields(
                    { name: 'Moderation History', value: `**Warnings:** ${warnings}\n**Mutes:** ${mutes}`, inline: true },
                    { name: 'Last Seen', value: formatRelativeTime(dbUser.lastSeen), inline: true }
                );
            }

            // Add status information
            const statusMap = {
                online: '🟢 Online',
                idle: '🌙 Idle',
                dnd: '⛔ Do Not Disturb',
                offline: '⚫ Offline'
            };

            const memberStatus = member.presence?.status || 'offline';
            infoEmbed.addFields(
                { name: 'Status', value: statusMap[memberStatus], inline: true }
            );


            await message.reply({ embeds: [infoEmbed] });

        } catch (error) {
            logger.error('Error executing userinfo command:', error);
            return message.reply('❌ An error occurred while fetching user information.');
        }
    }
}; 