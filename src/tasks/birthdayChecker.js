const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const Guild = require('../models/Guild');
const User = require('../models/User');
const logger = require('../config/logger');

/**
 * Checks for users whose birthday is today and announces it.
 * @param {import('discord.js').Client} client The Discord client instance.
 */
const checkBirthdays = async (client) => {
    try {
        const today = new Date();
        const month = today.getUTCMonth();
        const day = today.getUTCDate();

        // Find users whose birthday is today (ignoring the year)
        const birthdayUsers = await User.find({
            $expr: {
                $and: [
                    { $eq: [{ $getUTCMonth: '$birthday' }, month] },
                    { $eq: [{ $getUTCDayOfMonth: '$birthday' }, day] }
                ]
            }
        });

        if (birthdayUsers.length === 0) {
            logger.info('[Birthday] No birthdays today.');
            return;
        }

        logger.info(`[Birthday] Found ${birthdayUsers.length} user(s) with a birthday today.`);

        // Group users by guild
        const birthdaysByGuild = birthdayUsers.reduce((acc, user) => {
            (acc[user.guildId] = acc[user.guildId] || []).push(user);
            return acc;
        }, {});

        for (const guildId in birthdaysByGuild) {
            const guildSettings = await Guild.findOne({ guildId: guildId });

            if (guildSettings && guildSettings.birthdays.enabled && guildSettings.birthdays.channelId) {
                const channel = await client.channels.fetch(guildSettings.birthdays.channelId).catch(() => null);
                if (channel) {
                    const usersInGuild = birthdaysByGuild[guildId];
                    for (const user of usersInGuild) {
                        const member = await channel.guild.members.fetch(user.userId).catch(() => null);
                        if (member) {
                            const message = guildSettings.birthdays.message.replace('{user}', member.toString());
                            const embed = new EmbedBuilder()
                                .setColor(0xFFC0CB) // Pink
                                .setDescription(message)
                                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

                            await channel.send({ embeds: [embed] });
                        }
                    }
                }
            }
        }
    } catch (error) {
        logger.error('[Birthday] Error during birthday check:', error);
    }
};

/**
 * Schedules the birthday check to run once a day.
 * @param {import('discord.js').Client} client The Discord client instance.
 */
const scheduleBirthdayCheck = (client) => {
    // Run every day at 9:00 AM UTC
    cron.schedule('0 9 * * *', () => {
        logger.info('[Scheduler] Running Birthday check task...');
        checkBirthdays(client);
    }, {
        timezone: "UTC"
    });
    logger.info('[Scheduler] Birthday check task scheduled to run daily at 9:00 AM UTC.');
};

module.exports = { scheduleBirthdayCheck, checkBirthdays }; 