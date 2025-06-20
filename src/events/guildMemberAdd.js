const logger = require('../config/logger');
const User = require('../models/User');
const Guild = require('../models/Guild');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        try {
            // Create or update user in database
            await User.findOrCreate(member.user.id, member.guild.id, {
                username: member.user.username,
                discriminator: member.user.discriminator,
                avatar: member.user.avatar
            });

            // Get guild settings
            const guild = await Guild.findOne({ guildId: member.guild.id });
            if (!guild) return;

            // Handle welcome message
            if (guild.welcome.enabled) {
                await handleWelcome(member, guild, client);
            }

            // Handle auto-role assignment
            if (guild.autoRoles.length > 0) {
                await handleAutoRoles(member, guild);
            }

            logger.info(`New member joined: ${member.user.tag} in ${member.guild.name}`);

        } catch (error) {
            logger.error('Error in guildMemberAdd event:', error);
        }
    }
};

async function handleWelcome(member, guild, client) {
    try {
        const welcomeChannel = guild.welcome.channelId ?
            member.guild.channels.cache.get(guild.welcome.channelId) :
            member.guild.systemChannel;

        if (!welcomeChannel) return;

        // Create welcome message
        let welcomeMessage = guild.welcome.message
            .replace('{user}', member.user.toString())
            .replace('{server}', member.guild.name)
            .replace('{memberCount}', member.guild.memberCount)
            .replace('{username}', member.user.username);

        // Create welcome embed
        const welcomeEmbed = {
            color: 0x00FF00,
            title: '🎉 Welcome to the server!',
            description: welcomeMessage,
            thumbnail: {
                url: member.user.displayAvatarURL({ dynamic: true, size: 256 })
            },
            fields: [
                {
                    name: '👤 Member Info',
                    value: `**Username:** ${member.user.username}\n**Joined:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>\n**Member #${member.guild.memberCount}**`,
                    inline: true
                },
                {
                    name: '📋 Server Info',
                    value: `**Server:** ${member.guild.name}\n**Owner:** ${member.guild.owner?.user.tag || 'Unknown'}\n**Created:** <t:${Math.floor(member.guild.createdTimestamp / 1000)}:R>`,
                    inline: true
                }
            ],
            footer: {
                text: `Welcome to ${member.guild.name}!`
            },
            timestamp: new Date()
        };

        // Send welcome message
        await welcomeChannel.send({ embeds: [welcomeEmbed] });

        // Send DM welcome message if configured
        if (guild.welcome.dmMessage) {
            const dmMessage = guild.welcome.dmMessage
                .replace('{user}', member.user.username)
                .replace('{server}', member.guild.name);

            try {
                await member.user.send({
                    embeds: [{
                        color: 0x00FF00,
                        title: `Welcome to ${member.guild.name}!`,
                        description: dmMessage,
                        footer: { text: 'Thanks for joining us!' }
                    }]
                });
            } catch (error) {
                logger.warn(`Could not send DM to ${member.user.tag}:`, error.message);
            }
        }

    } catch (error) {
        logger.error('Error handling welcome:', error);
    }
}

async function handleAutoRoles(member, guild) {
    try {
        const rolesToAdd = [];

        for (const autoRole of guild.autoRoles) {
            if (autoRole.enabled) {
                const role = member.guild.roles.cache.get(autoRole.roleId);
                if (role && !member.roles.cache.has(autoRole.roleId)) {
                    rolesToAdd.push(role);
                }
            }
        }

        if (rolesToAdd.length > 0) {
            await member.roles.add(rolesToAdd, 'Auto-role assignment');
            logger.info(`Assigned auto-roles to ${member.user.tag}: ${rolesToAdd.map(r => r.name).join(', ')}`);
        }

    } catch (error) {
        logger.error('Error assigning auto-roles:', error);
    }
} 