const moment = require('moment');

/**
 * Format duration from minutes to human readable string
 * @param {number} minutes - Duration in minutes
 * @returns {string} - Formatted duration string
 */
function formatDuration(minutes) {
    if (minutes < 1) return 'Less than 1 minute';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours < 24) {
        if (remainingMinutes === 0) {
            return `${hours} hour${hours !== 1 ? 's' : ''}`;
        }
        return `${hours} hour${hours !== 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (remainingHours === 0) {
        return `${days} day${days !== 1 ? 's' : ''}`;
    }
    return `${days} day${days !== 1 ? 's' : ''} and ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
}

/**
 * Parse time string to minutes
 * @param {string} timeString - Time string (e.g., "1h", "30m", "2d")
 * @returns {number} - Duration in minutes
 */
function parseTime(timeString) {
    const timeRegex = /^(\d+)([mhd])$/i;
    const match = timeString.match(timeRegex);

    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
        case 'm': return value;
        case 'h': return value * 60;
        case 'd': return value * 60 * 24;
        default: return null;
    }
}

/**
 * Format timestamp to relative time
 * @param {Date} timestamp - The timestamp to format
 * @returns {string} - Relative time string
 */
function formatRelativeTime(timestamp) {
    return moment(timestamp).fromNow();
}

/**
 * Format timestamp to absolute time
 * @param {Date} timestamp - The timestamp to format
 * @returns {string} - Absolute time string
 */
function formatAbsoluteTime(timestamp) {
    return moment(timestamp).format('YYYY-MM-DD HH:mm:ss UTC');
}

/**
 * Create a progress bar
 * @param {number} current - Current value
 * @param {number} total - Total value
 * @param {number} length - Bar length
 * @returns {string} - Progress bar string
 */
function createProgressBar(current, total, length = 10) {
    const progress = Math.round((current / total) * length);
    const filled = '█'.repeat(progress);
    const empty = '░'.repeat(length - progress);
    return filled + empty;
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Escape markdown characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeMarkdown(text) {
    return text.replace(/[_*~`|]/g, '\\$&');
}

/**
 * Generate a random string
 * @param {number} length - Length of the string
 * @returns {string} - Random string
 */
function generateRandomString(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Validate Discord user ID
 * @param {string} userId - User ID to validate
 * @returns {boolean} - Whether the ID is valid
 */
function isValidUserId(userId) {
    return /^\d{17,19}$/.test(userId);
}

/**
 * Validate Discord channel ID
 * @param {string} channelId - Channel ID to validate
 * @returns {boolean} - Whether the ID is valid
 */
function isValidChannelId(channelId) {
    return /^\d{17,19}$/.test(channelId);
}

/**
 * Validate Discord role ID
 * @param {string} roleId - Role ID to validate
 * @returns {boolean} - Whether the ID is valid
 */
function isValidRoleId(roleId) {
    return /^\d{17,19}$/.test(roleId);
}

/**
 * Get user mention from ID
 * @param {string} userId - User ID
 * @returns {string} - User mention string
 */
function getUserMention(userId) {
    return `<@${userId}>`;
}

/**
 * Get channel mention from ID
 * @param {string} channelId - Channel ID
 * @returns {string} - Channel mention string
 */
function getChannelMention(channelId) {
    return `<#${channelId}>`;
}

/**
 * Get role mention from ID
 * @param {string} roleId - Role ID
 * @returns {string} - Role mention string
 */
function getRoleMention(roleId) {
    return `<@&${roleId}>`;
}

/**
 * Extract user ID from mention
 * @param {string} mention - User mention
 * @returns {string|null} - User ID or null
 */
function extractUserId(mention) {
    const match = mention.match(/^<@!?(\d+)>$/);
    return match ? match[1] : null;
}

/**
 * Extract channel ID from mention
 * @param {string} mention - Channel mention
 * @returns {string|null} - Channel ID or null
 */
function extractChannelId(mention) {
    const match = mention.match(/^<#(\d+)>$/);
    return match ? match[1] : null;
}

/**
 * Extract role ID from mention
 * @param {string} mention - Role mention
 * @returns {string|null} - Role ID or null
 */
function extractRoleId(mention) {
    const match = mention.match(/^<@&(\d+)>$/);
    return match ? match[1] : null;
}

/**
 * Capitalize first letter of each word
 * @param {string} text - Text to capitalize
 * @returns {string} - Capitalized text
 */
function capitalizeWords(text) {
    return text.replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Check if string contains profanity using a pre-compiled regex for efficiency.
 * @param {string} text - Text to check.
 * @param {Array<string>} bannedWords - Array of banned words.
 * @returns {boolean} - Whether text contains profanity.
 */
function containsProfanity(text, bannedWords) {
    if (bannedWords.length === 0) return false;

    // Create a single regex to match any of the banned words as whole words.
    // The `\b` is a word boundary. This prevents matching "ass" in "class".
    // We escape special regex characters in the words themselves.
    const regex = new RegExp(`\\b(${bannedWords.map(word =>
        word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
    ).join('|')})\\b`, 'i');

    return regex.test(text);
}

/**
 * Safe error handler for async operations
 * @param {Function} fn - Async function to execute
 * @param {string} context - Context for error logging
 * @returns {Promise<any>} - Function result or null on error
 */
async function safeExecute(fn, context = 'Unknown') {
    try {
        return await fn();
    } catch (error) {
        console.error(`Error in ${context}:`, error);
        return null;
    }
}

/**
 * Validate and sanitize user input
 * @param {string} input - User input to validate
 * @param {number} maxLength - Maximum allowed length
 * @returns {string|null} - Sanitized input or null if invalid
 */
function sanitizeInput(input, maxLength = 1000) {
    if (!input || typeof input !== 'string') return null;

    const sanitized = input.trim().substring(0, maxLength);
    return sanitized.length > 0 ? sanitized : null;
}

/**
 * Format number with commas for better readability
 * @param {number} num - Number to format
 * @returns {string} - Formatted number
 */
function formatNumber(num) {
    return num.toLocaleString();
}

/**
 * Calculate percentage with safety checks
 * @param {number} part - Part value
 * @param {number} total - Total value
 * @param {number} decimals - Number of decimal places
 * @returns {string} - Formatted percentage
 */
function calculatePercentage(part, total, decimals = 1) {
    if (total === 0) return '0%';
    return ((part / total) * 100).toFixed(decimals) + '%';
}

module.exports = {
    formatDuration,
    parseTime,
    formatRelativeTime,
    formatAbsoluteTime,
    createProgressBar,
    truncateText,
    escapeMarkdown,
    generateRandomString,
    isValidUserId,
    isValidChannelId,
    isValidRoleId,
    getUserMention,
    getChannelMention,
    getRoleMention,
    extractUserId,
    extractChannelId,
    extractRoleId,
    capitalizeWords,
    containsProfanity,
    safeExecute,
    sanitizeInput,
    formatNumber,
    calculatePercentage
}; 