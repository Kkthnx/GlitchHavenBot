const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");

const logger = require("../../config/logger");
const {
    handleCommandError,
    isSlashCommand,
    replyToInteraction,
    deferInteraction,
    editInteractionReply,
} = require("../../utils/helpers");

// Constants for better maintainability
const CONSTANTS = {
    MAX_MESSAGES: 100,
    MIN_MESSAGES: 1,
    CONFIRMATION_TIMEOUT: 30000, // 30 seconds
    SUCCESS_MESSAGE_DELETE_DELAY: 10000, // 10 seconds
    MESSAGE_AGE_LIMIT: 14 * 24 * 60 * 60 * 1000, // 14 days in milliseconds
    COLORS: {
        WARNING: "#ff9900",
        SUCCESS: "#00ff88",
        ERROR: "#ff4444"
    }
};

// Filter configurations
const FILTER_CONFIGS = {
    all: { name: "All Messages", filter: () => true },
    bot: { name: "Bot Messages Only", filter: (msg) => msg.author.bot },
    user: { name: "User Messages Only", filter: (msg) => !msg.author.bot },
    files: { name: "Files/Attachments", filter: (msg) => msg.attachments.size > 0 || msg.embeds.length > 0 },
    links: { name: "Links Only", filter: (msg) => msg.content.includes("http://") || msg.content.includes("https://") }
};

module.exports = {
    name: "purge",
    aliases: ["clear", "delete", "clean"],
    description: "Delete messages from the current channel",
    usage: "!purge <amount> [filter] [@user] [--reason <reason>]",
    cooldown: 30,
    guildOnly: true,
    permissions: [PermissionFlagsBits.ManageMessages],

    data: new SlashCommandBuilder()
        .setName("purge")
        .setDescription("Delete messages from the current channel")
        .addIntegerOption((option) =>
            option
                .setName("amount")
                .setDescription(`Number of messages to delete (${CONSTANTS.MIN_MESSAGES}-${CONSTANTS.MAX_MESSAGES})`)
                .setRequired(true)
                .setMinValue(CONSTANTS.MIN_MESSAGES)
                .setMaxValue(CONSTANTS.MAX_MESSAGES)
        )
        .addStringOption((option) =>
            option
                .setName("filter")
                .setDescription("Filter messages by type")
                .addChoices(
                    { name: "All Messages", value: "all" },
                    { name: "Bot Messages Only", value: "bot" },
                    { name: "User Messages Only", value: "user" },
                    { name: "Files/Attachments", value: "files" },
                    { name: "Links Only", value: "links" }
                )
                .setRequired(false)
        )
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("Delete messages from specific user only")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("reason")
                .setDescription("Reason for the purge (optional)")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction, args) {
        await deferInteraction(interaction);

        try {
            // Parse command arguments
            const { amount, filter, targetUser, reason } = await this.parseArguments(interaction, args);

            // Validate permissions
            await this.validatePermissions(interaction);

            // Show confirmation
            const confirmed = await this.showConfirmation(interaction, { amount, filter, targetUser, reason });
            if (!confirmed) return;

            // Perform the purge
            await this.performPurge(interaction, { amount, filter, targetUser, reason });

        } catch (error) {
            const errorEmbed = handleCommandError(
                error,
                "purge command",
                logger,
                "An error occurred while purging messages."
            );
            return await replyToInteraction(interaction, { embeds: [errorEmbed] });
        }
    },

    /**
     * Parse command arguments for both slash and legacy commands
     */
    async parseArguments(interaction, args) {
        if (isSlashCommand(interaction)) {
            return {
                amount: interaction.options.getInteger("amount"),
                filter: interaction.options.getString("filter") || "all",
                targetUser: interaction.options.getUser("user"),
                reason: interaction.options.getString("reason")
            };
        }

        // Legacy command parsing
        if (!args || args.length === 0) {
            throw new Error("Please specify the number of messages to delete (1-100).");
        }

        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < CONSTANTS.MIN_MESSAGES || amount > CONSTANTS.MAX_MESSAGES) {
            throw new Error(`Please specify a valid number between ${CONSTANTS.MIN_MESSAGES} and ${CONSTANTS.MAX_MESSAGES}.`);
        }

        // Parse filter
        let filter = "all";
        if (args[1] && Object.keys(FILTER_CONFIGS).includes(args[1].toLowerCase())) {
            filter = args[1].toLowerCase();
        }

        // Parse user mention
        let targetUser = null;
        const userMention = args.find(arg => arg.startsWith("<@") && arg.endsWith(">"));
        if (userMention) {
            const userId = userMention.replace(/[<@!>]/g, "");
            targetUser = await interaction.client.users.fetch(userId).catch(() => null);
        }

        // Parse reason
        let reason = null;
        const reasonIndex = args.findIndex(arg => arg === "--reason" || arg === "-r");
        if (reasonIndex !== -1 && args[reasonIndex + 1]) {
            reason = args.slice(reasonIndex + 1).join(" ");
        }

        return { amount, filter, targetUser, reason };
    },

    /**
     * Validate bot and user permissions
     */
    async validatePermissions(interaction) {
        // Check bot permissions
        if (!interaction.channel.permissionsFor(interaction.client.user).has(PermissionFlagsBits.ManageMessages)) {
            throw new Error("I don't have permission to delete messages in this channel.");
        }

        // Check user permissions
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            throw new Error("You don't have permission to use this command.");
        }
    },

    /**
     * Show confirmation dialog and wait for user response
     */
    async showConfirmation(interaction, { amount, filter, targetUser, reason }) {
        const confirmEmbed = this.createConfirmationEmbed(interaction, { amount, filter, targetUser, reason });
        const buttons = this.createConfirmationButtons();

        const confirmMessage = await replyToInteraction(interaction, {
            embeds: [confirmEmbed],
            components: [buttons]
        });

        try {
            const buttonInteraction = await interaction.channel.awaitMessageComponent({
                filter: i => this.isValidButtonInteraction(i, interaction),
                time: CONSTANTS.CONFIRMATION_TIMEOUT,
            });

            if (buttonInteraction.customId === "cancel_purge") {
                await buttonInteraction.update({
                    content: "❌ Message purge cancelled.",
                    embeds: [],
                    components: []
                });
                return false;
            }

            await buttonInteraction.deferUpdate();
            return true;

        } catch (timeoutError) {
            await this.handleConfirmationTimeout(interaction, confirmMessage);
            return false;
        }
    },

    /**
     * Create confirmation embed
     */
    createConfirmationEmbed(interaction, { amount, filter, targetUser, reason }) {
        const embed = new EmbedBuilder()
            .setColor(CONSTANTS.COLORS.WARNING)
            .setTitle("⚠️ Confirm Message Purge")
            .setDescription(`Are you sure you want to delete **${amount}** messages?`)
            .addFields(
                { name: "Channel", value: `<#${interaction.channel.id}>`, inline: true },
                { name: "Filter", value: FILTER_CONFIGS[filter].name, inline: true },
                { name: "Requested by", value: `<@${this.getUserId(interaction)}>`, inline: true }
            );

        if (targetUser?.id) {
            embed.addFields({ name: "Target User", value: `<@${targetUser.id}>`, inline: true });
        }

        if (reason) {
            embed.addFields({ name: "Reason", value: reason, inline: false });
        }

        return embed.setTimestamp().setFooter({ text: "This action cannot be undone!" });
    },

    /**
     * Create confirmation buttons
     */
    createConfirmationButtons() {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("confirm_purge")
                    .setLabel("Confirm Delete")
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji("🗑️"),
                new ButtonBuilder()
                    .setCustomId("cancel_purge")
                    .setLabel("Cancel")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("❌")
            );
    },

    /**
     * Check if button interaction is valid
     */
    isValidButtonInteraction(buttonInteraction, originalInteraction) {
        return buttonInteraction.user?.id === this.getUserId(originalInteraction) &&
            ["confirm_purge", "cancel_purge"].includes(buttonInteraction.customId);
    },

    /**
     * Handle confirmation timeout
     */
    async handleConfirmationTimeout(interaction, confirmMessage) {
        try {
            if (isSlashCommand(interaction)) {
                await confirmMessage.edit({
                    content: "⏰ Confirmation timed out. Purge cancelled.",
                    embeds: [],
                    components: []
                });
            } else {
                await interaction.channel.send("⏰ Confirmation timed out. Purge cancelled.");
            }
        } catch (editError) {
            await interaction.channel.send("⏰ Confirmation timed out. Purge cancelled.");
        }
    },

    /**
     * Get user ID from interaction (handles both slash and legacy commands)
     */
    getUserId(interaction) {
        return isSlashCommand(interaction) ? interaction.user.id : interaction.author.id;
    },

    /**
     * Perform the actual message deletion
     */
    async performPurge(interaction, { amount, filter, targetUser, reason }) {
        try {
            // Fetch and filter messages
            const messages = await interaction.channel.messages.fetch({ limit: CONSTANTS.MAX_MESSAGES });
            const filteredMessages = this.filterMessages(messages, { filter, targetUser, amount });

            if (filteredMessages.size === 0) {
                return await editInteractionReply(interaction, {
                    content: "❌ No messages found matching your criteria.",
                    embeds: [],
                    components: []
                });
            }

            // Delete messages
            const deletedMessages = await interaction.channel.bulkDelete(filteredMessages, true);

            // Show success message
            await this.showSuccessMessage(interaction, { deletedMessages, filter, targetUser, reason });

            // Log the action
            this.logPurgeAction(interaction, deletedMessages.size);

        } catch (error) {
            await this.handlePurgeError(interaction, error);
        }
    },

    /**
     * Filter messages based on criteria
     */
    filterMessages(messages, { filter, targetUser, amount }) {
        let filtered = messages.filter(msg => {
            // Skip messages older than 14 days
            if (Date.now() - msg.createdTimestamp > CONSTANTS.MESSAGE_AGE_LIMIT) {
                return false;
            }

            // Apply user filter
            if (targetUser?.id && msg.author.id !== targetUser.id) {
                return false;
            }

            // Apply type filter
            return FILTER_CONFIGS[filter].filter(msg);
        });

        return filtered.first(amount);
    },

    /**
     * Show success message
     */
    async showSuccessMessage(interaction, { deletedMessages, filter, targetUser, reason }) {
        const successEmbed = new EmbedBuilder()
            .setColor(CONSTANTS.COLORS.SUCCESS)
            .setTitle("✅ Messages Purged Successfully")
            .setDescription(`Successfully deleted **${deletedMessages.size}** messages.`)
            .addFields(
                { name: "Channel", value: `<#${interaction.channel.id}>`, inline: true },
                { name: "Filter", value: FILTER_CONFIGS[filter].name, inline: true },
                { name: "Deleted by", value: `<@${this.getUserId(interaction)}>`, inline: true }
            );

        if (targetUser?.id) {
            successEmbed.addFields({ name: "Target User", value: `<@${targetUser.id}>`, inline: true });
        }

        if (reason) {
            successEmbed.addFields({ name: "Reason", value: reason, inline: false });
        }

        const successMessage = await editInteractionReply(interaction, {
            content: null,
            embeds: [successEmbed.setTimestamp().setFooter({ text: "Purge completed" })],
            components: []
        });

        // Auto-delete success message
        setTimeout(async () => {
            try {
                await successMessage.delete();
            } catch (error) {
                // Message already deleted or no permission
            }
        }, CONSTANTS.SUCCESS_MESSAGE_DELETE_DELAY);
    },

    /**
     * Handle purge errors
     */
    async handlePurgeError(interaction, error) {
        logger.error("Error during message purge:", error);

        let errorMessage = "❌ An error occurred while deleting messages.";

        if (error.code === 50034) {
            errorMessage = "❌ Cannot delete messages older than 14 days.";
        } else if (error.code === 50013) {
            errorMessage = "❌ I don't have permission to delete some messages.";
        }

        await editInteractionReply(interaction, {
            content: errorMessage,
            embeds: [],
            components: []
        });
    },

    /**
     * Log purge action
     */
    logPurgeAction(interaction, deletedCount) {
        const userTag = isSlashCommand(interaction) ? interaction.user.tag : interaction.author.tag;
        logger.info(`Purge executed by ${userTag} in ${interaction.channel.name}: ${deletedCount} messages deleted`);
    }
}; 