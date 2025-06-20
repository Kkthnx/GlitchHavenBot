const { AttachmentBuilder } = require('discord.js');
const User = require('../../models/User');
const { createRankCard } = require('../../utils/rankCardGenerator');
const logger = require('../../utils/logger');

module.exports = {
    name: 'level',
    aliases: ['rank', 'xp'],
    description: 'Displays your level and XP progress as a graphical rank card.',
    usage: 'level [@user]',
    cooldown: 15, // Increased cooldown due to image generation
    guildOnly: true,
    async execute(message, args, client) {
        try {
            await message.channel.sendTyping();

            const targetUser = message.mentions.users.first() || message.author;

            const dbUser = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });

            if (!dbUser || dbUser.leveling.level < 1) {
                const isSelf = targetUser.id === message.author.id;
                return message.reply(isSelf ? "You haven't earned any XP yet! Start chatting to gain levels." : "This user hasn't earned any XP yet.");
            }

            // Get user's rank
            const rank = await User.find({
                'leveling.totalXp': { $gt: dbUser.leveling.totalXp },
                guildId: message.guild.id
            }).countDocuments() + 1;

            const progress = dbUser.getLevelProgress();

            const rankCardData = {
                avatarURL: targetUser.displayAvatarURL({ extension: 'png', size: 256 }),
                username: targetUser.username,
                discriminator: targetUser.discriminator,
                level: progress.currentLevel,
                rank: rank,
                currentXp: progress.xpInCurrentLevel,
                neededXp: progress.xpNeededForNextLevel
            };

            const imageBuffer = await createRankCard(rankCardData);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'rank-card.png' });

            await message.reply({ files: [attachment] });

        } catch (error) {
            logger.error("Error executing level command:", error);
            return message.reply('❌ An error occurred while fetching level information.');
        }
    }
}; 