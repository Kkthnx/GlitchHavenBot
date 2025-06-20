const logger = require('../config/logger');
const Guild = require('../models/Guild');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        logger.info(`Logged in as ${client.user.tag}`);

        // Set bot status
        client.user.setActivity('!help for commands', { type: 'PLAYING' });

        // Initialize guilds in database
        try {
            for (const guild of client.guilds.cache.values()) {
                await Guild.findOrCreate(guild.id, guild.name);
                logger.info(`Initialized guild: ${guild.name} (${guild.id})`);
            }
        } catch (error) {
            logger.error('Error initializing guilds:', error);
        }

        // Log bot statistics
        const stats = {
            guilds: client.guilds.cache.size,
            users: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
            channels: client.channels.cache.size
        };

        logger.info('Bot Statistics:', stats);

        // Set up periodic status updates
        setInterval(() => {
            const activities = [
                { text: `${client.guilds.cache.size} servers`, type: 'WATCHING' },
                { text: '!help for commands', type: 'PLAYING' },
                { text: `${client.users.cache.size} users`, type: 'WATCHING' }
            ];

            const activity = activities[Math.floor(Math.random() * activities.length)];
            client.user.setActivity(activity.text, { type: activity.type });
        }, 300000); // Update every 5 minutes
    }
}; 