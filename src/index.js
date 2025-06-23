const mongoose = require('mongoose');
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import configurations
const { connectDatabase } = require('./config/database');
const logger = require('./config/logger');
const { scheduleCleanup } = require('./tasks/cleanup');
const { scheduleBirthdayCheck } = require('./tasks/birthdayChecker');
const memoryOptimizer = require('./utils/memoryOptimizer');
const cleanupUtility = require('./utils/cleanup');
const { DISCORD_TOKEN } = require('./config');

// Create Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration
    ]
});

// Initialize collections
client.commands = new Collection();
client.cooldowns = new Collection();
client.config = {
    prefix: process.env.BOT_PREFIX || '!',
    ownerId: process.env.BOT_OWNER_ID,
    guildId: process.env.DISCORD_GUILD_ID
};

// Load commands
const loadCommands = async () => {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            const command = require(filePath);

            if ('name' in command && 'execute' in command) {
                client.commands.set(command.name, command);
                logger.info(`Loaded command: ${command.name}`);
            } else {
                logger.warn(`Command at ${filePath} is missing required properties`);
            }
        }
    }
};

// Load events
const loadEvents = async () => {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);

        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }

        logger.info(`Loaded event: ${event.name}`);
    }
};

// Error handling
process.on('unhandledRejection', (error) => {
    logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
});

// Initialize bot
const initializeBot = async () => {
    try {
        // Connect to database
        await connectDatabase();
        logger.info('Connected to database');

        // Load commands and events
        await loadCommands();
        await loadEvents();
        logger.info('Loaded commands and events');

        // Login to Discord
        await client.login(DISCORD_TOKEN);
        logger.info('Bot logged in successfully');

        // Schedule tasks
        scheduleCleanup(client);
        scheduleBirthdayCheck(client);

        // Start automatic cleanup scheduler
        cleanupUtility.startAutomaticCleanup();

        // Log initial memory stats
        const memStats = memoryOptimizer.getMemoryStats();
        logger.info(`Initial memory usage: ${memStats.heapUsed}MB / ${memStats.heapTotal}MB (${memStats.usageRatio}%)`);

        // Log cleanup stats
        const cleanupStats = cleanupUtility.getCleanupStats();
        logger.info(`Cleanup utility initialized. Next cleanup in ${cleanupStats.hoursSinceLastCleanup} hours`);

    } catch (error) {
        logger.error('Failed to initialize bot:', error);
        process.exit(1);
    }
};

// Start the bot
initializeBot();

module.exports = client; 