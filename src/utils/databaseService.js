const mongoose = require("mongoose");

const logger = require("../config/logger");

const {
  guildCache,
  userCache,
  leaderboardCache,
  gameCache,
  cacheKeys,
} = require("./cache");
const performanceMonitor = require("./performance");

class DatabaseService {
  constructor() {
    this.connectionPool = new Map();
    this.queryStats = {
      totalQueries: 0,
      cachedQueries: 0,
      slowQueries: 0,
    };
  }

  /**
   * Connect to database
   * @returns {Promise<void>}
   */
  async connectDatabase() {
    const { connectDatabase } = require("../config/database");
    await connectDatabase();
  }

  /**
   * Get guild settings with caching
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} - Guild settings
   */
  async getGuildSettings(guildId) {
    const cacheKey = cacheKeys.guild(guildId);
    let settings = guildCache.get(cacheKey);

    if (!settings) {
      settings = await performanceMonitor.monitorQuery(async () => {
        const Guild = require("../models/Guild");
        return await Guild.findOne({ guildId }).lean();
      }, "getGuildSettings");

      if (settings) {
        guildCache.set(cacheKey, settings, 10 * 60 * 1000); // 10 minutes
        performanceMonitor.recordCacheAccess(false); // Cache miss
      } else {
        // Create default settings if none exist
        settings = await this.createDefaultGuildSettings(guildId);
        guildCache.set(cacheKey, settings, 10 * 60 * 1000);
        performanceMonitor.recordCacheAccess(false);
      }
    } else {
      performanceMonitor.recordCacheAccess(true); // Cache hit
    }

    return settings;
  }

  /**
   * Get or create user with caching
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @param {Object} userData - User data
   * @returns {Promise<Object>} - User object
   */
  async getOrCreateUser(userId, guildId, userData) {
    const cacheKey = cacheKeys.user(userId, guildId);
    let user = userCache.get(cacheKey);

    if (!user) {
      user = await performanceMonitor.monitorQuery(async () => {
        const User = require("../models/User");
        return await User.findOrCreate(userId, guildId, userData);
      }, "getOrCreateUser");

      userCache.set(cacheKey, user, 5 * 60 * 1000); // 5 minutes
      performanceMonitor.recordCacheAccess(false);
    } else {
      performanceMonitor.recordCacheAccess(true);
    }

    return user;
  }

  /**
   * Update user and invalidate cache
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} - Updated user
   */
  async updateUser(userId, guildId, updates) {
    const User = require("../models/User");
    const user = await User.findOneAndUpdate({ userId, guildId }, updates, {
      new: true,
      runValidators: true,
    });

    if (user) {
      // Update cache
      const cacheKey = cacheKeys.user(userId, guildId);
      userCache.set(cacheKey, user, 5 * 60 * 1000);

      // Invalidate leaderboard cache
      this.invalidateLeaderboardCache(guildId);
    }

    return user;
  }

  /**
   * Get leaderboard with caching
   * @param {string} guildId - Guild ID
   * @param {string} type - Leaderboard type (level, coinflip, rps)
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} - Leaderboard data
   */
  async getLeaderboard(guildId, type = "level", limit = 10) {
    const cacheKey = cacheKeys.leaderboard(guildId, type);
    let leaderboard = leaderboardCache.get(cacheKey);

    if (!leaderboard) {
      leaderboard = await performanceMonitor.monitorQuery(async () => {
        const User = require("../models/User");
        switch (type) {
          case "level":
            return await User.getLevelLeaderboard(guildId, limit);
          case "coinflip":
            return await User.getLeaderboard(guildId, limit);
          case "rps":
            return await User.getRPSLeaderboard(guildId, limit);
          case "reputation":
            return await User.getReputationLeaderboard(guildId, limit);
          case "slap":
            return await User.getSlapLeaderboard(guildId, limit);
          default:
            return await User.getLevelLeaderboard(guildId, limit);
        }
      }, `getLeaderboard_${type}`);

      leaderboardCache.set(cacheKey, leaderboard, 2 * 60 * 1000); // 2 minutes
      performanceMonitor.recordCacheAccess(false);
    } else {
      performanceMonitor.recordCacheAccess(true);
    }

    return leaderboard;
  }

  /**
   * Get user rank with optimized query
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   * @param {string} type - Rank type (level, coinflip, rps)
   * @returns {Promise<number>} - User rank
   */
  async getUserRank(userId, guildId, type = "level") {
    const User = require("../models/User");

    let sortField;
    switch (type) {
      case "level":
        sortField = { "leveling.level": -1, "leveling.xp": -1 };
        break;
      case "coinflip":
        sortField = { "gameStats.coinFlips.wins": -1 };
        break;
      case "rps":
        sortField = { "gameStats.rps.wins": -1 };
        break;
      default:
        sortField = { "leveling.level": -1, "leveling.xp": -1 };
    }

    const rank = await User.countDocuments({
      guildId,
      ...(type === "level" ? {} : {}),
      $or: [
        {
          [type === "level" ? "leveling.level" : `gameStats.${type}.wins`]: {
            $gt: 0,
          },
        },
      ],
    }).where(sortField);

    return rank + 1;
  }

  /**
   * Bulk update users for XP/leveling
   * @param {Array} updates - Array of user updates
   * @returns {Promise<Object>} - Bulk operation result
   */
  async bulkUpdateUsers(updates) {
    const User = require("../models/User");
    const bulkOps = updates.map((update) => ({
      updateOne: {
        filter: { userId: update.userId, guildId: update.guildId },
        update: update.changes,
        upsert: false,
      },
    }));

    const result = await User.bulkWrite(bulkOps, { ordered: false });

    // Invalidate affected user caches
    updates.forEach((update) => {
      const cacheKey = cacheKeys.user(update.userId, update.guildId);
      userCache.delete(cacheKey);
    });

    return result;
  }

  /**
   * Get active games with caching
   * @param {string} guildId - Guild ID
   * @param {string} gameType - Type of game (turn, pet, adventure)
   * @returns {Promise<Array>} - Active games
   */
  async getActiveGames(guildId, gameType) {
    const cacheKey = cacheKeys.game(`${guildId}:${gameType}`);
    let games = gameCache.get(cacheKey);

    if (!games) {
      let Model;
      let query = { guildId, status: { $in: ["waiting", "active"] } };

      switch (gameType) {
        case "turn":
          Model = require("../models/TurnGame");
          break;
        case "pet":
          Model = require("../models/Pet");
          query = { guildId, status: "active" };
          break;
        case "adventure":
          Model = require("../models/Adventure");
          break;
        default:
          return [];
      }

      games = await Model.find(query).lean();
      gameCache.set(cacheKey, games, 1 * 60 * 1000); // 1 minute
    }

    return games;
  }

  /**
   * Invalidate leaderboard cache
   * @param {string} guildId - Guild ID
   */
  invalidateLeaderboardCache(guildId) {
    const types = ["level", "coinflip", "rps"];
    types.forEach((type) => {
      const cacheKey = cacheKeys.leaderboard(guildId, type);
      leaderboardCache.delete(cacheKey);
    });
  }

  /**
   * Invalidate user cache
   * @param {string} userId - User ID
   * @param {string} guildId - Guild ID
   */
  invalidateUserCache(userId, guildId) {
    const cacheKey = cacheKeys.user(userId, guildId);
    userCache.delete(cacheKey);
  }

  /**
   * Invalidate guild cache
   * @param {string} guildId - Guild ID
   */
  invalidateGuildCache(guildId) {
    const cacheKey = cacheKeys.guild(guildId);
    guildCache.delete(cacheKey);
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>} - Database stats
   */
  async getDatabaseStats() {
    const stats = {
      collections: {},
      cache: {
        guild: guildCache.getStats(),
        user: userCache.getStats(),
        leaderboard: leaderboardCache.getStats(),
        game: gameCache.getStats(),
      },
      queries: this.queryStats,
    };

    // Get collection stats
    const collections = [
      "users",
      "guilds",
      "turngames",
      "pets",
      "adventures",
      "lfgs",
    ];
    for (const collection of collections) {
      try {
        const count = await mongoose.connection.db
          .collection(collection)
          .countDocuments();
        stats.collections[collection] = count;
      } catch (error) {
        logger.error(
          `Error getting stats for collection ${collection}:`,
          error,
        );
      }
    }

    return stats;
  }

  /**
   * Optimize database indexes
   * @returns {Promise<void>}
   */
  async optimizeIndexes() {
    try {
      const collections = [
        "users",
        "guilds",
        "turngames",
        "pets",
        "adventures",
        "lfgs",
      ];

      for (const collection of collections) {
        await mongoose.connection.db.collection(collection).createIndexes();
        logger.info(`Optimized indexes for ${collection}`);
      }
    } catch (error) {
      logger.error("Error optimizing indexes:", error);
    }
  }

  /**
   * Monitor slow queries
   * @param {Function} queryFn - Query function to monitor
   * @param {string} queryName - Name of the query for logging
   * @returns {Promise<any>} - Query result
   */
  async monitorQuery(queryFn, queryName) {
    const startTime = Date.now();
    this.queryStats.totalQueries++;

    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;

      if (duration > 1000) {
        // Log queries taking more than 1 second
        this.queryStats.slowQueries++;
        logger.warn(`Slow query detected: ${queryName} took ${duration}ms`);
      }

      return result;
    } catch (error) {
      logger.error(`Query error in ${queryName}:`, error);
      throw error;
    }
  }

  /**
   * Create default guild settings
   * @param {string} guildId - Guild ID
   * @returns {Promise<Object>} - Default guild settings
   */
  async createDefaultGuildSettings(guildId) {
    const Guild = require("../models/Guild");
    const defaultSettings = {
      guildId,
      prefix: "!",
      leveling: {
        enabled: true,
        xpCooldown: 60000,
        roleRewards: [],
      },
      moderation: {
        autoMod: {
          enabled: false,
          wordFilter: false,
          bannedWords: [],
        },
      },
      welcome: {
        enabled: false,
        channelId: null,
        message: "Welcome {user} to {server}!",
      },
    };

    const guild = new Guild(defaultSettings);
    await guild.save();
    return guild.toObject();
  }
}

// Create singleton instance
const databaseService = new DatabaseService();

module.exports = databaseService;
