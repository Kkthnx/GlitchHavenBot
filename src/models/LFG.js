const mongoose = require('mongoose');

const lfgSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true },
    creatorId: { type: String, required: true },
    game: { type: String, required: true },
    description: { type: String, required: true },
    slots: { type: Number, required: true },
    players: { type: [String], default: [] }, // Array of user IDs
    status: {
        type: String,
        enum: ['open', 'full', 'closed'],
        default: 'open'
    }
}, { timestamps: true });

lfgSchema.index({ guildId: 1, game: 1 });
lfgSchema.index({ creatorId: 1 });

module.exports = mongoose.model('LFG', lfgSchema); 