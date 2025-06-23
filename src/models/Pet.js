const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
    ownerId: {
        type: String,
        required: true,
        index: true
    },
    guildId: {
        type: String,
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['dog', 'cat', 'rabbit', 'parrot', 'turtle', 'frog']
    },
    level: {
        type: Number,
        default: 1
    },
    experience: {
        type: Number,
        default: 0
    },
    hunger: {
        type: Number,
        default: 100,
        min: 0,
        max: 100
    },
    happiness: {
        type: Number,
        default: 100,
        min: 0,
        max: 100
    },
    energy: {
        type: Number,
        default: 100,
        min: 0,
        max: 100
    },
    health: {
        type: Number,
        default: 100,
        min: 0,
        max: 100
    },
    stats: {
        attack: {
            type: Number,
            default: 5
        },
        defense: {
            type: Number,
            default: 5
        },
        speed: {
            type: Number,
            default: 5
        },
        health: {
            type: Number,
            default: 50
        }
    },
    lastFed: {
        type: Date,
        default: Date.now
    },
    lastPlayed: {
        type: Date,
        default: Date.now
    },
    lastTrained: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'deceased'],
        default: 'active'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Indexes for efficient queries
petSchema.index({ ownerId: 1, guildId: 1, status: 1 });
petSchema.index({ guildId: 1, level: -1 });

// Virtual for total power
petSchema.virtual('totalPower').get(function () {
    return this.stats.attack + this.stats.defense + this.stats.speed + this.stats.health;
});

// Virtual for experience needed for next level
petSchema.virtual('expForNextLevel').get(function () {
    return this.level * 100;
});

// Virtual for experience progress percentage
petSchema.virtual('expProgress').get(function () {
    const expNeeded = this.expForNextLevel;
    const expInCurrentLevel = this.experience - ((this.level - 1) * 100);
    return (expInCurrentLevel / expNeeded) * 100;
});

// Method to add experience
petSchema.methods.addExperience = function (amount) {
    this.experience += amount;
    this.lastUpdated = new Date();

    // Check for level up
    const expNeeded = this.expForNextLevel;
    if (this.experience >= expNeeded) {
        this.levelUp();
    }

    return this.save();
};

// Method to level up
petSchema.methods.levelUp = function () {
    this.level += 1;
    this.stats.attack += 2;
    this.stats.defense += 2;
    this.stats.speed += 1;
    this.stats.health += 10;
    this.health = Math.min(100, this.health + 10);
    this.lastUpdated = new Date();
    return this.save();
};

// Method to feed pet
petSchema.methods.feed = function () {
    const hungerGain = Math.min(100 - this.hunger, 30);
    this.hunger = Math.min(100, this.hunger + hungerGain);
    this.happiness = Math.min(100, this.happiness + 5);
    this.lastFed = new Date();
    this.lastUpdated = new Date();
    return this.save();
};

// Method to play with pet
petSchema.methods.play = function () {
    const happinessGain = Math.min(100 - this.happiness, 25);
    this.happiness = Math.min(100, this.happiness + happinessGain);
    this.energy = Math.max(0, this.energy - 10);
    this.lastPlayed = new Date();
    this.lastUpdated = new Date();
    return this.save();
};

// Method to train pet
petSchema.methods.train = function () {
    const statGain = Math.floor(Math.random() * 3) + 1;
    this.stats.attack += statGain;
    this.energy = Math.max(0, this.energy - 20);
    this.lastTrained = new Date();
    this.lastUpdated = new Date();
    return this.save();
};

// Method to battle
petSchema.methods.battle = function () {
    this.energy = Math.max(0, this.energy - 30);
    this.lastUpdated = new Date();
    return this.save();
};

// Method to check if pet can perform actions
petSchema.methods.canFeed = function () {
    const timeSinceLastFed = Date.now() - this.lastFed.getTime();
    return timeSinceLastFed >= 30 * 60 * 1000; // 30 minutes
};

petSchema.methods.canPlay = function () {
    const timeSinceLastPlayed = Date.now() - this.lastPlayed.getTime();
    return timeSinceLastPlayed >= 15 * 60 * 1000; // 15 minutes
};

petSchema.methods.canTrain = function () {
    const timeSinceLastTrained = Date.now() - this.lastTrained.getTime();
    return timeSinceLastTrained >= 60 * 60 * 1000; // 60 minutes
};

petSchema.methods.canBattle = function () {
    return this.energy >= 30;
};

// Static method to find user's active pet
petSchema.statics.findActivePet = function (ownerId, guildId) {
    return this.findOne({ ownerId, guildId, status: 'active' });
};

// Static method to get top pets by level
petSchema.statics.getTopPets = function (guildId, limit = 10) {
    return this.find({ guildId, status: 'active' })
        .sort({ level: -1, experience: -1 })
        .limit(limit);
};

// Static method to get pets by type
petSchema.statics.getPetsByType = function (guildId, type) {
    return this.find({ guildId, type, status: 'active' });
};

// Pre-save middleware to update lastUpdated
petSchema.pre('save', function (next) {
    this.lastUpdated = new Date();
    next();
});

module.exports = mongoose.model('Pet', petSchema); 