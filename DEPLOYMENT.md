# Deployment Guide

This guide covers deploying your Gridkeeper Bot to various hosting platforms.

## 🚀 Quick Deploy Options

### Railway (Recommended)

1. **Fork/Clone this repository**
2. **Go to [Railway](https://railway.app)**
3. **Sign up with GitHub**
4. **Create new project → Deploy from GitHub repo**
5. **Add environment variables:**

   ```
   DISCORD_TOKEN=your_bot_token
   DISCORD_CLIENT_ID=your_client_id
   DISCORD_GUILD_ID=your_guild_id
   MONGODB_URI=your_mongodb_connection_string
   BOT_OWNER_ID=your_user_id
   BOT_PREFIX=!
   LOG_LEVEL=info
   NODE_ENV=production
   ```

6. **Deploy!**

### Render

1. **Go to [Render](https://render.com)**
2. **Connect your GitHub repo**
3. **Create new Web Service**
4. **Configure:**
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node
5. **Add environment variables (same as Railway)**
6. **Deploy!**

### Heroku

1. **Install Heroku CLI**
2. **Login:** `heroku login`
3. **Create app:** `heroku create your-bot-name`
4. **Set environment variables:**

   ```bash
   heroku config:set DISCORD_TOKEN=your_bot_token
   heroku config:set MONGODB_URI=your_mongodb_connection_string
   # ... add all other variables
   ```

5. **Deploy:** `git push heroku main`

## 🗄️ Database Setup

### MongoDB Atlas (Recommended for production)

1. **Go to [MongoDB Atlas](https://mongodb.com/atlas)**
2. **Create free cluster**
3. **Create database user**
4. **Get connection string**
5. **Add to environment variables**

### Local MongoDB (Development)

```bash
# Install MongoDB locally
# Update MONGODB_URI in .env to:
MONGODB_URI=mongodb://localhost:27017/gridkeeper-bot
```

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_TOKEN` | Your Discord bot token | ✅ |
| `DISCORD_CLIENT_ID` | Your Discord application client ID | ✅ |
| `DISCORD_GUILD_ID` | Your Discord server ID | ✅ |
| `MONGODB_URI` | MongoDB connection string | ✅ |
| `BOT_OWNER_ID` | Your Discord user ID | ✅ |
| `BOT_PREFIX` | Command prefix (default: !) | ❌ |
| `LOG_LEVEL` | Logging level (default: info) | ❌ |
| `NODE_ENV` | Environment (production/development) | ❌ |
| `PORT` | Health check server port (default: 3000) | ❌ |

## 📊 Monitoring

### Health Check

- **Endpoint:** `https://your-app.railway.app/health`
- **Response:** JSON with status, timestamp, and uptime

### Logs

- **Railway:** View in dashboard
- **Render:** View in dashboard
- **Heroku:** `heroku logs --tail`

## 🔄 Updates

### Automatic (GitHub Integration)

- Push to main branch
- Platform automatically redeploys

### Manual

```bash
# Railway/Render: Push to GitHub
git add .
git commit -m "Update bot"
git push origin main

# Heroku
git push heroku main
```

## 🛠️ Troubleshooting

### Common Issues

1. **Bot not responding**
   - Check if bot is online in Discord
   - Verify DISCORD_TOKEN is correct
   - Check logs for errors

2. **Database connection failed**
   - Verify MONGODB_URI is correct
   - Check if MongoDB Atlas IP whitelist includes your platform

3. **Commands not working**
   - Verify bot has required permissions
   - Check if bot is in the correct server
   - Verify BOT_PREFIX is set correctly

### Debug Mode

Set `LOG_LEVEL=debug` in environment variables for detailed logging.

## 📈 Scaling

### Railway

- Upgrade to paid plan for more resources
- Add multiple instances for high availability

### Render

- Upgrade to paid plan for always-on service
- No sleep/wake cycles

### Heroku

- Upgrade to paid dynos for better performance
- Add add-ons for monitoring and logging

## 🔒 Security

- Never commit `.env` files
- Use environment variables for all secrets
- Regularly rotate Discord bot tokens
- Use MongoDB Atlas with proper authentication
- Enable 2FA on all accounts

## 📞 Support

If you encounter issues:

1. Check the logs first
2. Verify all environment variables are set
3. Ensure bot has proper Discord permissions
4. Check MongoDB connection
5. Open an issue on GitHub
