const logger = require("../config/logger");

class MemoryOptimizer {
  constructor() {
    this.lastGcTime = 0;
    this.gcInterval = 5 * 60 * 1000; // 5 minutes
    this.memoryThreshold = 0.85; // Increased from 0.8 to 0.85 (85% of heap)
    this.minHeapSize = 50; // Minimum heap size in MB before warnings
    this.startMonitoring();
  }

  /**
   * Start memory monitoring
   */
  startMonitoring() {
    setInterval(() => {
      this.checkMemoryUsage();
    }, 60000); // Check every 60 seconds instead of 30
  }

  /**
   * Check memory usage and optimize if needed
   */
  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const heapUsageRatio = memUsage.heapUsed / memUsage.heapTotal;
    const heapSizeMB = memUsage.heapTotal / 1024 / 1024;

    // Only warn if heap size is significant and usage is high
    if (
      heapSizeMB > this.minHeapSize &&
      heapUsageRatio > this.memoryThreshold
    ) {
      logger.warn(
        `High memory usage detected: ${(heapUsageRatio * 100).toFixed(1)}% (${heapSizeMB.toFixed(1)}MB heap)`,
      );
      this.optimizeMemory();
    }

    // Log memory usage periodically (less frequent)
    if (Date.now() - this.lastGcTime > this.gcInterval) {
      logger.info(
        `Memory usage: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB / ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB (${(heapUsageRatio * 100).toFixed(1)}%)`,
      );
    }
  }

  /**
   * Optimize memory usage
   */
  optimizeMemory() {
    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        this.lastGcTime = Date.now();
        logger.info("Garbage collection performed");
      }

      // Clear module cache for unused modules
      this.clearModuleCache();

      // Log optimization results
      const memUsage = process.memoryUsage();
      logger.info(
        `Memory optimization completed. Current usage: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      );
    } catch (error) {
      logger.error("Error during memory optimization:", error);
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
      if (!key.includes("node_modules") && !key.includes("src/")) {
        delete require.cache[key];
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      logger.info(`Cleared ${clearedCount} module cache entries`);
    }
  }

  /**
   * Get memory statistics
   * @returns {Object} Memory statistics
   */
  getMemoryStats() {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      usageRatio: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(1),
    };
  }

  /**
   * Force memory optimization
   */
  forceOptimization() {
    logger.info("Forcing memory optimization...");
    this.optimizeMemory();
  }
}

// Create singleton instance
const memoryOptimizer = new MemoryOptimizer();

module.exports = memoryOptimizer;
