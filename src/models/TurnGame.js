const mongoose = require('mongoose');

const turnGameSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    channelId: {
        type: String,
        required: true
    },
    creatorId: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    maxPlayers: {
        type: Number,
        required: true,
        min: 2,
        max: 10
    },
    players: [{
        userId: {
            type: String,
            required: true
        },
        username: {
            type: String,
            required: true
        },
        joinedAt: {
            type: Date,
            default: Date.now
        }
    }],
    currentTurn: {
        type: Number,
        default: 0
    },
    turnOrder: [{
        type: String
    }],
    turnCount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['waiting', 'active', 'ended', 'cancelled'],
        default: 'waiting'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    startedAt: {
        type: Date
    },
    endedAt: {
        type: Date
    },
    lastTurnAt: {
        type: Date
    }
});

// Indexes for efficient queries
turnGameSchema.index({ guildId: 1, status: 1 });
turnGameSchema.index({ creatorId: 1, status: 1 });
turnGameSchema.index({ guildId: 1, createdAt: -1 });

// Virtual for current player
turnGameSchema.virtual('currentPlayer').get(function () {
    if (this.turnOrder.length === 0 || this.currentTurn >= this.turnOrder.length) {
        return null;
    }
    return this.players.find(p => p.userId === this.turnOrder[this.currentTurn]);
});

// Virtual for game duration
turnGameSchema.virtual('duration').get(function () {
    if (!this.startedAt) return null;
    const endTime = this.endedAt || new Date();
    return endTime.getTime() - this.startedAt.getTime();
});

// Virtual for player count
turnGameSchema.virtual('playerCount').get(function () {
    return this.players.length;
});

// Method to add player
turnGameSchema.methods.addPlayer = function (userId, username) {
    if (this.players.length >= this.maxPlayers) {
        throw new Error('Game is full');
    }

    if (this.players.some(p => p.userId === userId)) {
        throw new Error('Player already in game');
    }

    this.players.push({
        userId: userId,
        username: username,
        joinedAt: new Date()
    });

    this.turnOrder.push(userId);
    return this.save();
};

// Method to remove player
turnGameSchema.methods.removePlayer = function (userId) {
    this.players = this.players.filter(p => p.userId !== userId);
    this.turnOrder = this.turnOrder.filter(id => id !== userId);

    // Adjust current turn if necessary
    if (this.currentTurn >= this.turnOrder.length) {
        this.currentTurn = 0;
    }

    return this.save();
};

// Method to start game
turnGameSchema.methods.startGame = function () {
    if (this.players.length < 2) {
        throw new Error('Need at least 2 players to start');
    }

    if (this.status !== 'waiting') {
        throw new Error('Game is not in waiting status');
    }

    this.status = 'active';
    this.currentTurn = 0;
    this.turnCount = 0;
    this.startedAt = new Date();

    return this.save();
};

// Method to advance turn
turnGameSchema.methods.nextTurn = function () {
    if (this.status !== 'active') {
        throw new Error('Game is not active');
    }

    this.currentTurn = (this.currentTurn + 1) % this.turnOrder.length;
    this.turnCount += 1;
    this.lastTurnAt = new Date();

    return this.save();
};

// Method to skip current player
turnGameSchema.methods.skipCurrentPlayer = function () {
    if (this.status !== 'active') {
        throw new Error('Game is not active');
    }

    this.currentTurn = (this.currentTurn + 1) % this.turnOrder.length;
    this.turnCount += 1;
    this.lastTurnAt = new Date();

    return this.save();
};

// Method to end game
turnGameSchema.methods.endGame = function () {
    this.status = 'ended';
    this.endedAt = new Date();
    return this.save();
};

// Method to get current player info
turnGameSchema.methods.getCurrentPlayer = function () {
    if (this.turnOrder.length === 0) return null;
    const currentPlayerId = this.turnOrder[this.currentTurn];
    return this.players.find(p => p.userId === currentPlayerId);
};

// Method to get next player info
turnGameSchema.methods.getNextPlayer = function () {
    if (this.turnOrder.length === 0) return null;
    const nextTurn = (this.currentTurn + 1) % this.turnOrder.length;
    const nextPlayerId = this.turnOrder[nextTurn];
    return this.players.find(p => p.userId === nextPlayerId);
};

// Method to shuffle turn order
turnGameSchema.methods.shuffleTurnOrder = function () {
    const shuffled = [...this.turnOrder];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    this.turnOrder = shuffled;
    this.currentTurn = 0;
    return this.save();
};

// Static method to find active games
turnGameSchema.statics.findActiveGames = function (guildId) {
    return this.find({ guildId, status: { $in: ['waiting', 'active'] } });
};

// Static method to find user's games
turnGameSchema.statics.findUserGames = function (userId, guildId) {
    return this.find({
        guildId,
        $or: [
            { creatorId: userId },
            { 'players.userId': userId }
        ],
        status: { $in: ['waiting', 'active'] }
    });
};

// Static method to get game history
turnGameSchema.statics.getGameHistory = function (guildId, limit = 10) {
    return this.find({ guildId, status: 'ended' })
        .sort({ endedAt: -1 })
        .limit(limit);
};

// Pre-save middleware to validate data
turnGameSchema.pre('save', function (next) {
    // Ensure turn order matches players
    if (this.turnOrder.length !== this.players.length) {
        this.turnOrder = this.players.map(p => p.userId);
    }

    // Ensure current turn is valid
    if (this.currentTurn >= this.turnOrder.length) {
        this.currentTurn = 0;
    }

    next();
});

module.exports = mongoose.models.TurnGame || mongoose.model('TurnGame', turnGameSchema); 