const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const { formatRelativeTime, formatAbsoluteTime } = require('../../utils/helpers');
const logger = require('../../config/logger');

module.exports = {
    name: 'userinfo',
    aliases: ['whois', 'user', 'ui'],
    description: 'Displays detailed information about a user.',
    usage: '!userinfo [@user or userID]',
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

                // Get reputation rank
                const repRank = await dbUser.getReputationRank();

                infoEmbed.addFields(
                    { name: 'Moderation History', value: `**Warnings:** ${warnings}\n**Mutes:** ${mutes}`, inline: true },
                    { name: 'Last Seen', value: formatRelativeTime(dbUser.lastSeen), inline: true },
                    { name: 'Reputation', value: `**Score:** ${dbUser.reputation.score}\n**Rank:** #${repRank}\n**Endorsements:** ${dbUser.reputation.totalEndorsements}`, inline: true }
                );

                // Add reputation badges
                const badges = [];
                if (dbUser.reputation.score >= 50) badges.push('🏆 Legend');
                else if (dbUser.reputation.score >= 25) badges.push('⭐ Elite');
                else if (dbUser.reputation.score >= 10) badges.push('🌟 Trusted');
                else if (dbUser.reputation.score >= 5) badges.push('👍 Reliable');
                else if (dbUser.reputation.score >= 1) badges.push('👋 New');

                if (badges.length > 0) {
                    infoEmbed.addFields({ name: '🎖️ Reputation Badges', value: badges.join(' • '), inline: false });
                }

                // Add recent endorsements if any
                if (dbUser.reputation.endorsements.length > 0) {
                    const recentEndorsements = dbUser.reputation.endorsements
                        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                        .slice(0, 3);

                    let endorsementsText = '';
                    for (const endorsement of recentEndorsements) {
                        const date = new Date(endorsement.timestamp).toLocaleDateString();
                        endorsementsText += `• **${endorsement.fromUsername}** (${date})\n`;
                    }

                    if (dbUser.reputation.endorsements.length > 3) {
                        endorsementsText += `*... and ${dbUser.reputation.endorsements.length - 3} more*`;
                    }

                    infoEmbed.addFields({ name: '💬 Recent Endorsements', value: endorsementsText, inline: false });
                }
            } else {
                // If no database user, show basic reputation info
                infoEmbed.addFields({ name: 'Reputation', value: '**Score:** 0\n**Rank:** N/A\n**Endorsements:** 0', inline: true });
            }

            // Add status information
            const statusMap = {
                online: '🟢 Online',
                idle: '🌙 Idle',
                dnd: '⛔ Do Not Disturb',
                offline: '⚫ Offline'
            };

            // Determine accurate status without presence intent
            let status = '⚫ Offline';
            let statusDescription = '';

            // Check if user is in the guild cache (indicates they're connected)
            const isInCache = member.guild.members.cache.has(member.id);

            // If user has been active recently (within last 5 minutes), show as recently active
            if (dbUser && dbUser.lastSeen) {
                const timeSinceLastSeen = Date.now() - new Date(dbUser.lastSeen).getTime();
                const fiveMinutes = 5 * 60 * 1000;
                const oneHour = 60 * 60 * 1000;

                if (timeSinceLastSeen < fiveMinutes) {
                    status = '🟢 Recently Active';
                    statusDescription = ` (last seen ${formatRelativeTime(dbUser.lastSeen)})`;
                } else if (timeSinceLastSeen < oneHour) {
                    status = '🟡 Recently Online';
                    statusDescription = ` (last seen ${formatRelativeTime(dbUser.lastSeen)})`;
                } else {
                    status = '⚫ Offline';
                    statusDescription = ` (last seen ${formatRelativeTime(dbUser.lastSeen)})`;
                }
            } else {
                // If no last seen data, check if they're in cache
                if (isInCache) {
                    status = '🟡 Online (No Activity)';
                    statusDescription = ' (no recent activity tracked)';
                } else {
                    status = '⚫ Offline';
                    statusDescription = ' (no activity data)';
                }
            }

            infoEmbed.addFields(
                { name: 'Status', value: status + statusDescription, inline: true }
            );

            await message.reply({ embeds: [infoEmbed] });

        } catch (error) {
            logger.error('Error executing userinfo command:', error);
            return message.reply('❌ An error occurred while fetching user information.');
        }
    }
}; 