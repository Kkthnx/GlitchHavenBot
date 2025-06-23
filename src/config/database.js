const mongoose = require("mongoose");

const logger = require("./logger");

let isConnected = false;

const connectDatabase = async () => {
  if (isConnected) {
    logger.info("Database already connected");
    return;
  }

  try {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/gridkeeper-bot";

    // Connection options for better performance (updated for newer MongoDB versions)
    const options = {
      maxPoolSize: 10, // Maximum number of connections in the pool
      minPoolSize: 2, // Minimum number of connections in the pool
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      serverSelectionTimeoutMS: 5000, // Timeout for server selection
      socketTimeoutMS: 45000, // Timeout for socket operations
      bufferCommands: false, // Disable mongoose buffering
      autoIndex: false, // Disable automatic index creation in production
      autoCreate: false, // Disable automatic collection creation
    };

    await mongoose.connect(mongoUri, options);

    isConnected = true;
    logger.info("Successfully connected to MongoDB with optimized settings");

    // Handle connection events
    mongoose.connection.on("error", (error) => {
      logger.error("MongoDB connection error:", error);
      isConnected = false;
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
      isConnected = false;
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected");
      isConnected = true;
    });

    // Monitor connection pool
    mongoose.connection.on("connected", () => {
      logger.info(
        `MongoDB connection pool size: ${mongoose.connection.db.serverConfig.s.options.maxPoolSize}`,
      );
    });

    // Set up query monitoring in development
    if (process.env.NODE_ENV === "development") {
      mongoose.set("debug", true);
    }
  } catch (error) {
    logger.error("Failed to connect to MongoDB:", error);
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
    logger.info("Disconnected from MongoDB");
  } catch (error) {
    logger.error("Error disconnecting from MongoDB:", error);
    throw error;
  }
};

// Get connection statistics
const getConnectionStats = () => {
  if (!mongoose.connection || !mongoose.connection.db) {
    return null;
  }

  return {
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
    poolSize: mongoose.connection.db.serverConfig.s.options.maxPoolSize,
  };
};

module.exports = {
  connectDatabase,
  disconnectDatabase,
  isConnected: () => isConnected,
  getConnectionStats,
};
