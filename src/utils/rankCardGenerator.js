const path = require("path");
const fs = require("fs");

const { createCanvas, loadImage, registerFont } = require("canvas");

// Register fonts if available
try {
  const fontPath = path.join(__dirname, "../../assets/fonts");
  if (fs.existsSync(fontPath)) {
    const fonts = fs
      .readdirSync(fontPath)
      .filter((file) => file.endsWith(".ttf") || file.endsWith(".otf"));
    fonts.forEach((font) => {
      registerFont(path.join(fontPath, font), {
        family: font.replace(/\.[^/.]+$/, ""),
      });
    });
  }
} catch (error) {
  // Font registration failed, will use default fonts
}

class RankCardGenerator {
  constructor() {
    this.width = 540;
    this.height = 160;
    this.padding = 20;
    this.colors = [
      "#C27CFF", // Purple
      "#33A5FF", // Blue
      "#57F287", // Green
      "#E91E63", // Pink
      "#F9A825", // Orange
      "#F44336", // Red
    ];
  }

  async createRankCard(userData, backgroundName, clientUser, clientMember) {
    if (!userData || !userData.username) {
      throw new Error("Invalid userData");
    }

    const themeColor =
      this.colors[Math.floor(Math.random() * this.colors.length)];

    const canvas = createCanvas(this.width, this.height);
    const ctx = canvas.getContext("2d");

    // --- Background Setup ---
    const backgroundsPath = path.join(__dirname, "../../assets/rankcards");
    let backgroundPath = "";

    // --- Determine which background to use ---
    // 1. Check for a user-defined background first.
    if (
      backgroundName &&
      backgroundName !== "default" &&
      fs.existsSync(backgroundsPath)
    ) {
      try {
        const files = fs.readdirSync(backgroundsPath);
        const userBgFile = files.find(
          (file) =>
            path.parse(file).name.toLowerCase() ===
            backgroundName.toLowerCase(),
        );
        if (userBgFile) {
          backgroundPath = path.join(backgroundsPath, userBgFile);
        }
      } catch (e) {
        // Background loading failed, will use solid color
      }
    }

    // 2. If no user-defined one was found, try for a random one.
    if (!backgroundPath && fs.existsSync(backgroundsPath)) {
      try {
        const availableBgs = fs
          .readdirSync(backgroundsPath)
          .filter((file) => file.endsWith(".png") || file.endsWith(".jpg"));
        if (availableBgs.length > 0) {
          const randomBg =
            availableBgs[Math.floor(Math.random() * availableBgs.length)];
          backgroundPath = path.join(backgroundsPath, randomBg);
        }
      } catch (e) {
        // Background loading failed, will use solid color
      }
    }

    // --- Draw Background & Overlay ---
    const cardColor = "rgba(44, 47, 51, 0.85)";

    if (backgroundPath) {
      try {
        const background = await loadImage(backgroundPath);
        ctx.drawImage(background, 0, 0, this.width, this.height);
      } catch (e) {
        ctx.fillStyle = "#2C2F33";
        ctx.fillRect(0, 0, this.width, this.height);
      }
    } else {
      ctx.fillStyle = "#2C2F33";
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // Always draw the semi-transparent overlay on top
    ctx.fillStyle = cardColor;
    ctx.fillRect(0, 0, this.width, this.height);

    const user = clientUser;

    // --- Avatar & Decoration ---
    const avatarSize = 90;
    const avatarX = this.padding + 5;
    const avatarY = (this.height - avatarSize) / 2;
    const avatarURL = user.displayAvatarURL({ extension: "png", size: 256 });
    const decorationURL = user.avatarDecorationURL({
      extension: "png",
      size: 256,
    });

    try {
      const [avatar, decoration] = await Promise.all([
        loadImage(avatarURL),
        decorationURL ? loadImage(decorationURL) : Promise.resolve(null),
      ]);

      // Draw circular avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(
        avatarX + avatarSize / 2,
        avatarY + avatarSize / 2,
        avatarSize / 2,
        0,
        Math.PI * 2,
      );
      ctx.clip();
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();

      // Draw decoration on top
      if (decoration) {
        // Decorations are typically larger than the avatar to create a border effect.
        // We'll scale it slightly larger and center it on the avatar.
        const decorationSize = avatarSize * 1.2;
        const decorationX = avatarX - (decorationSize - avatarSize) / 2;
        const decorationY = avatarY - (decorationSize - avatarSize) / 2;
        ctx.drawImage(
          decoration,
          decorationX,
          decorationY,
          decorationSize,
          decorationSize,
        );
      }
    } catch (error) {
      this.drawPlaceholderAvatar(ctx, avatarX, avatarY, avatarSize);
    }

    // --- Status Indicator ---
    const status = clientMember?.presence?.status || "offline";
    this.drawStatusIndicator(
      ctx,
      avatarX + avatarSize,
      avatarY + avatarSize,
      status,
    );

    // --- Text Positioning ---
    const textX = avatarX + avatarSize + 20;

    // --- Top Line: Rank & Level ---
    const topY = 55; // Adjusted for larger fonts
    const labelY = topY - 1; // Y-offset for smaller labels
    ctx.textAlign = "left";

    // RANK
    ctx.font = "15px Arial";
    ctx.fillStyle = "#B9BBBE";
    ctx.fillText("RANK", textX, labelY);
    let currentX = textX + ctx.measureText("RANK").width + 8;

    ctx.font = "bold 30px Arial";
    ctx.fillStyle = "white";
    const rankText = `#${userData.rank}`;
    ctx.fillText(rankText, currentX, topY);
    currentX += ctx.measureText(rankText).width + 20;

    // LEVEL
    ctx.font = "15px Arial";
    ctx.fillStyle = "#B9BBBE";
    ctx.fillText("LEVEL", currentX, labelY);
    currentX += ctx.measureText("LEVEL").width + 8;

    ctx.font = "bold 30px Arial";
    ctx.fillStyle = themeColor;
    const levelText = userData.level.toString();
    ctx.fillText(levelText, currentX, topY);

    // --- Middle line: Username & Discriminator ---
    const userY = 95;
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "white";
    ctx.fillText(
      userData.username,
      textX,
      userY,
      this.width - textX - this.padding,
    );

    if (userData.discriminator && userData.discriminator !== "0") {
      ctx.font = "16px Arial";
      ctx.fillStyle = "#B9BBBE";
      const usernameWidth = ctx.measureText(userData.username).width;
      ctx.fillText(
        `#${userData.discriminator}`,
        textX + usernameWidth + 4,
        userY,
      );
    }

    // --- Bottom: Progress Bar & XP ---
    const barX = textX;
    const barY = 125;
    const barWidth = this.width - textX - this.padding;
    const barHeight = 22;

    const fmt = (xp) =>
      xp > 999 ? `${(xp / 1000).toFixed(1)}K` : xp.toString();
    ctx.font = "16px Arial";
    ctx.fillStyle = "#B9BBBE";
    ctx.textAlign = "right";
    ctx.fillText(
      `${fmt(userData.currentXp)} / ${fmt(userData.neededXp)} XP`,
      barX + barWidth,
      barY - 10,
    );

    this.drawProgressBar(
      ctx,
      barX,
      barY,
      barWidth,
      barHeight,
      userData.currentXp,
      userData.neededXp,
      themeColor,
    );

    return canvas.toBuffer("image/png");
  }

  drawStatusIndicator(ctx, avatarRightX, avatarBottomY, status) {
    const radius = 9;
    const borderWidth = 6;
    const indicatorX = avatarRightX - radius - borderWidth / 2 + 3;
    const indicatorY = avatarBottomY - radius - borderWidth / 2 + 3;

    let color;
    switch (status) {
      case "online":
        color = "#57F287"; // Brighter green
        break;
      case "idle":
        color = "#FAA61A";
        break;
      case "dnd":
        color = "#F04747";
        break;
      default:
        color = "#747F8D";
    }

    // Create the cutout effect by drawing a larger black circle first
    ctx.fillStyle = "#18191C"; // Black border for status
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, radius + borderWidth, 0, 2 * Math.PI);
    ctx.fill();

    // Draw the actual status indicator circle
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, radius, 0, 2 * Math.PI);
    ctx.fill();
  }

  drawPlaceholderAvatar(ctx, x, y, size) {
    // Draw a simple placeholder avatar
    ctx.fillStyle = "#333333";
    ctx.fillRect(x, y, size, size);

    ctx.fillStyle = "#666666";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText("?", x + size / 2, y + size / 2 + 8);
  }

  drawProgressBar(ctx, x, y, width, height, currentXp, neededXp, themeColor) {
    const progress = Math.min(currentXp / neededXp, 1);
    const cornerRadius = height / 2;

    // Background
    ctx.fillStyle = "#4A4E54";
    ctx.beginPath();
    ctx.moveTo(x + cornerRadius, y);
    ctx.lineTo(x + width - cornerRadius, y);
    ctx.arcTo(x + width, y, x + width, y + cornerRadius, cornerRadius);
    ctx.lineTo(x + width, y + height - cornerRadius);
    ctx.arcTo(
      x + width,
      y + height,
      x + width - cornerRadius,
      y + height,
      cornerRadius,
    );
    ctx.lineTo(x + cornerRadius, y + height);
    ctx.arcTo(x, y + height, x, y + height - cornerRadius, cornerRadius);
    ctx.lineTo(x, y + cornerRadius);
    ctx.arcTo(x, y, x + cornerRadius, y, cornerRadius);
    ctx.closePath();
    ctx.fill();

    // Progress fill
    const fillWidth = width * progress;
    ctx.fillStyle = themeColor;

    if (progress > 0) {
      if (fillWidth < height) {
        // If progress is low, draw a circle
        ctx.beginPath();
        ctx.arc(
          x + cornerRadius,
          y + cornerRadius,
          cornerRadius,
          0,
          2 * Math.PI,
        );
        ctx.fill();
      } else {
        // Otherwise, draw the rounded progress bar
        ctx.beginPath();
        ctx.moveTo(x + cornerRadius, y);
        ctx.lineTo(x + fillWidth - cornerRadius, y);
        ctx.arcTo(
          x + fillWidth,
          y,
          x + fillWidth,
          y + cornerRadius,
          cornerRadius,
        );
        ctx.lineTo(x + fillWidth, y + height - cornerRadius);
        ctx.arcTo(
          x + fillWidth,
          y + height,
          x + fillWidth - cornerRadius,
          y + height,
          cornerRadius,
        );
        ctx.lineTo(x + cornerRadius, y + height);
        ctx.arcTo(x, y + height, x, y + height - cornerRadius, cornerRadius);
        ctx.lineTo(x, y + cornerRadius);
        ctx.arcTo(x, y, x + cornerRadius, y, cornerRadius);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
}

const createRankCard = async (
  userData,
  backgroundName,
  clientUser,
  clientMember,
) => {
  const generator = new RankCardGenerator();
  return await generator.createRankCard(
    userData,
    backgroundName,
    clientUser,
    clientMember,
  );
};

module.exports = { createRankCard };
