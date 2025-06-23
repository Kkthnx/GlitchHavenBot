const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const TurnGame = require('../../models/TurnGame');
const logger = require('../../config/logger');

module.exports = {
    name: 'turn',
    aliases: ['turngame', 'game'],
    description: 'Manage turn-based games and notify players of their turns!',
    usage: 'turn <create|join|start|next|skip|end|status|list> [options]',
    cooldown: 10,
    guildOnly: true,
    async execute(message, args, client) {
        const subcommand = args[0]?.toLowerCase();

        switch (subcommand) {
            case 'create':
                await handleCreate(message, args.slice(1));
                break;
            case 'join':
                await handleJoin(message, args.slice(1));
                break;
            case 'start':
                await handleStart(message, args.slice(1));
                break;
            case 'next':
                await handleNext(message, args.slice(1));
                break;
            case 'skip':
                await handleSkip(message, args.slice(1));
                break;
            case 'end':
                await handleEnd(message, args.slice(1));
                break;
            case 'status':
                await handleStatus(message, args.slice(1));
                break;
            case 'list':
                await handleList(message);
                break;
            default:
                await showHelp(message);
        }
    }
};

async function handleCreate(message, options) {
    try {
        if (options.length < 2) {
            return message.reply('❌ Please provide a game name and max players. Usage: `!turn create <game_name> <max_players>`');
        }

        const gameName = options[0];
        const maxPlayers = parseInt(options[1]);

        if (isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 10) {
            return message.reply('❌ Max players must be between 2 and 10.');
        }

        // Check if user already has an active game
        const existingGame = await TurnGame.findOne({
            guildId: message.guild.id,
            creatorId: message.author.id,
            status: 'active'
        });

        if (existingGame) {
            return message.reply('❌ You already have an active game! Use `!turn end` to end it first.');
        }

        // Create new game
        const game = new TurnGame({
            guildId: message.guild.id,
            channelId: message.channel.id,
            creatorId: message.author.id,
            name: gameName,
            maxPlayers: maxPlayers,
            players: [{
                userId: message.author.id,
                username: message.author.username,
                joinedAt: new Date()
            }],
            currentTurn: 0,
            turnOrder: [message.author.id],
            status: 'waiting',
            createdAt: new Date()
        });

        await game.save();

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('🎮 Game Created!')
            .setDescription(`**${message.author.username}** created a new game: **${gameName}**`)
            .addFields(
                { name: '👥 Players', value: `1/${maxPlayers}`, inline: true },
                { name: '📊 Status', value: 'Waiting for players', inline: true },
                { name: '🎯 Game Type', value: 'Turn-based', inline: true }
            )
            .setFooter({ text: 'Use !turn join <game_id> to join, !turn start to begin!' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`turn-join-${game._id}`)
                    .setLabel('Join Game')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎮'),
                new ButtonBuilder()
                    .setCustomId(`turn-start-${game._id}`)
                    .setLabel('Start Game')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('▶️')
            );

        await message.reply({ embeds: [embed], components: [row] });

    } catch (error) {
        logger.error('Error creating turn game:', error);
        return message.reply('❌ An error occurred while creating the game.');
    }
}

async function handleJoin(message, args) {
    try {
        const gameId = args[0];
        if (!gameId) {
            return message.reply('❌ Please provide a game ID. Use `!turn list` to see available games.');
        }

        const game = await TurnGame.findById(gameId);
        if (!game || game.guildId !== message.guild.id) {
            return message.reply('❌ Game not found.');
        }

        if (game.status !== 'waiting') {
            return message.reply('❌ This game has already started or ended.');
        }

        if (game.players.length >= game.maxPlayers) {
            return message.reply('❌ This game is full.');
        }

        if (game.players.some(p => p.userId === message.author.id)) {
            return message.reply('❌ You\'re already in this game.');
        }

        // Add player to game
        game.players.push({
            userId: message.author.id,
            username: message.author.username,
            joinedAt: new Date()
        });
        game.turnOrder.push(message.author.id);

        await game.save();

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('🎮 Player Joined!')
            .setDescription(`**${message.author.username}** joined **${game.name}**!`)
            .addFields(
                { name: '👥 Players', value: `${game.players.length}/${game.maxPlayers}`, inline: true },
                { name: '📊 Status', value: game.players.length >= 2 ? 'Ready to start!' : 'Waiting for more players', inline: true }
            )
            .setTimestamp();

        await message.reply({ embeds: [embed] });

    } catch (error) {
        logger.error('Error joining turn game:', error);
        return message.reply('❌ An error occurred while joining the game.');
    }
}

async function handleStart(message, args) {
    try {
        const gameId = args[0];
        let game;

        if (gameId) {
            game = await TurnGame.findById(gameId);
        } else {
            game = await TurnGame.findOne({
                guildId: message.guild.id,
                creatorId: message.author.id,
                status: 'waiting'
            });
        }

        if (!game || game.guildId !== message.guild.id) {
            return message.reply('❌ No waiting game found.');
        }

        if (game.creatorId !== message.author.id) {
            return message.reply('❌ Only the game creator can start the game.');
        }

        if (game.players.length < 2) {
            return message.reply('❌ Need at least 2 players to start the game.');
        }

        // Shuffle turn order
        game.turnOrder = shuffleArray([...game.turnOrder]);
        game.status = 'active';
        game.currentTurn = 0;
        game.startedAt = new Date();

        await game.save();

        const currentPlayer = game.players.find(p => p.userId === game.turnOrder[0]);
        const currentMember = await message.guild.members.fetch(currentPlayer.userId);

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('🎮 Game Started!')
            .setDescription(`**${game.name}** is now active!`)
            .addFields(
                { name: '👥 Players', value: game.players.map(p => p.username).join(', '), inline: false },
                { name: '🎯 Current Turn', value: `**${currentPlayer.username}**`, inline: true },
                {
                    name: '📊 Turn Order', value: game.turnOrder.map((id, index) => {
                        const player = game.players.find(p => p.userId === id);
                        return `${index + 1}. ${player.username}`;
                    }).join('\n'), inline: false
                }
            )
            .setFooter({ text: 'Use !turn next to advance turns, !turn skip to skip a player' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });

        // Notify current player
        try {
            await currentMember.send(`🎮 It's your turn in **${game.name}**! Check the game channel.`);
        } catch (dmError) {
            // User has DMs disabled, that's okay
        }

    } catch (error) {
        logger.error('Error starting turn game:', error);
        return message.reply('❌ An error occurred while starting the game.');
    }
}

async function handleNext(message, args) {
    try {
        const gameId = args[0];
        let game;

        if (gameId) {
            game = await TurnGame.findById(gameId);
        } else {
            game = await TurnGame.findOne({
                guildId: message.guild.id,
                status: 'active'
            });
        }

        if (!game || game.guildId !== message.guild.id) {
            return message.reply('❌ No active game found.');
        }

        if (game.status !== 'active') {
            return message.reply('❌ This game is not active.');
        }

        // Advance to next turn
        game.currentTurn = (game.currentTurn + 1) % game.turnOrder.length;
        game.turnCount = (game.turnCount || 0) + 1;
        game.lastTurnAt = new Date();

        await game.save();

        const currentPlayerId = game.turnOrder[game.currentTurn];
        const currentPlayer = game.players.find(p => p.userId === currentPlayerId);
        const currentMember = await message.guild.members.fetch(currentPlayerId);

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('🔄 Turn Advanced!')
            .setDescription(`**${game.name}** - Turn ${game.turnCount}`)
            .addFields(
                { name: '🎯 Current Player', value: `**${currentPlayer.username}**`, inline: true },
                { name: '👥 Total Players', value: game.players.length.toString(), inline: true },
                {
                    name: '📊 Turn Order', value: game.turnOrder.map((id, index) => {
                        const player = game.players.find(p => p.userId === id);
                        const isCurrent = index === game.currentTurn;
                        return `${isCurrent ? '▶️' : '⏸️'} ${player.username}${isCurrent ? ' (Current)' : ''}`;
                    }).join('\n'), inline: false
                }
            )
            .setFooter({ text: 'Use !turn next to advance, !turn skip to skip a player' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });

        // Notify current player
        try {
            await currentMember.send(`🎮 It's your turn in **${game.name}**! Check the game channel.`);
        } catch (dmError) {
            // User has DMs disabled, that's okay
        }

    } catch (error) {
        logger.error('Error advancing turn:', error);
        return message.reply('❌ An error occurred while advancing the turn.');
    }
}

async function handleSkip(message, args) {
    try {
        const gameId = args[0];
        let game;

        if (gameId) {
            game = await TurnGame.findById(gameId);
        } else {
            game = await TurnGame.findOne({
                guildId: message.guild.id,
                status: 'active'
            });
        }

        if (!game || game.guildId !== message.guild.id) {
            return message.reply('❌ No active game found.');
        }

        if (game.status !== 'active') {
            return message.reply('❌ This game is not active.');
        }

        const currentPlayerId = game.turnOrder[game.currentTurn];
        const currentPlayer = game.players.find(p => p.userId === currentPlayerId);

        // Skip current player
        game.currentTurn = (game.currentTurn + 1) % game.turnOrder.length;
        game.turnCount = (game.turnCount || 0) + 1;
        game.lastTurnAt = new Date();

        await game.save();

        const newCurrentPlayerId = game.turnOrder[game.currentTurn];
        const newCurrentPlayer = game.players.find(p => p.userId === newCurrentPlayerId);
        const newCurrentMember = await message.guild.members.fetch(newCurrentPlayerId);

        const embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('⏭️ Player Skipped!')
            .setDescription(`**${currentPlayer.username}** was skipped in **${game.name}**`)
            .addFields(
                { name: '🎯 New Current Player', value: `**${newCurrentPlayer.username}**`, inline: true },
                { name: '📊 Turn', value: game.turnCount.toString(), inline: true }
            )
            .setTimestamp();

        await message.reply({ embeds: [embed] });

        // Notify new current player
        try {
            await newCurrentMember.send(`🎮 It's your turn in **${game.name}**! Check the game channel.`);
        } catch (dmError) {
            // User has DMs disabled, that's okay
        }

    } catch (error) {
        logger.error('Error skipping turn:', error);
        return message.reply('❌ An error occurred while skipping the turn.');
    }
}

async function handleEnd(message, args) {
    try {
        const gameId = args[0];
        let game;

        if (gameId) {
            game = await TurnGame.findById(gameId);
        } else {
            game = await TurnGame.findOne({
                guildId: message.guild.id,
                creatorId: message.author.id,
                status: { $in: ['waiting', 'active'] }
            });
        }

        if (!game || game.guildId !== message.guild.id) {
            return message.reply('❌ No active game found.');
        }

        if (game.creatorId !== message.author.id) {
            return message.reply('❌ Only the game creator can end the game.');
        }

        game.status = 'ended';
        game.endedAt = new Date();

        await game.save();

        const embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('🏁 Game Ended!')
            .setDescription(`**${game.name}** has been ended by the creator.`)
            .addFields(
                { name: '👥 Players', value: game.players.map(p => p.username).join(', '), inline: false },
                { name: '📊 Total Turns', value: (game.turnCount || 0).toString(), inline: true },
                { name: '⏱️ Duration', value: formatDuration(game.startedAt, game.endedAt), inline: true }
            )
            .setTimestamp();

        await message.reply({ embeds: [embed] });

    } catch (error) {
        logger.error('Error ending turn game:', error);
        return message.reply('❌ An error occurred while ending the game.');
    }
}

async function handleStatus(message, args) {
    try {
        const gameId = args[0];
        let game;

        if (gameId) {
            game = await TurnGame.findById(gameId);
        } else {
            game = await TurnGame.findOne({
                guildId: message.guild.id,
                status: { $in: ['waiting', 'active'] }
            });
        }

        if (!game || game.guildId !== message.guild.id) {
            return message.reply('❌ No active game found.');
        }

        const embed = new EmbedBuilder()
            .setColor(game.status === 'active' ? 0x2ECC71 : 0xF39C12)
            .setTitle(`🎮 ${game.name} Status`)
            .setDescription(`Game created by **${game.creator.username}**`)
            .addFields(
                { name: '📊 Status', value: game.status === 'active' ? 'Active' : 'Waiting for players', inline: true },
                { name: '👥 Players', value: `${game.players.length}/${game.maxPlayers}`, inline: true },
                { name: '📈 Turn Count', value: (game.turnCount || 0).toString(), inline: true }
            )
            .setTimestamp();

        if (game.status === 'active') {
            const currentPlayer = game.players.find(p => p.userId === game.turnOrder[game.currentTurn]);
            embed.addFields(
                { name: '🎯 Current Turn', value: `**${currentPlayer.username}**`, inline: true },
                {
                    name: '📋 Turn Order', value: game.turnOrder.map((id, index) => {
                        const player = game.players.find(p => p.userId === id);
                        const isCurrent = index === game.currentTurn;
                        return `${isCurrent ? '▶️' : '⏸️'} ${player.username}${isCurrent ? ' (Current)' : ''}`;
                    }).join('\n'), inline: false
                }
            );
        } else {
            embed.addFields(
                { name: '👥 Players', value: game.players.map(p => p.username).join(', '), inline: false }
            );
        }

        await message.reply({ embeds: [embed] });

    } catch (error) {
        logger.error('Error showing game status:', error);
        return message.reply('❌ An error occurred while fetching game status.');
    }
}

async function handleList(message) {
    try {
        const games = await TurnGame.find({
            guildId: message.guild.id,
            status: { $in: ['waiting', 'active'] }
        }).sort({ createdAt: -1 }).limit(5);

        if (games.length === 0) {
            return message.reply('❌ No active games found. Use `!turn create` to start one!');
        }

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('🎮 Active Games')
            .setDescription('Here are the current games:')
            .setTimestamp();

        games.forEach((game, index) => {
            embed.addFields({
                name: `${index + 1}. ${game.name}`,
                value: [
                    `👤 Creator: ${game.creator.username}`,
                    `👥 Players: ${game.players.length}/${game.maxPlayers}`,
                    `📊 Status: ${game.status === 'active' ? 'Active' : 'Waiting'}`,
                    `🆔 ID: \`${game._id}\``
                ].join('\n'),
                inline: false
            });
        });

        embed.setFooter({ text: 'Use !turn join <game_id> to join a game!' });

        await message.reply({ embeds: [embed] });

    } catch (error) {
        logger.error('Error listing games:', error);
        return message.reply('❌ An error occurred while fetching games.');
    }
}

async function showHelp(message) {
    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('🎮 Turn-Based Game Manager')
        .setDescription('Manage turn-based games and notify players of their turns!')
        .addFields(
            {
                name: '🎮 Commands', value: [
                    '`!turn create <name> <max_players>` - Create a new game',
                    '`!turn join <game_id>` - Join an existing game',
                    '`!turn start [game_id]` - Start the game',
                    '`!turn next [game_id]` - Advance to next turn',
                    '`!turn skip [game_id]` - Skip current player',
                    '`!turn end [game_id]` - End the game',
                    '`!turn status [game_id]` - Check game status',
                    '`!turn list` - List active games'
                ].join('\n'), inline: false
            },
            {
                name: '🎯 How to Use', value: [
                    '1. Create a game with `!turn create`',
                    '2. Have players join with `!turn join`',
                    '3. Start the game with `!turn start`',
                    '4. Use `!turn next` to advance turns',
                    '5. Players get DM notifications for their turns!'
                ].join('\n'), inline: false
            }
        )
        .setFooter({ text: 'Perfect for D&D, board games, and other turn-based activities!' })
        .setTimestamp();

    await message.reply({ embeds: [embed] });
}

// Helper functions
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function formatDuration(start, end) {
    if (!start || !end) return 'Unknown';
    const duration = end.getTime() - start.getTime();
    const minutes = Math.floor(duration / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
        return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
} 