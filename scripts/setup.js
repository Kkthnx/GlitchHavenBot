#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setup() {
    console.log('🤖 Gridkeeper Bot Setup\n');
    console.log('This script will help you create your .env file.\n');

    const envPath = path.join(process.cwd(), '.env');

    if (fs.existsSync(envPath)) {
        const overwrite = await question('⚠️  .env file already exists. Overwrite? (y/N): ');
        if (overwrite.toLowerCase() !== 'y') {
            console.log('Setup cancelled.');
            rl.close();
            return;
        }
    }

    console.log('\n📝 Please provide the following information:\n');

    const envVars = {};

    // Discord Configuration
    envVars.DISCORD_TOKEN = await question('Discord Bot Token: ');
    envVars.DISCORD_CLIENT_ID = await question('Discord Client ID: ');
    envVars.DISCORD_GUILD_ID = await question('Discord Guild (Server) ID: ');

    // Database Configuration
    envVars.MONGODB_URI = await question('MongoDB URI (or press Enter for localhost): ') || 'mongodb://localhost:27017/gridkeeper-bot';

    // Bot Configuration
    envVars.BOT_OWNER_ID = await question('Bot Owner ID (your Discord user ID): ');
    envVars.BOT_PREFIX = await question('Command Prefix (press Enter for !): ') || '!';

    // Optional Configuration
    const logLevel = await question('Log Level (press Enter for info): ') || 'info';
    envVars.LOG_LEVEL = logLevel;

    const welcomeChannel = await question('Welcome Channel ID (optional, press Enter to skip): ');
    if (welcomeChannel) envVars.WELCOME_CHANNEL_ID = welcomeChannel;

    const logChannel = await question('Log Channel ID (optional, press Enter to skip): ');
    if (logChannel) envVars.LOG_CHANNEL_ID = logChannel;

    const modRole = await question('Moderator Role ID (optional, press Enter to skip): ');
    if (modRole) envVars.MODERATOR_ROLE_ID = modRole;

    const mutedRole = await question('Muted Role ID (optional, press Enter to skip): ');
    if (mutedRole) envVars.MUTED_ROLE_ID = mutedRole;

    // Generate .env content
    let envContent = '# Discord Bot Configuration\n';
    envContent += `DISCORD_TOKEN=${envVars.DISCORD_TOKEN}\n`;
    envContent += `DISCORD_CLIENT_ID=${envVars.DISCORD_CLIENT_ID}\n`;
    envContent += `DISCORD_GUILD_ID=${envVars.DISCORD_GUILD_ID}\n\n`;

    envContent += '# Database Configuration\n';
    envContent += `MONGODB_URI=${envVars.MONGODB_URI}\n\n`;

    envContent += '# Bot Configuration\n';
    envContent += `BOT_PREFIX=${envVars.BOT_PREFIX}\n`;
    envContent += `BOT_OWNER_ID=${envVars.BOT_OWNER_ID}\n\n`;

    envContent += '# Logging Configuration\n';
    envContent += `LOG_LEVEL=${envVars.LOG_LEVEL}\n\n`;

    if (welcomeChannel) {
        envContent += '# Welcome Configuration\n';
        envContent += `WELCOME_CHANNEL_ID=${welcomeChannel}\n\n`;
    }

    if (logChannel) {
        envContent += '# Logging Configuration\n';
        envContent += `LOG_CHANNEL_ID=${logChannel}\n\n`;
    }

    if (modRole || mutedRole) {
        envContent += '# Moderation Configuration\n';
        if (modRole) envContent += `MODERATOR_ROLE_ID=${modRole}\n`;
        if (mutedRole) envContent += `MUTED_ROLE_ID=${mutedRole}\n`;
    }

    // Write .env file
    fs.writeFileSync(envPath, envContent);

    console.log('\n✅ .env file created successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Install dependencies: npm install');
    console.log('2. Set up MongoDB (local or Atlas)');
    console.log('3. Invite bot to your server');
    console.log('4. Run the bot: npm start');
    console.log('\n📖 For more information, see README.md and DEPLOYMENT.md');

    rl.close();
}

setup().catch(console.error); 