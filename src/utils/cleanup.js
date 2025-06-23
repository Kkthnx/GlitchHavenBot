const logger = require('../config/logger');
const { guildCache, userCache, leaderboardCache, gameCache } = require('./cache');
const mongoose = require('mongoose');

class CleanupUtility {
    constructor() {
        this.lastCleanup = Date.now();
        this.cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
    }

    /**
     * Perform comprehensive cleanup
     */
    async performFullCleanup() {
        logger.info('Starting comprehensive cleanup...');

        try {
            // Clear all caches
            await this.clearAllCaches();

            // Clean up expired data
            await this.cleanupExpiredData();

            // Optimize database
            await this.optimizeDatabase();

            // Clear module cache
            this.clearModuleCache();

            // Force garbage collection
            if (global.gc) {
                global.gc();
                logger.info('Garbage collection performed');
            }

            this.lastCleanup = Date.now();
            logger.info('Comprehensive cleanup completed successfully');

        } catch (error) {
            logger.error('Error during cleanup:', error);
        }
    }

    /**
     * Clear all caches
     */
    async clearAllCaches() {
        guildCache.clear();
        userCache.clear();
        leaderboardCache.clear();
        gameCache.clear();
        logger.info('All caches cleared');
    }

    /**
     * Clean up expired data from database
     */
    async cleanupExpiredData() {
        try {
            // Note: LFG posts are no longer automatically cleaned up - they only close when manually closed by the creator

            // Clean up old game sessions
            const TurnGame = require('../models/TurnGame');
            const expiredGames = await TurnGame.deleteMany({
                status: { $in: ['completed', 'cancelled'] },
                updatedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // 30 days old
            });

            if (expiredGames.deletedCount > 0) {
                logger.info(`Cleaned up ${expiredGames.deletedCount} expired game sessions`);
            }

            // Clean up old pet battles
            const Pet = require('../models/Pet');
            const expiredPets = await Pet.deleteMany({
                status: 'inactive',
                updatedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // 30 days old
            });

            if (expiredPets.deletedCount > 0) {
                logger.info(`Cleaned up ${expiredPets.deletedCount} expired pet battles`);
            }

            // Clean up old adventures
            const Adventure = require('../models/Adventure');
            const expiredAdventures = await Adventure.deleteMany({
                status: { $in: ['completed', 'failed'] },
                updatedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // 30 days old
            });

            if (expiredAdventures.deletedCount > 0) {
                logger.info(`Cleaned up ${expiredAdventures.deletedCount} expired adventures`);
            }

        } catch (error) {
            logger.error('Error cleaning up expired data:', error);
        }
    }

    /**
     * Optimize database
     */
    async optimizeDatabase() {
        try {
            // Compact collections
            const collections = ['users', 'guilds', 'turngames', 'pets', 'adventures', 'lfgs'];

            for (const collection of collections) {
                try {
                    await mongoose.connection.db.collection(collection).compact();
                    logger.info(`Compacted collection: ${collection}`);
                } catch (error) {
                    // Compact might not be available in all MongoDB versions
                    logger.debug(`Compact not available for ${collection}:`, error.message);
                }
            }

            // Update statistics
            for (const collection of collections) {
                try {
                    await mongoose.connection.db.collection(collection).stats();
                    logger.info(`Updated stats for collection: ${collection}`);
                } catch (error) {
                    logger.debug(`Could not update stats for ${collection}:`, error.message);
                }
            }

        } catch (error) {
            logger.error('Error optimizing database:', error);
        }
    }

    /**
     * Clear module cache for unused modules
     */
    clearModuleCache() {
        const cacheKeys = Object.keys(require.cache);
        let clearedCount = 0;

        for (const key of cacheKeys) {
            // Don't clear core modules or our own modules
            if (!key.includes('node_modules') && !key.includes('src/')) {
                delete require.cache[key];
                clearedCount++;
            }
        }

        if (clearedCount > 0) {
            logger.info(`Cleared ${clearedCount} module cache entries`);
        }
    }

    /**
     * Get cleanup statistics
     */
    getCleanupStats() {
        const timeSinceLastCleanup = Date.now() - this.lastCleanup;
        const hoursSinceLastCleanup = Math.floor(timeSinceLastCleanup / (1000 * 60 * 60));

        return {
            lastCleanup: this.lastCleanup,
            timeSinceLastCleanup: timeSinceLastCleanup,
            hoursSinceLastCleanup: hoursSinceLastCleanup,
            nextScheduledCleanup: this.lastCleanup + this.cleanupInterval
        };
    }

    /**
     * Check if cleanup is needed
     */
    isCleanupNeeded() {
        return Date.now() - this.lastCleanup > this.cleanupInterval;
    }

    /**
     * Start automatic cleanup scheduler
     */
    startAutomaticCleanup() {
        setInterval(() => {
            if (this.isCleanupNeeded()) {
                logger.info('Automatic cleanup triggered');
                this.performFullCleanup();
            }
        }, 60 * 60 * 1000); // Check every hour

        logger.info('Automatic cleanup scheduler started');
    }
}

// Create singleton instance
const cleanupUtility = new CleanupUtility();

module.exports = cleanupUtility; 