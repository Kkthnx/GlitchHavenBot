const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Adventure = require('../../models/Adventure');
const logger = require('../../config/logger');

module.exports = {
    name: 'adventure',
    aliases: ['story', 'quest'],
    description: 'Start or participate in a collaborative text-based adventure!',
    usage: '!adventure <start|join|vote|status> [options]',
    cooldown: 10,
    guildOnly: true,
    async execute(message, args, client) {
        const subcommand = args[0]?.toLowerCase();

        switch (subcommand) {
            case 'start':
                await handleStart(message, args.slice(1));
                break;
            case 'join':
                await handleJoin(message);
                break;
            case 'vote':
                await handleVote(message, args.slice(1));
                break;
            case 'status':
                await handleStatus(message);
                break;
            default:
                await showHelp(message);
        }
    }
};

async function handleStart(message, options) {
    try {
        // Check if there's already an active adventure
        const existingAdventure = await Adventure.findOne({
            guildId: message.guild.id,
            status: 'active'
        });

        if (existingAdventure) {
            return message.reply('❌ There\'s already an active adventure! Use `!adventure status` to see the current story.');
        }

        // Parse theme from options
        const theme = options.join(' ') || 'fantasy';

        // Create new adventure
        const adventure = new Adventure({
            guildId: message.guild.id,
            channelId: message.channel.id,
            creatorId: message.author.id,
            theme: theme,
            participants: [message.author.id],
            currentChapter: 1,
            story: generateInitialStory(theme),
            choices: generateChoices(theme),
            votes: {},
            status: 'active',
            createdAt: new Date()
        });

        await adventure.save();

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('🏰 Adventure Begins!')
            .setDescription(`**${message.author.username}** has started a new **${theme}** adventure!`)
            .addFields(
                { name: '📖 Current Story', value: adventure.story, inline: false },
                { name: '🎯 Your Choices', value: formatChoices(adventure.choices), inline: false },
                { name: '👥 Participants', value: '1 player', inline: true },
                { name: '📝 Chapter', value: '1', inline: true }
            )
            .setFooter({ text: 'Use !adventure join to participate, !adventure vote <choice> to vote!' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('adventure-join')
                    .setLabel('Join Adventure')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⚔️'),
                new ButtonBuilder()
                    .setCustomId('adventure-vote-1')
                    .setLabel('Choice 1')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('adventure-vote-2')
                    .setLabel('Choice 2')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('adventure-vote-3')
                    .setLabel('Choice 3')
                    .setStyle(ButtonStyle.Secondary)
            );

        await message.reply({ embeds: [embed], components: [row] });

    } catch (error) {
        logger.error('Error starting adventure:', error);
        return message.reply('❌ An error occurred while starting the adventure.');
    }
}

async function handleJoin(message) {
    try {
        const adventure = await Adventure.findOne({
            guildId: message.guild.id,
            status: 'active'
        });

        if (!adventure) {
            return message.reply('❌ No active adventure found. Use `!adventure start` to begin one!');
        }

        if (adventure.participants.includes(message.author.id)) {
            return message.reply('❌ You\'re already participating in this adventure!');
        }

        adventure.participants.push(message.author.id);
        await adventure.save();

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('🎉 Adventure Joined!')
            .setDescription(`**${message.author.username}** has joined the adventure!`)
            .addFields(
                { name: '👥 Total Participants', value: adventure.participants.length.toString(), inline: true },
                { name: '📖 Current Story', value: adventure.story, inline: false }
            )
            .setFooter({ text: 'Use !adventure vote <choice> to help decide the story!' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });

    } catch (error) {
        logger.error('Error joining adventure:', error);
        return message.reply('❌ An error occurred while joining the adventure.');
    }
}

async function handleVote(message, choiceArgs) {
    try {
        const adventure = await Adventure.findOne({
            guildId: message.guild.id,
            status: 'active'
        });

        if (!adventure) {
            return message.reply('❌ No active adventure found.');
        }

        if (!adventure.participants.includes(message.author.id)) {
            return message.reply('❌ You need to join the adventure first! Use `!adventure join`');
        }

        const choice = parseInt(choiceArgs[0]);
        if (!choice || choice < 1 || choice > adventure.choices.length) {
            return message.reply(`❌ Please vote for a valid choice (1-${adventure.choices.length}).`);
        }

        // Record vote
        adventure.votes[message.author.id] = choice;
        await adventure.save();

        // Check if we have enough votes to progress
        const voteCounts = {};
        Object.values(adventure.votes).forEach(vote => {
            voteCounts[vote] = (voteCounts[vote] || 0) + 1;
        });

        const totalVotes = Object.keys(adventure.votes).length;
        const participants = adventure.participants.length;

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('🗳️ Vote Cast!')
            .setDescription(`**${message.author.username}** voted for: **${adventure.choices[choice - 1]}**`)
            .addFields(
                { name: '📊 Vote Progress', value: `${totalVotes}/${participants} votes cast`, inline: true },
                { name: '⏰ Status', value: totalVotes >= Math.ceil(participants * 0.5) ? 'Ready to progress!' : 'Waiting for more votes...', inline: true }
            )
            .setTimestamp();

        await message.reply({ embeds: [embed] });

        // If we have enough votes, progress the story
        if (totalVotes >= Math.ceil(participants * 0.5)) {
            await progressStory(adventure, message.channel);
        }

    } catch (error) {
        logger.error('Error voting in adventure:', error);
        return message.reply('❌ An error occurred while voting.');
    }
}

async function handleStatus(message) {
    try {
        const adventure = await Adventure.findOne({
            guildId: message.guild.id,
            status: 'active'
        });

        if (!adventure) {
            return message.reply('❌ No active adventure found. Use `!adventure start` to begin one!');
        }

        const voteCounts = {};
        Object.values(adventure.votes).forEach(vote => {
            voteCounts[vote] = (voteCounts[vote] || 0) + 1;
        });

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('📖 Adventure Status')
            .setDescription(`**${adventure.theme}** Adventure - Chapter ${adventure.currentChapter}`)
            .addFields(
                { name: '📖 Current Story', value: adventure.story, inline: false },
                { name: '🎯 Available Choices', value: formatChoices(adventure.choices), inline: false },
                { name: '👥 Participants', value: adventure.participants.length.toString(), inline: true },
                { name: '🗳️ Votes Cast', value: Object.keys(adventure.votes).length.toString(), inline: true },
                { name: '📊 Vote Results', value: formatVoteResults(voteCounts, adventure.choices), inline: false }
            )
            .setFooter({ text: 'Use !adventure vote <choice> to vote!' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });

    } catch (error) {
        logger.error('Error showing adventure status:', error);
        return message.reply('❌ An error occurred while fetching adventure status.');
    }
}

async function showHelp(message) {
    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('🏰 Adventure Game Help')
        .setDescription('Embark on collaborative storytelling adventures with your server!')
        .addFields(
            {
                name: '🎮 Commands', value: [
                    '`!adventure start [theme]` - Start a new adventure',
                    '`!adventure join` - Join the current adventure',
                    '`!adventure vote <choice>` - Vote for story direction',
                    '`!adventure status` - Check current adventure status'
                ].join('\n'), inline: false
            },
            {
                name: '🎯 How to Play', value: [
                    '1. Someone starts an adventure with a theme',
                    '2. Players join and vote on story choices',
                    '3. When enough votes are cast, the story progresses',
                    '4. Continue until the adventure reaches its conclusion!'
                ].join('\n'), inline: false
            },
            { name: '🎨 Themes', value: 'Fantasy, Sci-Fi, Mystery, Horror, Comedy, and more!' }
        )
        .setFooter({ text: 'Create epic stories together!' })
        .setTimestamp();

    await message.reply({ embeds: [embed] });
}

async function progressStory(adventure, channel) {
    try {
        // Determine winning choice
        const voteCounts = {};
        Object.values(adventure.votes).forEach(vote => {
            voteCounts[vote] = (voteCounts[vote] || 0) + 1;
        });

        const winningChoice = parseInt(Object.keys(voteCounts).reduce((a, b) =>
            voteCounts[a] > voteCounts[b] ? a : b
        ));

        // Generate next story chapter
        const nextStory = generateNextStory(adventure.theme, winningChoice, adventure.currentChapter);
        adventure.story = nextStory;
        adventure.currentChapter++;
        adventure.choices = generateChoices(adventure.theme);
        adventure.votes = {};

        // Check if adventure should end
        if (adventure.currentChapter > 5) {
            adventure.status = 'completed';
            await adventure.save();

            const endEmbed = new EmbedBuilder()
                .setColor(0xF39C12)
                .setTitle('🏁 Adventure Complete!')
                .setDescription(`The **${adventure.theme}** adventure has reached its conclusion!`)
                .addFields(
                    { name: '📖 Final Chapter', value: adventure.story, inline: false },
                    { name: '👥 Participants', value: adventure.participants.length.toString(), inline: true },
                    { name: '📝 Total Chapters', value: adventure.currentChapter.toString(), inline: true }
                )
                .setFooter({ text: 'Thanks for playing! Start a new adventure anytime!' })
                .setTimestamp();

            await channel.send({ embeds: [endEmbed] });
            return;
        }

        await adventure.save();

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('📖 Story Progress!')
            .setDescription(`The community chose: **${adventure.choices[winningChoice - 1]}**`)
            .addFields(
                { name: '📖 New Chapter', value: adventure.story, inline: false },
                { name: '🎯 New Choices', value: formatChoices(adventure.choices), inline: false },
                { name: '📝 Chapter', value: adventure.currentChapter.toString(), inline: true }
            )
            .setFooter({ text: 'Vote again to continue the story!' })
            .setTimestamp();

        await channel.send({ embeds: [embed] });

    } catch (error) {
        logger.error('Error progressing story:', error);
    }
}

function generateInitialStory(theme) {
    const stories = {
        fantasy: "You find yourself at the entrance of an ancient forest. The trees whisper secrets of forgotten magic, and a mysterious light flickers in the distance. Three paths lie before you...",
        scifi: "Your spaceship has crash-landed on an unknown planet. The air is breathable, but strange sounds echo from the alien landscape. Your survival depends on your next choice...",
        mystery: "A detective's office in the dead of night. A mysterious client has left an envelope with three cryptic clues. Each leads to a different aspect of the case...",
        horror: "You wake up in an abandoned mansion. The air is thick with dread, and you hear distant footsteps. Three doors stand before you, each hiding different terrors...",
        comedy: "You're a clumsy wizard who just graduated from magic school. Your first day on the job, and you've already turned your boss into a frog. Now you need to fix this...",
        western: "The dusty town of Deadwood Gulch stretches before you. A wanted poster catches your eye, and three different leads promise to bring justice to the lawless frontier..."
    };

    return stories[theme] || stories.fantasy;
}

function generateChoices(theme) {
    const choiceSets = {
        fantasy: [
            "Follow the glowing light deeper into the forest",
            "Climb the tallest tree to get a better view",
            "Search for ancient runes on the ground"
        ],
        scifi: [
            "Investigate the source of the strange sounds",
            "Search the crashed ship for supplies",
            "Set up a defensive perimeter"
        ],
        mystery: [
            "Follow the first clue to the old library",
            "Investigate the second clue at the docks",
            "Check the third clue in the abandoned warehouse"
        ],
        horror: [
            "Open the door with the red handle",
            "Try the door with the brass knob",
            "Break down the door with no handle"
        ],
        comedy: [
            "Try to reverse the spell with a rhyming incantation",
            "Look up the solution in your spellbook",
            "Ask the frog for forgiveness and hope for the best"
        ],
        western: [
            "Follow the trail to the saloon",
            "Check the sheriff's office for information",
            "Ask around at the general store"
        ]
    };

    return choiceSets[theme] || choiceSets.fantasy;
}

function generateNextStory(theme, choice, chapter) {
    // This would be expanded with more complex story generation
    const storyTemplates = {
        fantasy: [
            "The light leads you to a clearing where an ancient dragon slumbers. Its scales shimmer with magical energy...",
            "From the treetop, you spot a hidden village of elves. They seem to be preparing for a great celebration...",
            "The runes glow with power, revealing a hidden passage beneath your feet..."
        ],
        scifi: [
            "The sounds lead you to a crashed alien vessel. Inside, you find advanced technology beyond human understanding...",
            "The ship's cargo hold contains mysterious artifacts and a working communication device...",
            "Your perimeter reveals that this planet is not as uninhabited as it first appeared..."
        ]
    };

    const templates = storyTemplates[theme] || storyTemplates.fantasy;
    return templates[choice - 1] || "The story continues with new challenges and discoveries...";
}

function formatChoices(choices) {
    return choices.map((choice, index) => `${index + 1}. ${choice}`).join('\n');
}

function formatVoteResults(voteCounts, choices) {
    if (Object.keys(voteCounts).length === 0) return 'No votes cast yet';

    return Object.entries(voteCounts)
        .map(([choice, count]) => `${choice}. ${choices[choice - 1]}: ${count} votes`)
        .join('\n');
} 