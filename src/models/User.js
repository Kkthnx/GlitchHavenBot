const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    guildId: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    discriminator: {
        type: String,
        default: '0'
    },
    avatar: String,
    bio: { type: String, maxlength: 250 },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },

    // User's birthday
    birthday: {
        type: Date
    },

    // Leveling system
    leveling: {
        xp: { type: Number, default: 0 },
        level: { type: Number, default: 0 },
        totalXp: { type: Number, default: 0 },
        lastMessage: Date,
        levelUpHistory: [{
            level: Number,
            timestamp: { type: Date, default: Date.now }
        }],
        lastMessageTimestamp: { type: Date, default: 0 }
    },

    // Game statistics
    gameStats: {
        coinFlips: {
            total: { type: Number, default: 0 },
            wins: { type: Number, default: 0 },
            losses: { type: Number, default: 0 },
            streak: { type: Number, default: 0 },
            bestStreak: { type: Number, default: 0 }
        },
        rps: {
            total: { type: Number, default: 0 },
            wins: { type: Number, default: 0 },
            losses: { type: Number, default: 0 },
            ties: { type: Number, default: 0 }
        },
        lastFlip: Date
    },

    // Moderation history
    moderation: {
        warnings: [{
            reason: String,
            moderatorId: String,
            moderatorName: String,
            timestamp: { type: Date, default: Date.now },
            active: { type: Boolean, default: true }
        }],
        mutes: [{
            reason: String,
            moderatorId: String,
            moderatorName: String,
            duration: Number, // in minutes
            timestamp: { type: Date, default: Date.now },
            expiresAt: Date,
            active: { type: Boolean, default: true }
        }],
        kicks: [{
            reason: String,
            moderatorId: String,
            moderatorName: String,
            timestamp: { type: Date, default: Date.now }
        }],
        bans: [{
            reason: String,
            moderatorId: String,
            moderatorName: String,
            timestamp: { type: Date, default: Date.now },
            expiresAt: Date,
            active: { type: Boolean, default: true }
        }]
    },

    // User preferences
    preferences: {
        welcomeMessages: { type: Boolean, default: true },
        gameNotifications: { type: Boolean, default: true },
        rankCardBackground: {
            type: String,
            default: 'default'
        }
    },

    // Economy
    economy: {
        wallet: { type: Number, default: 0 },
        bank: { type: Number, default: 0 },
    }
}, {
    timestamps: true
});

// Indexes for better query performance
userSchema.index({ userId: 1, guildId: 1 }, { unique: true });
userSchema.index({ 'leveling.level': -1, 'leveling.xp': -1 });
userSchema.index({ 'gameStats.coinFlips.wins': -1 });
userSchema.index({ 'gameStats.coinFlips.total': -1 });
userSchema.index({ 'gameStats.coinFlips.bestStreak': -1 });
userSchema.index({ 'gameStats.rps.wins': -1 });
userSchema.index({ birthday: 1 }, { sparse: true });

// Additional performance indexes
userSchema.index({ guildId: 1, 'leveling.level': -1, 'leveling.xp': -1 });
userSchema.index({ guildId: 1, 'gameStats.coinFlips.wins': -1 });
userSchema.index({ guildId: 1, 'gameStats.rps.wins': -1 });
userSchema.index({ 'leveling.lastMessageTimestamp': 1 });
userSchema.index({ 'gameStats.lastFlip': 1 });
userSchema.index({ 'moderation.warnings.active': 1 });
userSchema.index({ 'moderation.mutes.active': 1 });
userSchema.index({ 'moderation.bans.active': 1 });

// Compound indexes for complex queries
userSchema.index({ guildId: 1, 'leveling.level': -1 });
userSchema.index({ guildId: 1, 'gameStats.coinFlips.total': -1 });
userSchema.index({ guildId: 1, 'gameStats.rps.total': -1 });

// Level calculation function
function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp));
}

function calculateXpForLevel(level) {
    return Math.pow(level / 0.1, 2);
}

function calculateXpForNextLevel(level) {
    return Math.pow((level + 1) / 0.1, 2);
}

// Methods
userSchema.methods.addWarning = function (reason, moderatorId, moderatorName) {
    this.moderation.warnings.push({
        reason,
        moderatorId,
        moderatorName
    });
    return this.save();
};

userSchema.methods.addMute = function (reason, moderatorId, moderatorName, duration) {
    const expiresAt = new Date(Date.now() + duration * 60 * 1000);
    this.moderation.mutes.push({
        reason,
        moderatorId,
        moderatorName,
        duration,
        expiresAt
    });
    return this.save();
};

userSchema.methods.addKick = function (reason, moderatorId, moderatorName) {
    this.moderation.kicks.push({
        reason,
        moderatorId,
        moderatorName
    });
    return this.save();
};

userSchema.methods.addBan = function (reason, moderatorId, moderatorName, duration = null) {
    const banData = {
        reason,
        moderatorId,
        moderatorName
    };

    if (duration) {
        banData.expiresAt = new Date(Date.now() + duration * 60 * 1000);
    }

    this.moderation.bans.push(banData);
    return this.save();
};

userSchema.methods.recordCoinFlip = function (won) {
    this.gameStats.coinFlips.total++;
    this.gameStats.lastFlip = new Date();

    if (won) {
        this.gameStats.coinFlips.wins++;
        this.gameStats.coinFlips.streak++;
        if (this.gameStats.coinFlips.streak > this.gameStats.coinFlips.bestStreak) {
            this.gameStats.coinFlips.bestStreak = this.gameStats.coinFlips.streak;
        }
    } else {
        this.gameStats.coinFlips.losses++;
        this.gameStats.coinFlips.streak = 0;
    }

    return this.save();
};

userSchema.methods.addXP = async function (amount, reason = 'message') {
    const oldLevel = this.leveling.level;

    this.leveling.xp += amount;
    this.leveling.totalXp += amount;
    this.leveling.lastMessage = new Date();

    const newLevel = calculateLevel(this.leveling.xp);

    if (newLevel > oldLevel) {
        this.leveling.level = newLevel;
        this.leveling.levelUpHistory.push({
            level: newLevel,
            timestamp: new Date()
        });

        await this.save();
        return {
            leveledUp: true,
            oldLevel,
            newLevel,
            xpGained: amount,
            reason
        };
    }

    await this.save();
    return {
        leveledUp: false,
        xpGained: amount,
        reason
    };
};

userSchema.methods.getLevelProgress = function () {
    const currentLevel = this.leveling.level;
    const currentXp = this.leveling.xp;
    const xpForCurrentLevel = calculateXpForLevel(currentLevel);
    const xpForNextLevel = calculateXpForNextLevel(currentLevel);
    const xpInCurrentLevel = currentXp - xpForCurrentLevel;
    const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
    const progress = (xpInCurrentLevel / xpNeededForNextLevel) * 100;

    return {
        currentLevel,
        currentXp,
        xpInCurrentLevel,
        xpNeededForNextLevel,
        progress: Math.min(100, Math.max(0, progress))
    };
};

userSchema.methods.updateLastSeen = function () {
    this.lastSeen = new Date();
    return this.save();
};

// Static methods
userSchema.statics.findOrCreate = async function (userId, guildId, userData) {
    let user = await this.findOne({ userId, guildId });

    if (!user) {
        user = new this({
            userId,
            guildId,
            username: userData.username,
            discriminator: userData.discriminator || '0',
            avatar: userData.avatar
        });
        await user.save();
    } else {
        // Update user info if it changed
        if (user.username !== userData.username ||
            user.discriminator !== (userData.discriminator || '0') ||
            user.avatar !== userData.avatar) {
            user.username = userData.username;
            user.discriminator = userData.discriminator || '0';
            user.avatar = userData.avatar;
            await user.save();
        }
    }

    return user;
};

userSchema.statics.getLeaderboard = async function (guildId, limit = 10) {
    return this.find({ guildId })
        .sort({ 'gameStats.coinFlips.wins': -1 })
        .limit(limit);
};

userSchema.statics.getLevelLeaderboard = async function (guildId, limit = 10) {
    return this.find({ guildId })
        .sort({ 'leveling.level': -1, 'leveling.xp': -1 })
        .limit(limit);
};

module.exports = mongoose.model('User', userSchema);