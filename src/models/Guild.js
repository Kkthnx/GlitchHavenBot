const mongoose = require("mongoose");

const guildSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
    },
    guildName: {
      type: String,
      required: true,
    },

    // Welcome settings
    welcome: {
      enabled: { type: Boolean, default: true },
      channelId: String,
      message: {
        type: String,
        default: "Welcome {user} to {server}! 🎉",
      },
      dmMessage: String,
      roleId: String, // Auto-assign role on join
      imageEnabled: { type: Boolean, default: true },
    },

    // Moderation settings
    moderation: {
      enabled: { type: Boolean, default: true },
      logChannelId: String,
      moderatorRoleId: String,
      mutedRoleId: String,
      autoMod: {
        enabled: { type: Boolean, default: false },
        spamThreshold: { type: Number, default: 5 }, // messages per 10 seconds
        linkFilter: { type: Boolean, default: false },
        wordFilter: { type: Boolean, default: false },
        bannedWords: [String],
      },
      warningThreshold: { type: Number, default: 3 }, // warnings before auto-mute
      muteDuration: { type: Number, default: 10 }, // minutes
    },

    // Game settings
    games: {
      coinFlip: {
        enabled: { type: Boolean, default: true },
        cooldown: { type: Number, default: 10 }, // Reduced from 30 to 10 seconds
        streakRewards: { type: Boolean, default: true },
      },
      slap: {
        enabled: { type: Boolean, default: true },
        cooldown: { type: Number, default: 30 }, // 30 seconds default
      },
    },

    // Leveling System Settings
    leveling: {
      enabled: { type: Boolean, default: true },
      levelUpMessage: {
        type: String,
        default:
          "🎉 Congratulations {user}, you have reached **Level {level}**!",
      },
      roleRewards: [
        {
          level: { type: Number, required: true },
          roleId: { type: String, required: true },
        },
      ],
    },

    // Birthday System Settings
    birthdays: {
      enabled: { type: Boolean, default: false },
      channelId: String,
      message: {
        type: String,
        default: "🎂 Happy Birthday {user}! 🎂",
      },
    },

    // General settings
    prefix: {
      type: String,
      default: "!",
    },
    language: {
      type: String,
      default: "en",
    },

    // Custom commands
    customCommands: [
      {
        name: String,
        response: String,
        createdBy: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Auto-role settings
    autoRoles: [
      {
        roleId: String,
        enabled: { type: Boolean, default: true },
      },
    ],

    // Channel settings
    channels: {
      rules: String,
      announcements: String,
      general: String,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries on guildId
guildSchema.index({ guildId: 1 }, { unique: true });

// Methods
guildSchema.methods.updateWelcomeSettings = function (settings) {
  Object.assign(this.welcome, settings);
  return this.save();
};

guildSchema.methods.updateModerationSettings = function (settings) {
  Object.assign(this.moderation, settings);
  return this.save();
};

guildSchema.methods.addCustomCommand = function (name, response, createdBy) {
  // Remove existing command with same name
  this.customCommands = this.customCommands.filter((cmd) => cmd.name !== name);

  // Add new command
  this.customCommands.push({
    name,
    response,
    createdBy,
  });

  return this.save();
};

guildSchema.methods.removeCustomCommand = function (name) {
  this.customCommands = this.customCommands.filter((cmd) => cmd.name !== name);
  return this.save();
};

guildSchema.methods.addAutoRole = function (roleId) {
  if (!this.autoRoles.find((role) => role.roleId === roleId)) {
    this.autoRoles.push({ roleId });
  }
  return this.save();
};

guildSchema.methods.removeAutoRole = function (roleId) {
  this.autoRoles = this.autoRoles.filter((role) => role.roleId !== roleId);
  return this.save();
};

// Static methods
guildSchema.statics.findOrCreate = async function (guildId, guildName) {
  let guild = await this.findOne({ guildId });

  if (!guild) {
    guild = new this({
      guildId,
      guildName,
    });
    await guild.save();
  } else if (guild.guildName !== guildName) {
    guild.guildName = guildName;
    await guild.save();
  }

  return guild;
};

guildSchema.statics.getWelcomeSettings = async function (guildId) {
  const guild = await this.findOne({ guildId });
  return guild ? guild.welcome : null;
};

guildSchema.statics.getModerationSettings = async function (guildId) {
  const guild = await this.findOne({ guildId });
  return guild ? guild.moderation : null;
};

module.exports = mongoose.models.Guild || mongoose.model("Guild", guildSchema);
