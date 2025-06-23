const mongoose = require('mongoose');

const adventureSchema = new mongoose.Schema({
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
    theme: {
        type: String,
        required: true,
        default: 'fantasy'
    },
    participants: [{
        type: String
    }],
    currentChapter: {
        type: Number,
        default: 1
    },
    story: {
        type: String,
        required: true
    },
    choices: [{
        type: String
    }],
    votes: {
        type: Map,
        of: Number,
        default: {}
    },
    status: {
        type: String,
        enum: ['active', 'completed', 'cancelled'],
        default: 'active'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date
    }
});

// Index for efficient queries
adventureSchema.index({ guildId: 1, status: 1 });

// Virtual for vote count
adventureSchema.virtual('voteCount').get(function () {
    return Object.keys(this.votes).length;
});

// Virtual for participant count
adventureSchema.virtual('participantCount').get(function () {
    return this.participants.length;
});

// Method to add a vote
adventureSchema.methods.addVote = function (userId, choice) {
    this.votes.set(userId, choice);
    return this.save();
};

// Method to get vote counts
adventureSchema.methods.getVoteCounts = function () {
    const counts = {};
    for (const [userId, choice] of this.votes) {
        counts[choice] = (counts[choice] || 0) + 1;
    }
    return counts;
};

// Method to get winning choice
adventureSchema.methods.getWinningChoice = function () {
    const voteCounts = this.getVoteCounts();
    if (Object.keys(voteCounts).length === 0) return null;

    return parseInt(Object.keys(voteCounts).reduce((a, b) =>
        voteCounts[a] > voteCounts[b] ? a : b
    ));
};

// Method to check if enough votes are cast
adventureSchema.methods.hasEnoughVotes = function () {
    const totalVotes = Object.keys(this.votes).length;
    const participants = this.participants.length;
    return totalVotes >= Math.ceil(participants * 0.5);
};

// Method to progress story
adventureSchema.methods.progressStory = function (newStory, newChoices) {
    this.story = newStory;
    this.choices = newChoices;
    this.currentChapter += 1;
    this.votes.clear();

    // Check if adventure should end
    if (this.currentChapter > 5) {
        this.status = 'completed';
        this.completedAt = new Date();
    }

    return this.save();
};

// Static method to find active adventure
adventureSchema.statics.findActive = function (guildId) {
    return this.findOne({ guildId, status: 'active' });
};

// Static method to get adventure history
adventureSchema.statics.getHistory = function (guildId, limit = 10) {
    return this.find({ guildId, status: 'completed' })
        .sort({ completedAt: -1 })
        .limit(limit);
};

module.exports = mongoose.models.Adventure || mongoose.model('Adventure', adventureSchema); 