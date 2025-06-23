const logger = require('../config/logger');

class Cache {
    constructor() {
        this.cache = new Map();
        this.ttl = new Map(); // Time-to-live for cache entries
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
    }

    /**
     * Set a cache entry with optional TTL
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
     */
    set(key, value, ttl = 5 * 60 * 1000) {
        this.cache.set(key, value);
        this.ttl.set(key, Date.now() + ttl);
        this.stats.sets++;

        // Schedule cleanup
        setTimeout(() => {
            this.delete(key);
        }, ttl);
    }

    /**
     * Get a cache entry
     * @param {string} key - Cache key
     * @returns {any|null} - Cached value or null if not found/expired
     */
    get(key) {
        const value = this.cache.get(key);
        const expiry = this.ttl.get(key);

        if (value && expiry && Date.now() < expiry) {
            this.stats.hits++;
            return value;
        }

        // Clean up expired entry
        if (value) {
            this.delete(key);
        }

        this.stats.misses++;
        return null;
    }

    /**
     * Delete a cache entry
     * @param {string} key - Cache key
     */
    delete(key) {
        this.cache.delete(key);
        this.ttl.delete(key);
        this.stats.deletes++;
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
        this.ttl.clear();
        logger.info('Cache cleared');
    }

    /**
     * Get cache statistics
     * @returns {Object} - Cache statistics
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;

        return {
            ...this.stats,
            hitRate: `${hitRate}%`,
            size: this.cache.size,
            memoryUsage: this.getMemoryUsage()
        };
    }

    /**
     * Get memory usage of cache
     * @returns {string} - Memory usage in MB
     */
    getMemoryUsage() {
        const used = process.memoryUsage();
        return `${(used.heapUsed / 1024 / 1024).toFixed(2)} MB`;
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, expiry] of this.ttl.entries()) {
            if (now > expiry) {
                this.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.debug(`Cache cleanup: removed ${cleaned} expired entries`);
        }
    }
}

// Create cache instances for different data types
const guildCache = new Cache();
const userCache = new Cache();
const leaderboardCache = new Cache();
const gameCache = new Cache();

// Cache keys generator
const cacheKeys = {
    guild: (guildId) => `guild:${guildId}`,
    user: (userId, guildId) => `user:${userId}:${guildId}`,
    leaderboard: (guildId, type) => `leaderboard:${guildId}:${type}`,
    game: (gameId) => `game:${gameId}`,
    pet: (userId, guildId) => `pet:${userId}:${guildId}`,
    turnGame: (gameId) => `turnGame:${gameId}`,
    adventure: (guildId) => `adventure:${guildId}`,
    lfg: (guildId) => `lfg:${guildId}`
};

// Cache decorator for functions
function cacheResult(cacheInstance, keyGenerator, ttl = 5 * 60 * 1000) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;

        descriptor.value = async function (...args) {
            const key = keyGenerator(...args);
            const cached = cacheInstance.get(key);

            if (cached !== null) {
                return cached;
            }

            const result = await method.apply(this, args);
            cacheInstance.set(key, result, ttl);
            return result;
        };
    };
}

// Scheduled cleanup every 10 minutes
setInterval(() => {
    guildCache.cleanup();
    userCache.cleanup();
    leaderboardCache.cleanup();
    gameCache.cleanup();
}, 10 * 60 * 1000);

module.exports = {
    guildCache,
    userCache,
    leaderboardCache,
    gameCache,
    cacheKeys,
    cacheResult,
    Cache
}; 