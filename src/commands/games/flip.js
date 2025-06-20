const { EmbedBuilder } = require('discord.js');
const User = require('../../models/User');
const Guild = require('../../models/Guild');
const { formatRelativeTime } = require('../../utils/helpers');
const logger = require('../../utils/logger');

module.exports = {
    name: 'flip',
    aliases: ['coinflip', 'cf'],
    description: 'Flip a coin and test your luck!',
    usage: 'flip',
    cooldown: 30,
    async execute(message, args, client) {
        try {
            // Get guild settings
            const guild = await Guild.findOne({ guildId: message.guild.id });
            if (!guild || !guild.games.coinFlip.enabled) {
                return message.reply('❌ Coin flipping is disabled in this server.');
            }

            // Check cooldown
            const user = await User.findOne({ userId: message.author.id, guildId: message.guild.id });
            if (!user) {
                return message.reply('❌ User data not found. Please try again.');
            }

            const now = Date.now();
            const cooldownTime = guild.games.coinFlip.cooldown * 1000;

            if (user.gameStats.lastFlip && (now - user.gameStats.lastFlip.getTime()) < cooldownTime) {
                const timeLeft = Math.ceil((cooldownTime - (now - user.gameStats.lastFlip.getTime())) / 1000);
                return message.reply(`⏰ Please wait ${timeLeft} seconds before flipping again.`);
            }

            // Flip the coin
            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            const won = result === 'heads'; // Heads is considered a win

            // Update user statistics
            await user.recordCoinFlip(won);

            // Award XP for playing the game
            let xpAwarded = 10; // Base XP for playing
            let xpReason = 'Playing coin flip';

            if (won) {
                xpAwarded += 15; // Bonus XP for winning
                xpReason = 'Winning coin flip';
            }

            // Award XP and check for level up
            const xpResult = await user.addXP(xpAwarded, xpReason);

            // Create result embed
            const flipEmbed = new EmbedBuilder()
                .setColor(won ? 0x00FF00 : 0xFF0000)
                .setTitle(`🪙 Coin Flip Result`)
                .setDescription(`The coin landed on **${result.toUpperCase()}**!`)
                .addFields(
                    { name: '🎯 Result', value: won ? '🎉 **You won!**' : '😔 **You lost!**', inline: true },
                    { name: '📊 Your Stats', value: getStatsText(user.gameStats.coinFlips), inline: true },
                    { name: '🔥 Current Streak', value: `${user.gameStats.coinFlips.streak}`, inline: true },
                    { name: '⭐ XP Gained', value: `+${xpAwarded} XP`, inline: true }
                )
                .setFooter({ text: `Flipped by ${message.author.tag}` })
                .setTimestamp();

            // Add streak reward message if applicable
            if (guild.games.coinFlip.streakRewards && user.gameStats.coinFlips.streak > 0) {
                const streakMessage = getStreakMessage(user.gameStats.coinFlips.streak);
                if (streakMessage) {
                    flipEmbed.addFields({ name: '🏆 Streak Bonus', value: streakMessage, inline: false });
                }
            }

            // Add special messages for milestones
            const milestoneMessage = getMilestoneMessage(user.gameStats.coinFlips);
            if (milestoneMessage) {
                flipEmbed.addFields({ name: '🎊 Milestone!', value: milestoneMessage, inline: false });
            }

            await message.reply({ embeds: [flipEmbed] });

            // Send level up message if user leveled up
            if (xpResult.leveledUp) {
                const levelUpEmbed = {
                    color: 0x00FF00,
                    title: '🎉 Level Up!',
                    description: `Congratulations ${message.author}! You've reached **Level ${xpResult.newLevel}**!`,
                    fields: [
                        {
                            name: 'Level Progress',
                            value: `**${xpResult.oldLevel}** → **${xpResult.newLevel}**`,
                            inline: true
                        },
                        {
                            name: 'XP Gained',
                            value: `+${xpResult.xpGained} XP (${xpReason})`,
                            inline: true
                        }
                    ],
                    thumbnail: {
                        url: message.author.displayAvatarURL({ dynamic: true })
                    },
                    timestamp: new Date()
                };

                // Send level up message
                message.channel.send({ embeds: [levelUpEmbed] }).catch(() => {
                    // If we can't send to the channel, try DM
                    message.author.send({ embeds: [levelUpEmbed] }).catch(() => { });
                });
            }

        } catch (error) {
            logger.error('Error in flip command:', error);
            return message.reply('❌ An error occurred while processing the coin flip.');
        }
    }
};

function getStatsText(stats) {
    const winRate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : '0.0';
    return `**Total:** ${stats.total}\n**Wins:** ${stats.wins}\n**Rate:** ${winRate}%`;
}

function getStreakMessage(streak) {
    const streakMessages = {
        3: '🔥 **3 in a row!** You\'re on fire!',
        5: '🔥🔥 **5 in a row!** Incredible streak!',
        7: '🔥🔥🔥 **7 in a row!** Unstoppable!',
        10: '🔥🔥🔥🔥 **10 in a row!** Legendary!',
        15: '🔥🔥🔥🔥🔥 **15 in a row!** Godlike!',
        20: '🔥🔥🔥🔥🔥🔥 **20 in a row!** The chosen one!'
    };

    return streakMessages[streak] || null;
}

function getMilestoneMessage(stats) {
    const milestones = {
        10: '🎉 **10 flips completed!** You\'re getting the hang of this!',
        25: '🎉 **25 flips completed!** You\'re a regular flipper!',
        50: '🎉 **50 flips completed!** Halfway to 100!',
        100: '🎉 **100 flips completed!** Centurion!',
        250: '🎉 **250 flips completed!** Quarter master!',
        500: '🎉 **500 flips completed!** Flipping master!',
        1000: '🎉 **1000 flips completed!** Ultimate flipper!'
    };

    return milestones[stats.total] || null;
} 