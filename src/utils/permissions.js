const { PermissionFlagsBits } = require("discord.js");

/**
 * Check if a user has moderator permissions
 * @param {GuildMember} member - The guild member to check
 * @param {Guild} guild - The guild object
 * @param {string} moderatorRoleId - The moderator role ID from settings
 * @returns {boolean} - Whether the user has moderator permissions
 */
function hasModeratorPermissions(member, guild, moderatorRoleId) {
  // Check if user is guild owner
  if (member.id === guild.ownerId) {
    return true;
  }

  // Check if user has administrator permission
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  // Check if user has manage messages permission
  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return true;
  }

  // Check if user has the moderator role
  if (moderatorRoleId && member.roles.cache.has(moderatorRoleId)) {
    return true;
  }

  return false;
}

/**
 * Check if a user can be moderated by another user
 * @param {GuildMember} target - The target member
 * @param {GuildMember} moderator - The moderator member
 * @param {Guild} guild - The guild object
 * @returns {Object} - Result object with canModerate and reason
 */
function canModerateUser(target, moderator, guild) {
  // Can't moderate yourself
  if (target.id === moderator.id) {
    return {
      canModerate: false,
      reason: "You cannot moderate yourself.",
    };
  }

  // Can't moderate the guild owner
  if (target.id === guild.ownerId) {
    return {
      canModerate: false,
      reason: "You cannot moderate the server owner.",
    };
  }

  // Can't moderate bots (unless you're the bot owner)
  if (target.user.bot && moderator.id !== process.env.BOT_OWNER_ID) {
    return {
      canModerate: false,
      reason: "You cannot moderate bots.",
    };
  }

  // Check role hierarchy
  if (target.roles.highest.position >= moderator.roles.highest.position) {
    return {
      canModerate: false,
      reason: "You cannot moderate someone with a higher or equal role.",
    };
  }

  return {
    canModerate: true,
    reason: null,
  };
}

/**
 * Check if the bot has required permissions
 * @param {Guild} guild - The guild object
 * @param {Array<string>} permissions - Array of permission flags
 * @returns {Object} - Result object with hasPermissions and missing
 */
function botHasPermissions(guild, permissions) {
  const botMember = guild.members.cache.get(guild.client.user.id);
  const missing = [];

  for (const permission of permissions) {
    if (!botMember.permissions.has(permission)) {
      missing.push(permission);
    }
  }

  return {
    hasPermissions: missing.length === 0,
    missing,
  };
}

/**
 * Get required permissions for moderation actions
 * @param {string} action - The moderation action
 * @returns {Array<string>} - Array of required permission flags
 */
function getRequiredPermissions(action) {
  const permissions = {
    warn: [PermissionFlagsBits.ManageMessages],
    mute: [PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageMessages],
    kick: [PermissionFlagsBits.KickMembers],
    ban: [PermissionFlagsBits.BanMembers],
    unban: [PermissionFlagsBits.BanMembers],
  };

  return permissions[action] || [];
}

/**
 * Check if a user has specific permissions
 * @param {GuildMember} member - The guild member to check
 * @param {Array<string>} permissions - Array of permission flags
 * @returns {boolean} - Whether the user has all permissions
 */
function hasPermissions(member, permissions) {
  return permissions.every((permission) => member.permissions.has(permission));
}

/**
 * Get permission names for display
 * @param {Array<string>} permissions - Array of permission flags
 * @returns {Array<string>} - Array of readable permission names
 */
function getPermissionNames(permissions) {
  const permissionNames = {
    [PermissionFlagsBits.ManageMessages]: "Manage Messages",
    [PermissionFlagsBits.ManageRoles]: "Manage Roles",
    [PermissionFlagsBits.KickMembers]: "Kick Members",
    [PermissionFlagsBits.BanMembers]: "Ban Members",
    [PermissionFlagsBits.Administrator]: "Administrator",
    [PermissionFlagsBits.ManageGuild]: "Manage Server",
  };

  return permissions.map(
    (permission) => permissionNames[permission] || permission,
  );
}

module.exports = {
  hasModeratorPermissions,
  canModerateUser,
  botHasPermissions,
  getRequiredPermissions,
  hasPermissions,
  getPermissionNames,
};
