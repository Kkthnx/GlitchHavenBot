#!/usr/bin/env node

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const BACKUP_DIR = path.join(process.cwd(), 'backups');

async function backup() {
    console.log('🗄️  Starting database backup...\n');

    // Create backup directory if it doesn't exist
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);

    // Parse MongoDB URI to get database name
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/glitch-haven-bot';
    const dbName = mongoUri.split('/').pop().split('?')[0];

    console.log(`📊 Backing up database: ${dbName}`);
    console.log(`💾 Backup file: ${backupFile}\n`);

    // Use mongodump if available, otherwise use mongoexport
    const command = `mongodump --uri="${mongoUri}" --out="${BACKUP_DIR}/dump-${timestamp}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error('❌ Backup failed:', error.message);
            console.log('\n💡 Alternative: Use MongoDB Atlas backup feature or manual export.');
            return;
        }

        if (stderr) {
            console.log('⚠️  Warnings:', stderr);
        }

        console.log('✅ Backup completed successfully!');
        console.log(`📁 Backup location: ${BACKUP_DIR}/dump-${timestamp}`);
        console.log('\n📋 To restore this backup:');
        console.log(`mongorestore --uri="${mongoUri}" "${BACKUP_DIR}/dump-${timestamp}"`);
    });
}

// Check if mongodump is available
exec('mongodump --version', (error) => {
    if (error) {
        console.log('⚠️  mongodump not found. Please install MongoDB tools:');
        console.log('   - Windows: Download from MongoDB website');
        console.log('   - macOS: brew install mongodb/brew/mongodb-database-tools');
        console.log('   - Linux: sudo apt-get install mongodb-database-tools');
        console.log('\n💡 Alternative: Use MongoDB Atlas backup feature.');
        return;
    }

    backup();
}); 