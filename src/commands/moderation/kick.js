const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const User = require('../../models/User');
const Guild = require('../../models/Guild');
const { hasModeratorPermissions, canModerateUser } = require('../../utils/permissions');
const logger = require('../../config/logger');

module.exports = {
    name: 'kick',
    description: 'Kicks a user from the server.',
    usage: '!kick <@user> [reason]',
    cooldown: 5,
    permissions: [PermissionFlagsBits.KickMembers],
    guildOnly: true,
    async execute(message, args, client) {
        // Check for moderator permissions from database
        const guildSettings = await Guild.findOne({ guildId: message.guild.id });
        if (!guildSettings) return message.reply('❌ Server settings not found.');
        if (!hasModeratorPermissions(message.member, message.guild, guildSettings.moderation.moderatorRoleId)) {
            return message.reply('❌ You do not have the required permissions to use this command.');
        }

        if (!args.length) {
            return message.reply(`Please mention the user to kick. Usage: \`${this.usage}\``);
        }

        const targetUser = message.mentions.users.first();
        if (!targetUser) {
            return message.reply('❌ You need to mention a valid user to kick.');
        }

        const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            return message.reply("❌ That user isn't in this server.");
        }

        // Permission checks
        const canModerate = canModerateUser(targetMember, message.member, message.guild);
        if (!canModerate.canModerate) {
            return message.reply(`❌ ${canModerate.reason}`);
        }

        if (!targetMember.kickable) {
            return message.reply("❌ I cannot kick this user. They may have a higher role than me or I lack permissions.");
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        try {
            // Send DM to the user being kicked
            const dmEmbed = new EmbedBuilder()
                .setColor(0xFF470F)
                .setTitle(`👢 You have been kicked from ${message.guild.name}`)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Kicked by', value: message.author.tag }
                )
                .setTimestamp();

            await targetUser.send({ embeds: [dmEmbed] }).catch(() => {
                logger.warn(`Could not DM user ${targetUser.tag}.`);
            });

            // Kick the user
            await targetMember.kick(reason);

            // Record in our database
            const dbUser = await User.findOrCreate(targetUser.id, message.guild.id, {
                username: targetUser.username,
                discriminator: targetUser.discriminator,
                avatar: targetUser.avatar
            });
            await dbUser.addKick(reason, message.author.id, message.author.username);

            // Send confirmation message
            const kickEmbed = new EmbedBuilder()
                .setColor(0xFF470F)
                .setTitle('👢 User Kicked')
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'Kicked User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Moderator', value: `${message.author.tag} (${message.author.id})`, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            await message.reply({ embeds: [kickEmbed] });

            // Log the action
            await logModerationAction(message.guild, {
                action: 'KICK',
                target: targetUser,
                moderator: message.author,
                reason: reason
            });

        } catch (error) {
            logger.error('Error executing kick command:', error);
            return message.reply('❌ An error occurred while kicking the user.');
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
            .setColor(0xFF470F)
            .setTitle('🛡️ Moderation Log: User Kicked')
            .addFields(
                { name: 'User', value: `${data.target.tag} (${data.target.id})` },
                { name: 'Moderator', value: `${data.moderator.tag} (${data.moderator.id})` },
                { name: 'Reason', value: data.reason }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        logger.error('Error logging moderation action:', error);
    }
} 