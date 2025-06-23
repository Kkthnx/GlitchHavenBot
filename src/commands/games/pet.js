const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Pet = require('../../models/Pet');
const User = require('../../models/User');
const logger = require('../../config/logger');

module.exports = {
    name: 'pet',
    aliases: ['virtualpet', 'companion'],
    description: 'Adopt and care for your virtual pet!',
    usage: 'pet <adopt|feed|play|train|battle|status|shop> [options]',
    cooldown: 10,
    guildOnly: true,
    async execute(message, args, client) {
        const subcommand = args[0]?.toLowerCase();

        switch (subcommand) {
            case 'adopt':
                await handleAdopt(message, args.slice(1));
                break;
            case 'feed':
                await handleFeed(message);
                break;
            case 'play':
                await handlePlay(message);
                break;
            case 'train':
                await handleTrain(message);
                break;
            case 'battle':
                await handleBattle(message, args.slice(1));
                break;
            case 'status':
                await handleStatus(message);
                break;
            case 'shop':
                await handleShop(message);
                break;
            default:
                await showHelp(message);
        }
    }
};

async function handleAdopt(message, options) {
    try {
        // Check if user already has a pet
        const existingPet = await Pet.findOne({
            ownerId: message.author.id,
            guildId: message.guild.id,
            status: 'active'
        });

        if (existingPet) {
            return message.reply('❌ You already have a pet! Use `!pet status` to check on them.');
        }

        // Parse pet type from options
        const petType = options[0]?.toLowerCase() || getRandomPetType();

        // Create new pet
        const pet = new Pet({
            ownerId: message.author.id,
            guildId: message.guild.id,
            name: generatePetName(petType),
            type: petType,
            level: 1,
            experience: 0,
            hunger: 100,
            happiness: 100,
            energy: 100,
            health: 100,
            stats: generatePetStats(petType),
            lastFed: new Date(),
            lastPlayed: new Date(),
            lastTrained: new Date(),
            status: 'active',
            createdAt: new Date()
        });

        await pet.save();

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('🐾 Pet Adopted!')
            .setDescription(`**${message.author.username}** has adopted a new **${petType}**!`)
            .addFields(
                { name: '🐕 Name', value: pet.name, inline: true },
                { name: '🏷️ Type', value: pet.type, inline: true },
                { name: '📊 Level', value: pet.level.toString(), inline: true },
                { name: '🍖 Hunger', value: `${pet.hunger}%`, inline: true },
                { name: '😊 Happiness', value: `${pet.happiness}%`, inline: true },
                { name: '⚡ Energy', value: `${pet.energy}%`, inline: true }
            )
            .setFooter({ text: 'Use !pet feed, !pet play, and !pet train to care for your pet!' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });

    } catch (error) {
        logger.error('Error adopting pet:', error);
        return message.reply('❌ An error occurred while adopting a pet.');
    }
}

async function handleFeed(message) {
    try {
        const pet = await Pet.findOne({
            ownerId: message.author.id,
            guildId: message.guild.id,
            status: 'active'
        });

        if (!pet) {
            return message.reply('❌ You don\'t have a pet! Use `!pet adopt` to get one.');
        }

        // Check cooldown (can feed every 60 minutes)
        const timeSinceLastFed = Date.now() - pet.lastFed.getTime();
        if (timeSinceLastFed < 60 * 60 * 1000) {
            const minutesLeft = Math.ceil((60 * 60 * 1000 - timeSinceLastFed) / (60 * 1000));
            return message.reply(`⏰ ${pet.name} isn't hungry yet! Try again in ${minutesLeft} minutes.`);
        }

        // Feed the pet
        const hungerGain = Math.min(100 - pet.hunger, 30);
        pet.hunger = Math.min(100, pet.hunger + hungerGain);
        pet.happiness = Math.min(100, pet.happiness + 5);
        pet.lastFed = new Date();

        // Add experience
        const expGain = 5;
        pet.experience += expGain;
        const leveledUp = await checkLevelUp(pet);

        await pet.save();

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('🍖 Pet Fed!')
            .setDescription(`**${pet.name}** enjoyed their meal!`)
            .addFields(
                { name: '🍖 Hunger', value: `${pet.hunger}%`, inline: true },
                { name: '😊 Happiness', value: `${pet.happiness}%`, inline: true },
                { name: '⭐ Experience', value: `+${expGain} XP`, inline: true }
            )
            .setTimestamp();

        if (leveledUp) {
            embed.addFields({ name: '🎉 Level Up!', value: `${pet.name} reached level ${pet.level}!`, inline: false });
        }

        await message.reply({ embeds: [embed] });

    } catch (error) {
        logger.error('Error feeding pet:', error);
        return message.reply('❌ An error occurred while feeding your pet.');
    }
}

async function handlePlay(message) {
    try {
        const pet = await Pet.findOne({
            ownerId: message.author.id,
            guildId: message.guild.id,
            status: 'active'
        });

        if (!pet) {
            return message.reply('❌ You don\'t have a pet! Use `!pet adopt` to get one.');
        }

        // Check cooldown (can play every 15 minutes)
        const timeSinceLastPlayed = Date.now() - pet.lastPlayed.getTime();
        if (timeSinceLastPlayed < 15 * 60 * 1000) {
            const minutesLeft = Math.ceil((15 * 60 * 1000 - timeSinceLastPlayed) / (60 * 1000));
            return message.reply(`⏰ ${pet.name} is tired from playing! Try again in ${minutesLeft} minutes.`);
        }

        // Play with the pet
        const happinessGain = Math.min(100 - pet.happiness, 25);
        const energyLoss = Math.max(0, pet.energy - 10);
        pet.happiness = Math.min(100, pet.happiness + happinessGain);
        pet.energy = energyLoss;
        pet.lastPlayed = new Date();

        // Add experience
        const expGain = 8;
        pet.experience += expGain;
        const leveledUp = await checkLevelUp(pet);

        await pet.save();

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('🎾 Play Time!')
            .setDescription(`**${pet.name}** had a great time playing!`)
            .addFields(
                { name: '😊 Happiness', value: `${pet.happiness}%`, inline: true },
                { name: '⚡ Energy', value: `${pet.energy}%`, inline: true },
                { name: '⭐ Experience', value: `+${expGain} XP`, inline: true }
            )
            .setTimestamp();

        if (leveledUp) {
            embed.addFields({ name: '🎉 Level Up!', value: `${pet.name} reached level ${pet.level}!`, inline: false });
        }

        await message.reply({ embeds: [embed] });

    } catch (error) {
        logger.error('Error playing with pet:', error);
        return message.reply('❌ An error occurred while playing with your pet.');
    }
}

async function handleTrain(message) {
    try {
        const pet = await Pet.findOne({
            ownerId: message.author.id,
            guildId: message.guild.id,
            status: 'active'
        });

        if (!pet) {
            return message.reply('❌ You don\'t have a pet! Use `!pet adopt` to get one.');
        }

        // Check cooldown (can train every 60 minutes)
        const timeSinceLastTrained = Date.now() - pet.lastTrained.getTime();
        if (timeSinceLastTrained < 60 * 60 * 1000) {
            const minutesLeft = Math.ceil((60 * 60 * 1000 - timeSinceLastTrained) / (60 * 1000));
            return message.reply(`⏰ ${pet.name} needs rest from training! Try again in ${minutesLeft} minutes.`);
        }

        // Train the pet
        const energyLoss = Math.max(0, pet.energy - 20);
        const statGain = Math.floor(Math.random() * 3) + 1;
        pet.energy = energyLoss;
        pet.stats.attack += statGain;
        pet.lastTrained = new Date();

        // Add experience
        const expGain = 15;
        pet.experience += expGain;
        const leveledUp = await checkLevelUp(pet);

        await pet.save();

        const embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('💪 Training Complete!')
            .setDescription(`**${pet.name}** completed their training!`)
            .addFields(
                { name: '⚔️ Attack', value: `+${statGain} (${pet.stats.attack})`, inline: true },
                { name: '⚡ Energy', value: `${pet.energy}%`, inline: true },
                { name: '⭐ Experience', value: `+${expGain} XP`, inline: true }
            )
            .setTimestamp();

        if (leveledUp) {
            embed.addFields({ name: '🎉 Level Up!', value: `${pet.name} reached level ${pet.level}!`, inline: false });
        }

        await message.reply({ embeds: [embed] });

    } catch (error) {
        logger.error('Error training pet:', error);
        return message.reply('❌ An error occurred while training your pet.');
    }
}

async function handleBattle(message, args) {
    try {
        const pet = await Pet.findOne({
            ownerId: message.author.id,
            guildId: message.guild.id,
            status: 'active'
        });

        if (!pet) {
            return message.reply('❌ You don\'t have a pet! Use `!pet adopt` to get one.');
        }

        if (pet.energy < 30) {
            return message.reply(`❌ ${pet.name} is too tired to battle! They need at least 30% energy.`);
        }

        // Find opponent
        const targetUser = message.mentions.users.first();
        if (!targetUser) {
            return message.reply('❌ Please mention a user to battle against!');
        }

        const opponentPet = await Pet.findOne({
            ownerId: targetUser.id,
            guildId: message.guild.id,
            status: 'active'
        });

        if (!opponentPet) {
            return message.reply('❌ That user doesn\'t have a pet to battle!');
        }

        if (opponentPet.energy < 30) {
            return message.reply(`❌ ${opponentPet.name} is too tired to battle!`);
        }

        // Battle logic
        const battleResult = simulateBattle(pet, opponentPet);

        // Update pets
        pet.energy = Math.max(0, pet.energy - 30);
        opponentPet.energy = Math.max(0, opponentPet.energy - 30);

        if (battleResult.winner === pet) {
            pet.experience += 20;
            opponentPet.experience += 5;
        } else {
            opponentPet.experience += 20;
            pet.experience += 5;
        }

        await Promise.all([pet.save(), opponentPet.save()]);

        const embed = new EmbedBuilder()
            .setColor(battleResult.winner === pet ? 0x2ECC71 : 0xE74C3C)
            .setTitle('⚔️ Battle Result!')
            .setDescription(battleResult.description)
            .addFields(
                { name: '🏆 Winner', value: battleResult.winner.name, inline: true },
                { name: '💔 Loser', value: battleResult.loser.name, inline: true },
                { name: '⭐ Experience', value: `Winner: +20 XP, Loser: +5 XP`, inline: false }
            )
            .setTimestamp();

        await message.reply({ embeds: [embed] });

    } catch (error) {
        logger.error('Error in pet battle:', error);
        return message.reply('❌ An error occurred during the battle.');
    }
}

async function handleStatus(message) {
    try {
        const pet = await Pet.findOne({
            ownerId: message.author.id,
            guildId: message.guild.id,
            status: 'active'
        });

        if (!pet) {
            return message.reply('❌ You don\'t have a pet! Use `!pet adopt` to get one.');
        }

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle(`🐾 ${pet.name}'s Status`)
            .setDescription(`A level ${pet.level} ${pet.type}`)
            .addFields(
                {
                    name: '📊 Stats', value: [
                        `⚔️ Attack: ${pet.stats.attack}`,
                        `🛡️ Defense: ${pet.stats.defense}`,
                        `💨 Speed: ${pet.stats.speed}`,
                        `❤️ Health: ${pet.stats.health}`
                    ].join('\n'), inline: true
                },
                {
                    name: '💚 Status', value: [
                        `🍖 Hunger: ${pet.hunger}%`,
                        `😊 Happiness: ${pet.happiness}%`,
                        `⚡ Energy: ${pet.energy}%`,
                        `❤️ Health: ${pet.health}%`
                    ].join('\n'), inline: true
                },
                {
                    name: '📈 Progress', value: [
                        `⭐ Level: ${pet.level}`,
                        `📊 Experience: ${pet.experience}/${getExpForLevel(pet.level + 1)}`,
                        `🎯 Next Level: ${getExpForLevel(pet.level + 1) - pet.experience} XP needed`
                    ].join('\n'), inline: false
                }
            )
            .setFooter({ text: 'Use !pet feed, !pet play, and !pet train to care for your pet!' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });

    } catch (error) {
        logger.error('Error showing pet status:', error);
        return message.reply('❌ An error occurred while fetching pet status.');
    }
}

async function handleShop(message) {
    const embed = new EmbedBuilder()
        .setColor(0xF39C12)
        .setTitle('🏪 Pet Shop')
        .setDescription('Available pet types to adopt:')
        .addFields(
            { name: '🐕 Dog', value: 'Loyal and friendly companion', inline: true },
            { name: '🐱 Cat', value: 'Independent and agile friend', inline: true },
            { name: '🐰 Rabbit', value: 'Quick and energetic pet', inline: true },
            { name: '🦜 Parrot', value: 'Colorful and intelligent bird', inline: true },
            { name: '🐢 Turtle', value: 'Slow but steady companion', inline: true },
            { name: '🐸 Frog', value: 'Jumping and aquatic friend', inline: true }
        )
        .setFooter({ text: 'Use !pet adopt <type> to adopt a pet!' })
        .setTimestamp();

    await message.reply({ embeds: [embed] });
}

async function showHelp(message) {
    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('🐾 Virtual Pet System')
        .setDescription('Adopt and care for your very own virtual pet!')
        .addFields(
            {
                name: '🎮 Commands', value: [
                    '`!pet adopt [type]` - Adopt a new pet',
                    '`!pet feed` - Feed your pet (60min cooldown)',
                    '`!pet play` - Play with your pet (15min cooldown)',
                    '`!pet train` - Train your pet (60min cooldown)',
                    '`!pet battle @user` - Battle another pet',
                    '`!pet status` - Check your pet\'s status',
                    '`!pet shop` - See available pet types'
                ].join('\n'), inline: false
            },
            {
                name: '🎯 How to Play', value: [
                    '1. Adopt a pet of your choice',
                    '2. Feed, play, and train regularly',
                    '3. Battle other pets to gain experience',
                    '4. Level up and improve your pet\'s stats!'
                ].join('\n'), inline: false
            }
        )
        .setFooter({ text: 'Take good care of your virtual companion!' })
        .setTimestamp();

    await message.reply({ embeds: [embed] });
}

// Helper functions
function getRandomPetType() {
    const types = ['dog', 'cat', 'rabbit', 'parrot', 'turtle', 'frog'];
    return types[Math.floor(Math.random() * types.length)];
}

function generatePetName(type) {
    const names = {
        dog: ['Buddy', 'Max', 'Luna', 'Charlie', 'Bella', 'Rocky'],
        cat: ['Whiskers', 'Shadow', 'Mittens', 'Tiger', 'Luna', 'Oliver'],
        rabbit: ['Bunny', 'Hoppy', 'Cotton', 'Thumper', 'Snowball', 'Carrot'],
        parrot: ['Rio', 'Polly', 'Squawk', 'Rainbow', 'Captain', 'Echo'],
        turtle: ['Shelly', 'Crush', 'Slowpoke', 'Tank', 'Squirtle', 'Leonardo'],
        frog: ['Ribbit', 'Kermit', 'Leap', 'Croak', 'Greenie', 'Pond']
    };

    const typeNames = names[type] || names.dog;
    return typeNames[Math.floor(Math.random() * typeNames.length)];
}

function generatePetStats(type) {
    const baseStats = {
        dog: { attack: 8, defense: 6, speed: 7, health: 80 },
        cat: { attack: 6, defense: 5, speed: 9, health: 70 },
        rabbit: { attack: 5, defense: 4, speed: 10, health: 60 },
        parrot: { attack: 7, defense: 4, speed: 8, health: 65 },
        turtle: { attack: 4, defense: 10, speed: 3, health: 90 },
        frog: { attack: 6, defense: 5, speed: 8, health: 65 }
    };

    return baseStats[type] || baseStats.dog;
}

function getExpForLevel(level) {
    return level * 100;
}

async function checkLevelUp(pet) {
    const expNeeded = getExpForLevel(pet.level + 1);
    if (pet.experience >= expNeeded) {
        pet.level += 1;
        pet.stats.attack += 2;
        pet.stats.defense += 2;
        pet.stats.speed += 1;
        pet.stats.health += 10;
        return true;
    }
    return false;
}

function simulateBattle(pet1, pet2) {
    const power1 = pet1.stats.attack + pet1.stats.speed + (pet1.level * 2);
    const power2 = pet2.stats.attack + pet2.stats.speed + (pet2.level * 2);

    // Add some randomness
    const roll1 = power1 + Math.floor(Math.random() * 20);
    const roll2 = power2 + Math.floor(Math.random() * 20);

    if (roll1 > roll2) {
        return {
            winner: pet1,
            loser: pet2,
            description: `${pet1.name} defeated ${pet2.name} in an epic battle!`
        };
    } else {
        return {
            winner: pet2,
            loser: pet1,
            description: `${pet2.name} defeated ${pet1.name} in an epic battle!`
        };
    }
}