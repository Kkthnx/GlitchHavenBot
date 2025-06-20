const cron = require('node-cron');
const LFG = require('../models/LFG');
const { EmbedBuilder, ActionRowBuilder } = require('discord.js');
const logger = require('../config/logger');

/**
 * Finds and updates expired LFG posts.
 * @param {import('discord.js').Client} client The Discord client instance.
 */
const cleanupLFGPosts = async (client) => {
    try {
        // Find posts that are past their expiration date but not yet marked as expired.
        const expiredPosts = await LFG.find({
            status: { $in: ['open', 'full'] },
            expiresAt: { $lt: new Date() }
        });

        if (expiredPosts.length === 0) {
            return; // Nothing to do
        }

        logger.info(`[Cleanup] Found ${expiredPosts.length} expired LFG post(s).`);

        for (const post of expiredPosts) {
            post.status = 'expired';
            await post.save();

            try {
                const channel = await client.channels.fetch(post.channelId);
                // Ensure the channel is a text-based channel before fetching messages
                if (!channel || !channel.isTextBased()) {
                    logger.warn(`[Cleanup] LFG post channel ${post.channelId} not found or is not a text channel.`);
                    continue;
                }
                const message = await channel.messages.fetch(post.messageId);

                // Re-fetch the embed and disable buttons
                const originalEmbed = message.embeds[0];
                const newEmbed = new EmbedBuilder(originalEmbed.toJSON())
                    .setColor(0x808080) // Gray
                    .setTitle(`[EXPIRED] 🎮 ${post.game}`)
                    .setFooter({ text: 'This LFG has expired.' });

                // Disable all buttons on the message
                const row = ActionRowBuilder.from(message.components[0]);
                row.components.forEach(button => button.setDisabled(true));

                await message.edit({ embeds: [newEmbed], components: [row] });

            } catch (error) {
                // It's common for messages to be deleted by moderators, so we'll just log a warning.
                if (error.code === 10008) { // Unknown Message
                    logger.warn(`[Cleanup] Could not find LFG message ${post.messageId} to expire. It was likely deleted.`);
                } else {
                    logger.error(`[Cleanup] Failed to edit expired LFG message ${post.messageId}:`, error);
                }
            }
        }
    } catch (error) {
        logger.error('[Cleanup] Error during LFG cleanup task:', error);
    }
};

/**
 * Schedules the LFG cleanup task to run periodically.
 * @param {import('discord.js').Client} client The Discord client instance.
 */
const scheduleCleanup = (client) => {
    // Run every 5 minutes
    cron.schedule('*/5 * * * *', () => {
        logger.info('[Scheduler] Running LFG cleanup task...');
        cleanupLFGPosts(client);
    });
    logger.info('[Scheduler] LFG cleanup task scheduled to run every 5 minutes.');
};

module.exports = { scheduleCleanup, cleanupLFGPosts }; 