const mongoose = require('mongoose');
const databaseService = require('../src/utils/databaseService');
const logger = require('../src/config/logger');
require('dotenv').config();

async function optimizeDatabase() {
    try {
        console.log('🚀 Starting database optimization...');

        // Connect to database
        await databaseService.connectDatabase();
        console.log('✅ Connected to database');

        // Optimize indexes
        console.log('📊 Optimizing database indexes...');
        await databaseService.optimizeIndexes();
        console.log('✅ Indexes optimized');

        // Get database statistics
        console.log('📈 Analyzing database statistics...');
        const stats = await databaseService.getDatabaseStats();

        console.log('\n📊 Database Statistics:');
        console.log('Collections:');
        Object.entries(stats.collections).forEach(([name, count]) => {
            console.log(`  ${name}: ${count} documents`);
        });

        console.log('\nCache Performance:');
        Object.entries(stats.cache).forEach(([name, cacheStats]) => {
            console.log(`  ${name}: ${cacheStats.hitRate} hit rate, ${cacheStats.size} entries`);
        });

        console.log('\nQuery Statistics:');
        console.log(`  Total Queries: ${stats.queries.totalQueries}`);
        console.log(`  Slow Queries: ${stats.queries.slowQueries}`);
        console.log(`  Cached Queries: ${stats.queries.cachedQueries}`);

        // Clean up old data
        console.log('\n🧹 Cleaning up old data...');
        await cleanupOldData();

        // Analyze query performance
        console.log('\n🔍 Analyzing query performance...');
        await analyzeQueryPerformance();

        console.log('\n✅ Database optimization completed successfully!');

    } catch (error) {
        console.error('❌ Error during database optimization:', error);
        logger.error('Database optimization failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from database');
    }
}

async function cleanupOldData() {
    const collections = {
        'lfgs': { expiresAt: { $lt: new Date() } },
        'turngames': {
            status: 'ended',
            endedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // 30 days old
        },
        'adventures': {
            status: 'completed',
            completedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // 30 days old
        }
    };

    for (const [collectionName, filter] of Object.entries(collections)) {
        try {
            const collection = mongoose.connection.db.collection(collectionName);
            const result = await collection.deleteMany(filter);
            if (result.deletedCount > 0) {
                console.log(`  Cleaned up ${result.deletedCount} old ${collectionName} documents`);
            }
        } catch (error) {
            console.error(`  Error cleaning up ${collectionName}:`, error);
        }
    }
}

async function analyzeQueryPerformance() {
    try {
        // Get slow query statistics
        const slowQueries = await mongoose.connection.db.collection('system.profile').find({
            millis: { $gt: 100 } // Queries taking more than 100ms
        }).limit(10).toArray();

        if (slowQueries.length > 0) {
            console.log('  Slow queries detected:');
            slowQueries.forEach(query => {
                console.log(`    ${query.op} on ${query.ns}: ${query.millis}ms`);
            });
        } else {
            console.log('  No slow queries detected');
        }

        // Analyze index usage
        const indexStats = await mongoose.connection.db.collection('system.indexes').find({}).toArray();
        console.log(`  Total indexes: ${indexStats.length}`);

    } catch (error) {
        console.log('  Could not analyze query performance (profiling may be disabled)');
    }
}

// Run optimization if called directly
if (require.main === module) {
    optimizeDatabase();
}

module.exports = { optimizeDatabase }; 