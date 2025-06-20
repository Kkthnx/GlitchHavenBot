const { Collection } = require('discord.js');
const logger = require('../config/logger');
const User = require('../models/User');
const Guild = require('../models/Guild');
const { hasModeratorPermissions, canModerateUser } = require('../utils/permissions');
const { containsProfanity } = require('../utils/helpers');

// Cooldown collection for XP (prevent spam)
const xpCooldowns = new Collection();
const guildCache = new Map();

async function getGuildSettings(guildId) {
    if (guildCache.has(guildId)) {
        return guildCache.get(guildId);
    }

    const guildSettings = await Guild.findOne({ guildId: guildId }).lean();
    if (guildSettings) {
        guildCache.set(guildId, guildSettings);
        // Cache for 5 minutes
        setTimeout(() => guildCache.delete(guildId), 5 * 60 * 1000);
    }
    return guildSettings;
}

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // Ignore bot messages and DMs
        if (message.author.bot || !message.guild) return;

        try {
            const [guildSettings, userData] = await Promise.all([
                getGuildSettings(message.guild.id),
                User.findOrCreate(message.author.id, message.guild.id, {
                    username: message.author.username,
                    discriminator: message.author.discriminator,
                    avatar: message.author.avatar
                })
            ]);

            if (!guildSettings) return;

            // Auto-moderation must be handled first
            if (guildSettings.moderation.autoMod.enabled) {
                const isActionTaken = await handleAutoModeration(message, guildSettings, userData, client);
                // If automod took action (e.g., deleted the message), stop further processing.
                if (isActionTaken) return;
            }

            // Command handler
            const prefix = guildSettings.prefix || client.config.prefix;
            if (message.content.startsWith(prefix)) {
                return await handleCommands(message, client, prefix);
            }

            // Award XP for regular messages
            await handleXp(message, userData, guildSettings);

        } catch (error) {
            logger.error('Error in messageCreate event:', error);
        }
    }
};

async function handleAutoModeration(message, guildSettings, userData, client) {
    const { autoMod } = guildSettings.moderation;

    if (autoMod.wordFilter && autoMod.bannedWords.length > 0) {
        if (containsProfanity(message.content, autoMod.bannedWords)) {
            await handleViolation(message, 'Inappropriate language', userData, client);
            return true; // Indicates an action was taken
        }
    }

    // Add other automod checks here like link filtering or spam detection
    // For now, we only have word filter.

    return false; // No action taken
}

async function handleViolation(message, reason, user, client) {
    try {
        await message.delete();

        if (user) {
            await user.addWarning(reason, client.user.id, client.user.tag);
        }

        const warningEmbed = {
            color: 0xFF0000,
            title: 'Auto-Moderation Action',
            description: `Your message was removed for the following reason: **${reason}**.`,
            footer: { text: 'Repeated violations may result in further action.' }
        };

        message.author.send({ embeds: [warningEmbed] }).catch(() => {
            message.channel.send(`${message.author}, your message was removed for violating our server rules.`).then(msg => {
                setTimeout(() => msg.delete(), 10000);
            });
        });

    } catch (error) {
        logger.error(`Error handling auto-mod violation for ${message.author.tag}:`, error);
    }
}

async function handleCommands(message, client, prefix) {
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName) ||
        client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if (!command) return;

    // Cooldown check
    const { cooldowns } = client;
    if (!cooldowns.has(command.name)) {
        cooldowns.set(command.name, new Collection());
    }
    const now = Date.now();
    const timestamps = cooldowns.get(command.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(message.author.id)) {
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return message.reply(`Please wait ${timeLeft.toFixed(1)} more second(s) before using the \`${command.name}\` command.`);
        }
    }
    timestamps.set(message.author.id, now);
    setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

    // Execute command
    try {
        await command.execute(message, args, client);
    } catch (error) {
        logger.error(`Error executing command ${command.name}:`, error);
        message.reply('There was an error executing that command!').catch(() => { });
    }
}

async function handleXp(message, user, guildSettings) {
    if (!guildSettings.leveling.enabled) return;

    const cooldownKey = `${message.author.id}-${message.guild.id}`;
    const cooldownTime = guildSettings.leveling.xpCooldown || 60000;

    if (xpCooldowns.has(cooldownKey) && Date.now() - xpCooldowns.get(cooldownKey) < cooldownTime) {
        return;
    }

    const xpToAward = Math.floor(Math.random() * 11) + 15;
    const result = await user.addXP(xpToAward, 'message');
    xpCooldowns.set(cooldownKey, Date.now());

    if (result.leveledUp) {
        await handleLevelUp(message, result, guildSettings);
    }
}

async function handleLevelUp(message, levelUpData, guildSettings) {
    const levelUpEmbed = {
        color: 0x00FF00,
        title: '🎉 Level Up!',
        description: `Congratulations ${message.author}! You've reached **Level ${levelUpData.newLevel}**!`,
        thumbnail: { url: message.author.displayAvatarURL({ dynamic: true }) },
        timestamp: new Date()
    };

    message.channel.send({ embeds: [levelUpEmbed] }).catch(() => { });

    await checkAndAssignRoleReward(message.member, levelUpData.newLevel, guildSettings);
}

async function checkAndAssignRoleReward(member, newLevel, guildSettings) {
    if (!guildSettings.leveling.roleRewards || guildSettings.leveling.roleRewards.length === 0) return;

    const reward = guildSettings.leveling.roleRewards.find(r => r.level === newLevel);
    if (!reward) return;

    try {
        const role = member.guild.roles.cache.get(reward.roleId);
        if (role && !member.roles.cache.has(role.id)) {
            await member.roles.add(role);
            logger.info(`Assigned role ${role.name} to ${member.user.tag} for reaching level ${newLevel}.`);
            member.send(`Congratulations! You've been awarded the **${role.name}** role for reaching Level ${newLevel}!`).catch(() => { });
        }
    } catch (error) {
        logger.error(`Failed to assign role reward to ${member.user.tag}:`, error);
    }
} 