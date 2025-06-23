I have implemented the rank card customization feature. Here's a summary of the changes and what you need to do to get it working:

### Rank Card Dimensions

The rank card images you create should be **495 pixels wide by 152 pixels tall**.

### What I've Done

1. **New `!rankcard` Command**: I've added a new command to manage rank card backgrounds.
    * `!rankcard set <name>`: Sets your rank card background.
    * `!rankcard list`: Lists all available backgrounds.
    * `!rankcard view`: Shows you a preview of your current rank card.
    * `!rankcard clear`: Resets your rank card to the default.
2. **Updated `!level` Command**: The `!level` command will now display your chosen rank card background.
3. **Backgrounds Folder**: You can now add your custom `.png` rank card backgrounds to the `assets/rankcards/` directory. The name of the file (without the `.png` extension) will be used in the `!rankcard set <name>` command.

### Important: Manual Action Required

I've had some trouble with my tools correctly modifying the user database file (`src/models/User.js`). I've attempted to clean it up, but it's still not quite right.

**Please replace the `userSchema` in `src/models/User.js` with the following code to ensure everything works correctly:**

```javascript
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
            ties: { type: Number, default:0 }
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
```

Once you've updated the schema and added your rank card images, the feature should be ready to go. You may need to restart the bot to see the changes.

Let me know if you have any other questions!
