const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const User = require('../../models/User');
const Guild = require('../../models/Guild');
const { hasModeratorPermissions, canModerateUser } = require('../../utils/permissions');
const { parseTime } = require('../../utils/helpers');
const logger = require('../../config/logger');

module.exports = {
    name: 'ban',
    description: 'Bans a user from the server, with an optional duration.',
    usage: '!ban <@user or userID> [duration] [reason]',
    cooldown: 5,
    permissions: [PermissionFlagsBits.BanMembers],
    guildOnly: true,
    async execute(message, args, client) {
        const guildSettings = await Guild.findOne({ guildId: message.guild.id });
        if (!guildSettings) return message.reply('❌ Server settings not found.');
        if (!hasModeratorPermissions(message.member, message.guild, guildSettings.moderation.moderatorRoleId)) {
            return message.reply('❌ You do not have the required permissions to use this command.');
        }

        if (!args.length) {
            return message.reply(`Please provide the user to ban. Usage: \`${this.usage}\``);
        }

        const targetId = args[0].replace(/[<@!>]/g, '');
        let targetUser;
        try {
            targetUser = await client.users.fetch(targetId);
        } catch (error) {
            return message.reply("❌ Invalid user ID or user not found.");
        }

        const targetMember = await message.guild.members.fetch(targetId).catch(() => null);

        if (targetMember) {
            const canModerate = canModerateUser(targetMember, message.member, message.guild);
            if (!canModerate.canModerate) {
                return message.reply(`❌ ${canModerate.reason}`);
            }
            if (!targetMember.bannable) {
                return message.reply("❌ I cannot ban this user. They may have a higher role than me or I lack permissions.");
            }
        }

        let durationArg = args[1];
        let reason;
        let durationMinutes = null;

        if (durationArg) {
            durationMinutes = parseTime(durationArg);
            if (durationMinutes) {
                reason = args.slice(2).join(' ') || 'No reason provided';
            } else {
                reason = args.slice(1).join(' ') || 'No reason provided';
            }
        } else {
            reason = 'No reason provided';
        }

        try {
            const dmEmbed = new EmbedBuilder()
                .setColor(0xDD2E44)
                .setTitle(`🚫 You have been banned from ${message.guild.name}`)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Banned by', value: message.author.tag }
                )
                .setTimestamp();

            if (durationMinutes) {
                dmEmbed.addFields({ name: 'Duration', value: `${durationMinutes} minutes` });
            }

            await targetUser.send({ embeds: [dmEmbed] }).catch(() => {
                logger.warn(`Could not DM user ${targetUser.tag}.`);
            });

            await message.guild.bans.create(targetUser.id, { reason });

            const dbUser = await User.findOrCreate(targetUser.id, message.guild.id, {
                username: targetUser.username,
                discriminator: targetUser.discriminator,
                avatar: targetUser.avatar
            });
            await dbUser.addBan(reason, message.author.id, message.author.username, durationMinutes);

            const banEmbed = new EmbedBuilder()
                .setColor(0xDD2E44)
                .setTitle('🚫 User Banned')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'Banned User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Moderator', value: `${message.author.tag} (${message.author.id})`, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            if (durationMinutes) {
                banEmbed.addFields({ name: 'Duration', value: `${durationMinutes} minutes`, inline: true });
            }

            await message.reply({ embeds: [banEmbed] });

            await logModerationAction(message.guild, {
                action: 'BAN',
                target: targetUser,
                moderator: message.author,
                reason: reason,
                duration: durationMinutes
            });

        } catch (error) {
            logger.error('Error executing ban command:', error);
            return message.reply('❌ An error occurred while banning the user.');
        }
    }
};

async function logModerationAction(guild, data) {
    try {
        const guildSettings = await Guild.findOne({ guildId: guild.id });
        if (!guildSettings?.moderation.logChannelId) return;

        const logChannel = guild.channels.cache.get(guildSettings.moderation.logChannelId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setColor(0xDD2E44)
            .setTitle('🛡️ Moderation Log: User Banned')
            .addFields(
                { name: 'User', value: `${data.target.tag} (${data.target.id})` },
                { name: 'Moderator', value: `${data.moderator.tag} (${data.moderator.id})` },
                { name: 'Reason', value: data.reason }
            )
            .setTimestamp();

        if (data.duration) {
            embed.addFields({ name: 'Duration', value: `${data.duration} minutes` });
        }

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        logger.error('Error logging moderation action:', error);
    }
} 