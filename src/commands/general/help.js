const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'help',
    aliases: ['h', 'commands'],
    description: 'Shows all available commands or information about a specific command',
    usage: '!help [command]',
    cooldown: 5,
    async execute(message, args, client) {
        const { commands } = client;

        // If a command name is provided, show detailed help for that command
        if (args.length > 0) {
            const commandName = args[0].toLowerCase();
            const command = commands.get(commandName) ||
                commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

            if (!command) {
                return message.reply('❌ That command doesn\'t exist!');
            }

            const commandEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`Command: ${command.name}`)
                .setDescription(command.description || 'No description available.')
                .addFields(
                    { name: 'Usage', value: `\`${client.config.prefix}${command.usage || command.name}\``, inline: true },
                    { name: 'Cooldown', value: command.cooldown ? `${command.cooldown} seconds` : 'None', inline: true },
                    { name: 'Category', value: getCommandCategory(command.name), inline: true }
                )
                .setFooter({ text: 'Syntax: <> = required, [] = optional' });

            if (command.aliases && command.aliases.length > 0) {
                commandEmbed.addFields({ name: 'Aliases', value: command.aliases.join(', '), inline: false });
            }

            if (command.permissions && command.permissions.length > 0) {
                commandEmbed.addFields({ name: 'Required Permissions', value: command.permissions.join(', '), inline: false });
            }

            return message.reply({ embeds: [commandEmbed] });
        }

        // Show general help with all commands organized by category
        const categories = {
            'General': [],
            'Reputation': [],
            'Moderation': [],
            'Games': [],
            'Welcome': [],
            'Utility': [],
            'Admin': []
        };

        // Categorize commands
        commands.forEach(command => {
            const category = getCommandCategory(command.name);
            if (categories[category]) {
                categories[category].push(command);
            } else {
                categories['Utility'].push(command);
            }
        });

        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🤖 Gridkeeper Bot Commands')
            .setDescription(`Use \`${client.config.prefix}help <command>\` for detailed information about a specific command.`)
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: `Total Commands: ${commands.size} | Prefix: ${client.config.prefix}` })
            .setTimestamp();

        // Add fields for each category
        Object.entries(categories).forEach(([category, categoryCommands]) => {
            if (categoryCommands.length > 0) {
                const commandList = categoryCommands
                    .map(cmd => `\`${cmd.name}\``)
                    .join(', ');

                helpEmbed.addFields({
                    name: `${getCategoryEmoji(category)} ${category}`,
                    value: commandList,
                    inline: false
                });
            }
        });

        // Add additional information
        helpEmbed.addFields({
            name: '📋 Quick Info',
            value: [
                '• **Reputation**: Build trust with endorsements and reputation badges',
                '• **Moderation**: Manage your server with powerful moderation tools',
                '• **Games**: Have fun with coin flipping, adventures, pets, and turn-based games',
                '• **Welcome**: Customize welcome messages and auto-roles',
                '• **Utility**: Useful commands for server management'
            ].join('\n'),
            inline: false
        });

        return message.reply({ embeds: [helpEmbed] });
    }
};

function getCommandCategory(commandName) {
    const categoryMap = {
        // Admin commands
        'levelrewards': 'Admin',
        'birthdays': 'Admin',
        'automod': 'Admin',

        // General commands
        'help': 'General',
        'ping': 'General',
        'info': 'General',
        'user': 'General',
        'server': 'General',
        'setbirthday': 'General',
        'userinfo': 'General',
        'rankcard': 'General',

        // Reputation commands
        'rep': 'Reputation',
        'reputation': 'Reputation',
        'repleaderboard': 'Reputation',
        'repgiven': 'Reputation',

        // Moderation commands
        'warn': 'Moderation',
        'mute': 'Moderation',
        'kick': 'Moderation',
        'ban': 'Moderation',
        'unban': 'Moderation',
        'modlogs': 'Moderation',
        'clear': 'Moderation',
        'slowmode': 'Moderation',

        // Game commands
        'flip': 'Games',
        'rps': 'Games',
        'rpsstats': 'Games',
        'rpsleaderboard': 'Games',
        'stats': 'Games',
        'leaderboard': 'Games',
        'level': 'Games',
        'levelboard': 'Games',
        'adventure': 'Games',
        'pet': 'Games',
        'turn': 'Games',
        'lfg': 'Games',

        // Welcome commands
        'welcome': 'Welcome',
        'setwelcome': 'Welcome',
        'autorole': 'Welcome',

        // Utility commands
        'prefix': 'Utility',
        'settings': 'Utility',
        'custom': 'Utility',
        'performance': 'Utility'
    };

    return categoryMap[commandName] || 'Utility';
}

function getCategoryEmoji(category) {
    const emojis = {
        'Admin': '👑',
        'General': '📋',
        'Reputation': '⭐',
        'Moderation': '🛡️',
        'Games': '🎮',
        'Welcome': '👋',
        'Utility': '🔧'
    };

    return emojis[category] || '🔧';
} 