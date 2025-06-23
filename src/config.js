const dotenv = require('dotenv');
const path = require('path');

const env = process.env.NODE_ENV || 'development';

if (env === 'development') {
    dotenv.config({ path: path.resolve(process.cwd(), '.env.dev') });
} else {
    dotenv.config(); // Loads .env file by default
}

module.exports = {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    MONGODB_URI: process.env.MONGODB_URI,
    // Add other environment variables here
};
