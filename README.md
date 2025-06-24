# Gridkeeper Discord Bot

A powerful, modern Discord bot for advanced moderation, automation, community engagement, and fun. Built with Discord.js v14+ and designed for reliability, extensibility, and ease of use.

---

## ✨ Features

### 🛡️ Moderation

- **Purge & Bulk Delete**: Clean up messages with `/purge`, `/bulkdelete`, and legacy commands (`!purge`, `!bulkdelete`).
- **Scheduled Cleanup**: Automatic message cleanup with `/autocleanup` and scheduled tasks.
- **Warnings, Mutes, Kicks, Bans**: Full suite of moderation tools with logging and audit trails.
- **Auto-moderation**: Spam and inappropriate content filtering.
- **Role & Permission Management**: Assign, remove, and manage roles with ease.

### 👋 Welcome & Community

- Customizable welcome messages and images
- Auto role assignment on join
- Server rules presentation
- Birthday and event reminders

### 🎮 Games & Fun

- Coin flip, leaderboards, and user stats
- Customizable game settings

### 🤖 Utilities & Automation

- Help and info commands
- User and server stats
- Scheduled and on-demand database backups
- Custom commands and responses

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+
- **MongoDB** (local or Atlas)
- **Discord Bot Token**

### Installation

```bash
git clone <repository-url>
cd Gridkeeper
npm install
cp env.example .env # Edit .env with your values
```

### Setup

1. Configure your `.env` file with your Discord bot token, MongoDB URI, and other required values.
2. Set up your bot in the [Discord Developer Portal](https://discord.com/developers/applications) and invite it to your server with the correct permissions.

### Running the Bot

```bash
# Development mode (with auto-restart)
npm run dev
# Production mode
npm start
```

---

## ⚙️ Configuration

### Required Environment Variables

- `DISCORD_TOKEN`: Your Discord bot token
- `DISCORD_CLIENT_ID`: Your Discord application client ID
- `DISCORD_GUILD_ID`: Your Discord server ID
- `MONGODB_URI`: MongoDB connection string
- `BOT_OWNER_ID`: Your Discord user ID

### Optional Environment Variables

- `BOT_PREFIX`: Command prefix (default: !)
- `LOG_LEVEL`: Logging level (default: info)
- `WELCOME_CHANNEL_ID`, `LOG_CHANNEL_ID`, `MODERATOR_ROLE_ID`, `MUTED_ROLE_ID`, etc.

---

## 📝 Usage & Commands

### Moderation

- `/purge amount:50 filter:bot user:@username reason:Cleanup`  
- `/bulkdelete amount:500 filter:links --silent`
- `!purge 50 bot @username --reason "Cleanup"`
- `!bulkdelete 500 links --silent`

Other moderation:

- `!warn <@user> <reason>`
- `!mute <@user> <duration> <reason>`
- `!kick <@user> <reason>`
- `!ban <@user> <reason>`
- `!modlogs <@user>`

### General

- `!help` — Show help menu
- `!ping` — Check bot latency
- `!info` — Server info
- `!user <@user>` — User profile

### Games

- `!flip` — Flip a coin
- `!stats` — Your game stats
- `!leaderboard` — Coin flip leaderboard

### Welcome

- `!welcome <@user>` — Manually welcome a user
- `!setwelcome <message>` — Set custom welcome message

---

## 🏗️ Project Structure

```
src/
├── index.js              # Main bot entry point
├── config/               # Configuration files
├── commands/             # Command modules
│   ├── general/
│   ├── moderation/
│   └── ...
├── events/               # Event handlers
├── tasks/                # Scheduled/automated tasks
├── utils/                # Utility functions
└── ...
```

---

## ☁️ Deployment

- **Railway** (Recommended)
- **Render**
- **Heroku**
- **Fly.io**

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed guides.

---

## 🤝 Contributing

1. Fork the repo and create your branch
2. Make your changes and add tests if possible
3. Open a pull request with a clear description

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Credits

- Built with [discord.js](https://discord.js.org/)
- Inspired by the Discord community and open-source contributors

---

## 💬 Support & Feedback

- Open an issue or discussion on GitHub
- PRs and suggestions welcome!

---

**Gridkeeper** — The all-in-one Discord bot for modern communities.
