const cron = require('node-cron');
const logger = require('../config/logger');

/**
 * Schedules cleanup tasks to run periodically.
 * Note: LFG posts are no longer automatically cleaned up - they only close when manually closed by the creator.
 * @param {import('discord.js').Client} client The Discord client instance.
 */
const scheduleCleanup = (client) => {
    // No automatic LFG cleanup - posts only close when manually closed
    logger.info('[Scheduler] LFG cleanup disabled - posts only close when manually closed by creator.');
};

module.exports = { scheduleCleanup }; 