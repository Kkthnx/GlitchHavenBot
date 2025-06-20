const mongoose = require('mongoose');
const logger = require('./logger');

let isConnected = false;

const connectDatabase = async () => {
    if (isConnected) {
        logger.info('Database already connected');
        return;
    }

    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/glitch-haven-bot';

        await mongoose.connect(mongoUri);

        isConnected = true;
        logger.info('Successfully connected to MongoDB');

        // Handle connection events
        mongoose.connection.on('error', (error) => {
            logger.error('MongoDB connection error:', error);
            isConnected = false;
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected');
            isConnected = false;
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB reconnected');
            isConnected = true;
        });

    } catch (error) {
        logger.error('Failed to connect to MongoDB:', error);
        throw error;
    }
};

const disconnectDatabase = async () => {
    if (!isConnected) {
        return;
    }

    try {
        await mongoose.disconnect();
        isConnected = false;
        logger.info('Disconnected from MongoDB');
    } catch (error) {
        logger.error('Error disconnecting from MongoDB:', error);
        throw error;
    }
};

module.exports = {
    connectDatabase,
    disconnectDatabase,
    isConnected: () => isConnected
}; 