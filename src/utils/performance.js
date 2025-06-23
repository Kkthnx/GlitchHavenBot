const logger = require("../config/logger");

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      queries: {
        total: 0,
        slow: 0,
        averageTime: 0,
        totalTime: 0,
      },
      commands: {
        total: 0,
        errors: 0,
        averageTime: 0,
        totalTime: 0,
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0,
      },
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
      },
      uptime: Date.now(),
    };

    this.queryTimes = [];
    this.commandTimes = [];

    // Start monitoring
    this.startMemoryMonitoring();
  }

  /**
   * Monitor a database query
   * @param {Function} queryFn - The query function to monitor
   * @param {string} queryName - Name of the query for logging
   * @returns {Promise<any>} - Query result
   */
  async monitorQuery(queryFn, queryName) {
    const startTime = Date.now();
    this.metrics.queries.total++;

    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;

      this.metrics.queries.totalTime += duration;
      this.metrics.queries.averageTime =
        this.metrics.queries.totalTime / this.metrics.queries.total;

      this.queryTimes.push(duration);
      if (this.queryTimes.length > 100) {
        this.queryTimes.shift();
      }

      if (duration > 1000) {
        // Log queries taking more than 1 second
        this.metrics.queries.slow++;
        logger.warn(`Slow query detected: ${queryName} took ${duration}ms`);
      }

      return result;
    } catch (error) {
      logger.error(`Query error in ${queryName}:`, error);
      throw error;
    }
  }

  /**
   * Monitor a command execution
   * @param {Function} commandFn - The command function to monitor
   * @param {string} commandName - Name of the command for logging
   * @returns {Promise<any>} - Command result
   */
  async monitorCommand(commandFn, commandName) {
    const startTime = Date.now();
    this.metrics.commands.total++;

    try {
      const result = await commandFn();
      const duration = Date.now() - startTime;

      this.metrics.commands.totalTime += duration;
      this.metrics.commands.averageTime =
        this.metrics.commands.totalTime / this.metrics.commands.total;

      this.commandTimes.push(duration);
      if (this.commandTimes.length > 100) {
        this.commandTimes.shift();
      }

      if (duration > 5000) {
        // Log commands taking more than 5 seconds
        logger.warn(`Slow command detected: ${commandName} took ${duration}ms`);
      }

      return result;
    } catch (error) {
      this.metrics.commands.errors++;
      logger.error(`Command error in ${commandName}:`, error);
      throw error;
    }
  }

  /**
   * Record cache hit/miss
   * @param {boolean} isHit - Whether it was a cache hit
   */
  recordCacheAccess(isHit) {
    if (isHit) {
      this.metrics.cache.hits++;
    } else {
      this.metrics.cache.misses++;
    }

    const total = this.metrics.cache.hits + this.metrics.cache.misses;
    this.metrics.cache.hitRate =
      total > 0 ? (this.metrics.cache.hits / total) * 100 : 0;
  }

  /**
   * Update memory metrics
   */
  updateMemoryMetrics() {
    const memUsage = process.memoryUsage();
    this.metrics.memory = {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    };
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring() {
    setInterval(() => {
      this.updateMemoryMetrics();
    }, 30000); // Update every 30 seconds
  }

  /**
   * Get performance statistics
   * @returns {Object} - Performance metrics
   */
  getStats() {
    this.updateMemoryMetrics();

    const uptime = Date.now() - this.metrics.uptime;
    const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
    const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));

    return {
      ...this.metrics,
      uptime: {
        total: uptime,
        formatted: `${uptimeHours}h ${uptimeMinutes}m`,
      },
      performance: {
        queryPercentiles: this.calculatePercentiles(this.queryTimes),
        commandPercentiles: this.calculatePercentiles(this.commandTimes),
      },
    };
  }

  /**
   * Calculate percentiles for response times
   * @param {Array} times - Array of response times
   * @returns {Object} - Percentile data
   */
  calculatePercentiles(times) {
    if (times.length === 0) return { p50: 0, p95: 0, p99: 0 };

    const sorted = [...times].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      p50: sorted[Math.floor(len * 0.5)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
    };
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      queries: { total: 0, slow: 0, averageTime: 0, totalTime: 0 },
      commands: { total: 0, errors: 0, averageTime: 0, totalTime: 0 },
      cache: { hits: 0, misses: 0, hitRate: 0 },
      memory: { heapUsed: 0, heapTotal: 0, external: 0 },
      uptime: Date.now(),
    };
    this.queryTimes = [];
    this.commandTimes = [];
    logger.info("Performance metrics reset");
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor;
