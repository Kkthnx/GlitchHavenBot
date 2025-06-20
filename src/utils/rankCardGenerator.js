const jimp = require('jimp');
const path = require('path');

// A more reliable way to load the built-in fonts
const loadFont = (font) => jimp.loadFont(path.join(__dirname, `../../node_modules/jimp/fonts/open-sans/${font}/${font}.fnt`));

/**
 * Creates a graphical rank card for a user.
 * @param {object} userData - The user's data.
 * @param {string} userData.avatarURL - URL of the user's avatar.
 * @param {string} userData.username - The user's username.
 * @param {string} userData.discriminator - The user's discriminator.
 * @param {number} userData.level - The user's current level.
 * @param {number} userData.rank - The user's rank in the leaderboard.
 * @param {number} userData.currentXp - The user's XP within the current level.
 * @param {number} userData.neededXp - The XP needed to reach the next level.
 * @returns {Promise<Buffer>} - A promise that resolves with the image buffer.
 */
const createRankCard = async (userData) => {
    // Destructure user data for easier access
    const { avatarURL, username, discriminator, level, rank, currentXp, neededXp } = userData;

    // Create a new image
    const image = new jimp(1000, 250, '#2C2F33');

    // Load a background image (optional, can be customized)
    const background = await jimp.read(path.join(__dirname, '../../assets/rank-card-bg.png'));
    image.composite(background, 0, 0);

    // Add a semi-transparent overlay
    const overlay = new jimp(980, 230, '#00000040');
    image.composite(overlay, 10, 10);

    // Load and composite user avatar
    const avatar = await jimp.read(avatarURL);
    avatar.resize(200, 200);
    avatar.circle();
    image.composite(avatar, 25, 25);

    // Load fonts
    const font32 = await loadFont('open-sans-32-white');
    const font16 = await loadFont('open-sans-16-white');
    const font64 = await loadFont('open-sans-64-white');

    // Print username and discriminator
    image.print(font32, 250, 110, `${username}#${discriminator}`);

    // Print level and rank
    const levelText = `Level ${level}`;
    const rankText = `Rank #${rank}`;
    const levelWidth = jimp.measureText(font64, levelText);
    const rankWidth = jimp.measureText(font32, rankText);

    image.print(font64, 950 - levelWidth, 25, levelText);
    image.print(font32, 950 - rankWidth, 100, rankText);

    // Draw progress bar
    const progressBarWidth = 700;
    const progress = Math.max(0, Math.min(1, currentXp / neededXp));

    const progressBarBg = new jimp(progressBarWidth, 40, '#484b4e');
    image.composite(progressBarBg, 250, 180);

    if (progress > 0) {
        const progressBarFill = new jimp(progressBarWidth * progress, 40, '#1E90FF');
        image.composite(progressBarFill, 250, 180);
    }

    // Print XP text
    const xpText = `${currentXp.toLocaleString()} / ${neededXp.toLocaleString()} XP`;
    const xpWidth = jimp.measureText(font16, xpText);
    image.print(font16, 950 - xpWidth, 160, xpText);

    return image.getBufferAsync(jimp.MIME_PNG);
};

module.exports = { createRankCard }; 