# GlitchHaven Bot

An advanced Discord bot with comprehensive moderation, welcome features, games, and user assistance capabilities.

## Features

### 🛡️ Moderation

- User warnings, mutes, kicks, and bans
- Auto-moderation for spam and inappropriate content
- Moderation logs and audit trails
- Temporary moderation actions with automatic expiration

### 👋 Welcome System

- Customizable welcome messages
- Welcome images with user avatars
- Role assignment on join
- Server rules presentation

### 🎮 Games

- Coin flipping game with statistics
- Leaderboards and user profiles
- Customizable game settings

### 🤖 User Assistance

- Help command with categorized information
- Server information and statistics
- User profile and activity tracking
- Custom commands and responses

## Quick Start

### 🚀 Easy Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd GlitchHavenBot
   ```

2. **Run the setup script**

   ```bash
   npm run setup
   ```

   This will guide you through creating your `.env` file.

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Start the bot**

   ```bash
   npm start
   ```

## Setup Instructions

### Prerequisites

- Node.js 18.0.0 or higher
- MongoDB (local or cloud)
- Discord Bot Token

### Manual Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd GlitchHavenBot
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp env.example .env
   ```

   Edit `.env` with your configuration values.

4. **Set up MongoDB**
   - Install MongoDB locally or use MongoDB Atlas
   - Update `MONGODB_URI` in your `.env` file

5. **Create Discord Bot**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Add a bot to your application
   - Copy the bot token to your `.env` file
   - Enable necessary intents (Server Members, Message Content)

6. **Invite bot to your server**
   - Use the OAuth2 URL generator in Discord Developer Portal
   - Select bot scope and required permissions
   - Use the generated URL to invite the bot

7. **Run the bot**

   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## Deployment

### 🚀 Free Hosting Options

- **Railway** (Recommended) - Easy deployment with $5 monthly credit
- **Render** - 750 hours/month free, sleeps after inactivity
- **Heroku** - Paid plans starting at $7/month
- **Fly.io** - 3 free VMs with good performance

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment guides.

## Available Scripts

- `npm start` - Start the bot in production mode
- `npm run dev` - Start the bot in development mode with auto-restart
- `npm run setup` - Interactive setup script for environment variables
- `npm run backup` - Backup your MongoDB database
- `npm run lint` - Run ESLint to check code quality
- `npm run test` - Run tests

## Configuration

### Required Environment Variables

- `DISCORD_TOKEN`: Your Discord bot token
- `DISCORD_CLIENT_ID`: Your Discord application client ID
- `DISCORD_GUILD_ID`: Your Discord server ID
- `MONGODB_URI`: MongoDB connection string
- `BOT_OWNER_ID`: Your Discord user ID

### Optional Environment Variables

- `BOT_PREFIX`: Command prefix (default: !)
- `LOG_LEVEL`: Logging level (default: info)
- `WELCOME_CHANNEL_ID`: Channel for welcome messages
- `LOG_CHANNEL_ID`: Channel for moderation logs
- `MODERATOR_ROLE_ID`: Role ID for moderators
- `MUTED_ROLE_ID`: Role ID for muted users

## Commands

### General Commands

- `!help` - Show help menu
- `!ping` - Check bot latency
- `!info` - Server information
- `!user <@user>` - User profile information

### Moderation Commands

- `!warn <@user> <reason>` - Warn a user
- `!mute <@user> <duration> <reason>` - Mute a user
- `!kick <@user> <reason>` - Kick a user
- `!ban <@user> <reason>` - Ban a user
- `!unban <user_id>` - Unban a user
- `!modlogs <@user>` - View moderation history

### Game Commands

- `!flip` - Flip a coin
- `!stats` - View your game statistics
- `!leaderboard` - View coin flip leaderboard

### Welcome Commands

- `!welcome <@user>` - Manually welcome a user
- `!setwelcome <message>` - Set custom welcome message

## Project Structure

```
src/
├── index.js              # Main bot entry point
├── config/
│   ├── database.js       # Database configuration
│   └── logger.js         # Logging configuration
├── commands/
│   ├── general/          # General commands
│   ├── moderation/       # Moderation commands
│   ├── games/           # Game commands
│   └── welcome/         # Welcome commands
├── events/
│   ├── ready.js         # Bot ready event
│   ├── messageCreate.js # Message handling
│   ├── guildMemberAdd.js # Member join handling
│   └── interactionCreate.js # Slash command handling
├── utils/
│   ├── database.js      # Database utilities
│   ├── permissions.js   # Permission checking
│   └── helpers.js       # Helper functions
└── models/
    ├── User.js          # User data model
    ├── Guild.js         # Guild settings model
    └── ModLog.js        # Moderation logs model
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue on GitHub or contact the bot owner.
