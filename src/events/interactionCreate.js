const {
  InteractionType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const LFG = require("../models/LFG");
const User = require("../models/User");
const logger = require("../config/logger");

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    if (interaction.type !== InteractionType.MessageComponent) return;
    if (!interaction.isButton()) return;

    const { customId } = interaction;

    // Handle LFG interactions
    if (["lfg-join", "lfg-leave", "lfg-close"].includes(customId)) {
      await handleLFGInteraction(interaction);
      return;
    }

    // Handle RPS interactions
    if (customId.startsWith("rps_")) {
      await handleRPSInteraction(interaction);
    }
  },
};

async function handleLFGInteraction(interaction) {
  const { customId } = interaction;

  try {
    const lfgSession = await LFG.findOne({ messageId: interaction.message.id });

    if (!lfgSession) {
      return interaction.reply({
        content: "This LFG post has expired or is no longer valid.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    switch (customId) {
      case "lfg-join":
        await handleJoin(interaction, lfgSession);
        break;
      case "lfg-leave":
        await handleLeave(interaction, lfgSession);
        break;
      case "lfg-close":
        await handleClose(interaction, lfgSession);
        break;
    }
  } catch (error) {
    logger.error("Error handling LFG interaction:", error);
    await interaction.reply({
      content: "An error occurred while processing your request.",
      flags: [MessageFlags.Ephemeral],
    });
  }
}

async function handleRPSInteraction(interaction) {
  const { customId } = interaction;

  try {
    if (!interaction.client.rpsChallenges) {
      return interaction.reply({
        content: "No active RPS challenges found.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const challengeData = interaction.client.rpsChallenges.get(interaction.message.id);
    if (!challengeData) {
      return interaction.reply({
        content: "This challenge has expired or is no longer valid.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    switch (customId) {
      case "rps_accept":
        await handleRPSAccept(interaction, challengeData, interaction.client);
        break;
      case "rps_decline":
        await handleRPSDecline(interaction, challengeData, interaction.client);
        break;
      case "rps_rock":
      case "rps_paper":
      case "rps_scissors":
        await handleRPSMove(interaction, challengeData, interaction.client);
        break;
    }
  } catch (error) {
    logger.error("Error handling RPS interaction:", error);
    await interaction.reply({
      content: "An error occurred while processing your request.",
      flags: [MessageFlags.Ephemeral],
    });
  }
}

async function handleRPSAccept(interaction, challengeData, client) {
  if (interaction.user.id !== challengeData.opponent) {
    return interaction.reply({
      content: "This challenge is not for you.",
      flags: [MessageFlags.Ephemeral],
    });
  }

  if (challengeData.status !== "pending") {
    return interaction.reply({
      content: "This challenge has already been responded to.",
      flags: [MessageFlags.Ephemeral],
    });
  }

  // Update challenge status
  challengeData.status = "active";
  challengeData.moves = {};

  // Create game embed
  const gameEmbed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle("🎮 Rock, Paper, Scissors - Game Started!")
    .setDescription("Both players, make your moves!")
    .addFields(
      {
        name: "Player 1",
        value: `<@${challengeData.challenger}>`,
        inline: true,
      },
      { name: "Player 2", value: `<@${challengeData.opponent}>`, inline: true },
      { name: "Status", value: "⏳ Waiting for moves...", inline: true },
    )
    .setTimestamp();

  // Create move buttons
  const moveRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("rps_rock")
      .setLabel("🪨 Rock")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("rps_paper")
      .setLabel("✋ Paper")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("rps_scissors")
      .setLabel("✂️ Scissors")
      .setStyle(ButtonStyle.Primary),
  );

  await interaction.message.edit({
    embeds: [gameEmbed],
    components: [moveRow],
  });

  await interaction.reply({
    content: "Challenge accepted! The game has begun!",
    flags: [MessageFlags.Ephemeral],
  });

  // Set timeout for moves (60 seconds)
  setTimeout(() => {
    if (client.rpsChallenges.has(interaction.message.id)) {
      const data = client.rpsChallenges.get(interaction.message.id);
      if (
        data.status === "active" &&
        (!data.moves[data.challenger] || !data.moves[data.opponent])
      ) {
        const timeoutEmbed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle("⏰ Game Timeout")
          .setDescription(
            "One or both players did not make their moves in time!",
          )
          .setTimestamp();

        interaction.message
          .edit({
            embeds: [timeoutEmbed],
            components: [],
          })
          .catch(() => {});
        client.rpsChallenges.delete(interaction.message.id);
      }
    }
  }, 60000);
}

async function handleRPSDecline(interaction, challengeData, client) {
  if (interaction.user.id !== challengeData.opponent) {
    return interaction.reply({
      content: "This challenge is not for you.",
      flags: [MessageFlags.Ephemeral],
    });
  }

  if (challengeData.status !== "pending") {
    return interaction.reply({
      content: "This challenge has already been responded to.",
      flags: [MessageFlags.Ephemeral],
    });
  }

  const declinedEmbed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle("❌ Challenge Declined")
    .setDescription(`${interaction.user} has declined the challenge!`)
    .setTimestamp();

  await interaction.message.edit({
    embeds: [declinedEmbed],
    components: [],
  });

  await interaction.reply({
    content: "You have declined the challenge.",
    flags: [MessageFlags.Ephemeral],
  });
  client.rpsChallenges.delete(interaction.message.id);
}

async function handleRPSMove(interaction, challengeData, client) {
  const playerId = interaction.user.id;
  const { customId } = interaction;
  const move = customId.split("_")[1]; // rock, paper, or scissors

  if (
    playerId !== challengeData.challenger &&
    playerId !== challengeData.opponent
  ) {
    return interaction.reply({
      content: "You are not part of this game.",
      flags: [MessageFlags.Ephemeral],
    });
  }

  if (challengeData.status !== "active") {
    return interaction.reply({
      content: "This game is not active.",
      flags: [MessageFlags.Ephemeral],
    });
  }

  if (challengeData.moves[playerId]) {
    return interaction.reply({
      content: "You have already made your move!",
      flags: [MessageFlags.Ephemeral],
    });
  }

  // Record the move
  challengeData.moves[playerId] = move;

  await interaction.reply({
    content: `You chose ${getMoveEmoji(move)}!`,
    flags: [MessageFlags.Ephemeral],
  });

  // Check if both players have moved
  if (
    challengeData.moves[challengeData.challenger] &&
    challengeData.moves[challengeData.opponent]
  ) {
    await determineWinner(interaction, challengeData, client);
  }
}

async function determineWinner(interaction, challengeData, client) {
  const challengerMove = challengeData.moves[challengeData.challenger];
  const opponentMove = challengeData.moves[challengeData.opponent];

  const result = getGameResult(challengerMove, opponentMove);
  const { winner } = result;
  const { reason } = result;

  // Create result embed
  const resultEmbed = new EmbedBuilder()
    .setColor(winner === "tie" ? 0x808080 : 0x00ff00)
    .setTitle("🎮 Game Result")
    .setDescription(result.description)
    .addFields(
      {
        name: `<@${challengeData.challenger}>`,
        value: getMoveEmoji(challengerMove),
        inline: true,
      },
      { name: "VS", value: "⚔️", inline: true },
      {
        name: `<@${challengeData.opponent}>`,
        value: getMoveEmoji(opponentMove),
        inline: true,
      },
      { name: "Result", value: reason, inline: false },
    )
    .setTimestamp();

  await interaction.message.edit({
    embeds: [resultEmbed],
    components: [],
  });

  // Award XP and update stats if there's a winner
  if (winner !== "tie") {
    const winnerId =
      winner === "challenger"
        ? challengeData.challenger
        : challengeData.opponent;
    const loserId =
      winner === "challenger"
        ? challengeData.opponent
        : challengeData.challenger;

    try {
      const [winnerUser, loserUser] = await Promise.all([
        User.findOrCreate(winnerId, interaction.guildId, {
          username:
            interaction.client.users.cache.get(winnerId)?.username || "Unknown",
          discriminator:
            interaction.client.users.cache.get(winnerId)?.discriminator || "0",
          avatar: interaction.client.users.cache.get(winnerId)?.avatar,
        }),
        User.findOrCreate(loserId, interaction.guildId, {
          username:
            interaction.client.users.cache.get(loserId)?.username || "Unknown",
          discriminator:
            interaction.client.users.cache.get(loserId)?.discriminator || "0",
          avatar: interaction.client.users.cache.get(loserId)?.avatar,
        }),
      ]);

      // Award XP to winner
      await winnerUser.addXP(50, "rps_win");

      // Small XP to loser for participation
      await loserUser.addXP(10, "rps_loss");

      // Update RPS stats
      await updateRPSStats(winnerUser, "win");
      await updateRPSStats(loserUser, "loss");
    } catch (error) {
      logger.error("Error updating RPS stats:", error);
    }
  } else {
    // Handle tie - both players get some XP
    try {
      const [challengerUser, opponentUser] = await Promise.all([
        User.findOrCreate(challengeData.challenger, interaction.guildId, {
          username:
            interaction.client.users.cache.get(challengeData.challenger)
              ?.username || "Unknown",
          discriminator:
            interaction.client.users.cache.get(challengeData.challenger)
              ?.discriminator || "0",
          avatar: interaction.client.users.cache.get(challengeData.challenger)
            ?.avatar,
        }),
        User.findOrCreate(challengeData.opponent, interaction.guildId, {
          username:
            interaction.client.users.cache.get(challengeData.opponent)
              ?.username || "Unknown",
          discriminator:
            interaction.client.users.cache.get(challengeData.opponent)
              ?.discriminator || "0",
          avatar: interaction.client.users.cache.get(challengeData.opponent)
            ?.avatar,
        }),
      ]);

      // Award XP to both players for tie
      await challengerUser.addXP(25, "rps_tie");
      await opponentUser.addXP(25, "rps_tie");

      // Update RPS stats for tie
      await updateRPSStats(challengerUser, "tie");
      await updateRPSStats(opponentUser, "tie");
    } catch (error) {
      logger.error("Error updating RPS tie stats:", error);
    }
  }

  // Clean up
  client.rpsChallenges.delete(interaction.message.id);
}

function getMoveEmoji(move) {
  const emojis = {
    rock: "🪨",
    paper: "✋",
    scissors: "✂️",
  };
  return emojis[move] || move;
}

function getGameResult(move1, move2) {
  if (move1 === move2) {
    return {
      winner: "tie",
      description: "It's a tie! 🤝",
      reason: "Both players chose the same move!",
    };
  }

  const winningCombos = {
    rock: "scissors",
    paper: "rock",
    scissors: "paper",
  };

  if (winningCombos[move1] === move2) {
    return {
      winner: "challenger",
      description: "🎉 The challenger wins!",
      reason: `${getMoveEmoji(move1)} beats ${getMoveEmoji(move2)}!`,
    };
  }
  return {
    winner: "opponent",
    description: "🎉 The opponent wins!",
    reason: `${getMoveEmoji(move2)} beats ${getMoveEmoji(move1)}!`,
  };
}

async function updateRPSStats(user, result) {
  // Initialize RPS stats if they don't exist
  if (!user.gameStats.rps) {
    user.gameStats.rps = {
      total: 0,
      wins: 0,
      losses: 0,
      ties: 0,
    };
  }

  user.gameStats.rps.total++;
  if (result === "win") {
    user.gameStats.rps.wins++;
  } else if (result === "loss") {
    user.gameStats.rps.losses++;
  } else if (result === "tie") {
    user.gameStats.rps.ties++;
  }

  await user.save();
}

async function handleJoin(interaction, lfgSession) {
  if (lfgSession.status !== "open") {
    return interaction.reply({
      content: "This LFG is no longer open for joining.",
      flags: [MessageFlags.Ephemeral],
    });
  }

  if (lfgSession.players.includes(interaction.user.id)) {
    return interaction.reply({
      content: "You've already joined this group!",
      flags: [MessageFlags.Ephemeral],
    });
  }

  if (
    lfgSession.creatorId === interaction.user.id &&
    !lfgSession.players.includes(interaction.user.id)
  ) {
    lfgSession.players.unshift(interaction.user.id); // Add creator to the top of the list
  } else {
    lfgSession.players.push(interaction.user.id);
  }

  if (lfgSession.players.length >= lfgSession.slots) {
    lfgSession.status = "full";
  }

  await lfgSession.save();
  await updateLFGMessage(interaction, lfgSession);
  await interaction.reply({
    content: "You have successfully joined the group!",
    flags: [MessageFlags.Ephemeral],
  });
}

async function handleLeave(interaction, lfgSession) {
  if (!lfgSession.players.includes(interaction.user.id)) {
    return interaction.reply({
      content: "You aren't in this group.",
      flags: [MessageFlags.Ephemeral],
    });
  }

  lfgSession.players = lfgSession.players.filter(
    (id) => id !== interaction.user.id,
  );

  if (lfgSession.players.length < lfgSession.slots) {
    lfgSession.status = "open";
  }

  await lfgSession.save();
  await updateLFGMessage(interaction, lfgSession);
  await interaction.reply({
    content: "You have left the group.",
    flags: [MessageFlags.Ephemeral],
  });
}

async function handleClose(interaction, lfgSession) {
  if (interaction.user.id !== lfgSession.creatorId) {
    return interaction.reply({
      content: "Only the creator of this LFG can close it.",
      flags: [MessageFlags.Ephemeral],
    });
  }

  lfgSession.status = "closed";
  await lfgSession.save();
  await updateLFGMessage(interaction, lfgSession);
  await interaction.reply({
    content: "You have closed the LFG post.",
    flags: [MessageFlags.Ephemeral],
  });
}

async function updateLFGMessage(interaction, lfgSession) {
  const { message } = interaction;
  const originalEmbed = message.embeds[0];

  const newEmbed = new EmbedBuilder(originalEmbed.toJSON());

  const playersList =
    lfgSession.players.map((id) => `<@${id}>`).join("\n") || "None yet!";
  newEmbed.setFields(
    {
      name: "Slots Available",
      value: `**${lfgSession.slots - lfgSession.players.length}**`,
      inline: true,
    },
    { name: "Players Joined", value: playersList, inline: true },
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("lfg-join")
      .setLabel("Join")
      .setStyle(ButtonStyle.Success)
      .setEmoji("✅")
      .setDisabled(lfgSession.status !== "open"),
    new ButtonBuilder()
      .setCustomId("lfg-leave")
      .setLabel("Leave")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("❌"),
    new ButtonBuilder()
      .setCustomId("lfg-close")
      .setLabel("Close")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🔒"),
  );

  if (lfgSession.status === "closed") {
    newEmbed
      .setColor(0x808080) // Gray
      .setTitle(`[CLOSED] 🎮 ${lfgSession.game}`)
      .setFooter({ text: "This LFG is now closed." });
    row.components.forEach((button) => button.setDisabled(true));
  }

  await message.edit({ embeds: [newEmbed], components: [row] });
}
