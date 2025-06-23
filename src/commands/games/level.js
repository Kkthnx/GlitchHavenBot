const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const { createRankCard } = require('../../utils/rankCardGenerator');
const logger = require('../../config/logger');

module.exports = {
    name: 'level',
    aliases: ['rank', 'xp'],
    description: 'Displays your level and XP progress as a graphical rank card.',
    usage: 'level [@user]',
    cooldown: 10, // Reduced from 15 to 10 seconds
    guildOnly: true,
    async execute(message, args, client) {
        try {
            await message.channel.sendTyping();

            const targetMember = message.mentions.members.first() || message.member;
            const targetUser = targetMember.user;

            let dbUser = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });

            if (!dbUser) {
                // Create a temporary user object for users not yet in the DB
                dbUser = new User({
                    userId: targetUser.id,
                    guildId: message.guild.id,
                    username: targetUser.username,
                    discriminator: targetUser.discriminator,
                });
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

            const backgroundName = dbUser.preferences.rankCardBackground || 'default';

            const imageBuffer = await createRankCard(rankCardData, backgroundName, targetMember);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'rank-card.png' });

            await message.reply({ files: [attachment] });

        } catch (error) {
            logger.error("Error executing level command:", error);
            return message.reply('❌ An error occurred while fetching level information.');
        }
    }
}; 