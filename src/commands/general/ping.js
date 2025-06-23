const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "ping",
  aliases: ["latency"],
  description: "Shows the bot's latency and connection status",
  usage: "!ping",
  cooldown: 5,
  async execute(message, args, client) {
    const sent = await message.reply("🏓 Pinging...");

    const latency = sent.createdTimestamp - message.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    const pingEmbed = new EmbedBuilder()
      .setColor(getPingColor(latency))
      .setTitle("🏓 Pong!")
      .addFields(
        { name: "📡 Bot Latency", value: `${latency}ms`, inline: true },
        { name: "🌐 API Latency", value: `${apiLatency}ms`, inline: true },
        { name: "📊 Status", value: getPingStatus(latency), inline: true },
      )
      .setFooter({ text: `Requested by ${message.author.tag}` })
      .setTimestamp();

    await sent.edit({ content: null, embeds: [pingEmbed] });
  },
};

function getPingColor(latency) {
  if (latency < 100) return 0x00ff00; // Green
  if (latency < 200) return 0xffff00; // Yellow
  if (latency < 300) return 0xffa500; // Orange
  return 0xff0000; // Red
}

function getPingStatus(latency) {
  if (latency < 100) return "🟢 Excellent";
  if (latency < 200) return "🟡 Good";
  if (latency < 300) return "🟠 Fair";
  return "🔴 Poor";
}
