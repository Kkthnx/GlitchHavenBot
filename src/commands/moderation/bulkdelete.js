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
    MAX_MESSAGES: 1000,
    MIN_MESSAGES: 1,
    BATCH_SIZE: 100, // Discord's limit per bulk delete
    CONFIRMATION_TIMEOUT: 60000, // 60 seconds
    SUCCESS_MESSAGE_DELETE_DELAY: 15000, // 15 seconds
    MESSAGE_AGE_LIMIT: 14 * 24 * 60 * 60 * 1000, // 14 days in milliseconds
    BATCH_DELAY: 1000, // 1 second delay between batches
    COLORS: {
        WARNING: "#ff0000",
        SUCCESS: "#00ff88",
        ERROR: "#ff4444",
        PROGRESS: "#ffaa00"
    }
};

// Filter configurations
const FILTER_CONFIGS = {
    all: { name: "All Messages", filter: () => true },
    bot: { name: "Bot Messages Only", filter: (msg) => msg.author.bot },
    user: { name: "User Messages Only", filter: (msg) => !msg.author.bot },
    files: { name: "Files/Attachments", filter: (msg) => msg.attachments.size > 0 || msg.embeds.length > 0 },
    links: { name: "Links Only", filter: (msg) => msg.content.includes("http://") || msg.content.includes("https://") },
    empty: { name: "Empty Messages", filter: (msg) => !msg.content.trim() && msg.attachments.size === 0 && msg.embeds.length === 0 },
    commands: { name: "Commands Only", filter: (msg, client) => msg.content.startsWith(client.config.prefix) || msg.content.startsWith("/") }
};

module.exports = {
    name: "bulkdelete",
    aliases: ["massdelete", "nuke"],
    description: "Advanced bulk message deletion with progress tracking",
    usage: "!bulkdelete <amount> [filter] [@user] [--reason <reason>] [--silent]",
    cooldown: 60,
    guildOnly: true,
    permissions: [PermissionFlagsBits.ManageMessages],

    data: new SlashCommandBuilder()
        .setName("bulkdelete")
        .setDescription("Advanced bulk message deletion with progress tracking")
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
                    { name: "Links Only", value: "links" },
                    { name: "Empty Messages", value: "empty" },
                    { name: "Commands Only", value: "commands" }
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
                .setDescription("Reason for the bulk deletion")
                .setRequired(false)
        )
        .addBooleanOption((option) =>
            option
                .setName("silent")
                .setDescription("Delete without confirmation (use with caution)")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction, args) {
        await deferInteraction(interaction);

        try {
            // Parse command arguments
            const { amount, filter, targetUser, reason, silent } = await this.parseArguments(interaction, args);

            // Validate permissions
            await this.validatePermissions(interaction);

            // Skip confirmation if silent mode is enabled
            if (silent) {
                await this.performBulkDelete(interaction, { amount, filter, targetUser, reason });
                return;
            }

            // Show confirmation
            const confirmed = await this.showConfirmation(interaction, { amount, filter, targetUser, reason });
            if (!confirmed) return;

            // Perform the bulk deletion
            await this.performBulkDelete(interaction, { amount, filter, targetUser, reason });

        } catch (error) {
            const errorEmbed = handleCommandError(
                error,
                "bulkdelete command",
                logger,
                "An error occurred during bulk deletion."
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
                reason: interaction.options.getString("reason"),
                silent: interaction.options.getBoolean("silent") || false
            };
        }

        // Legacy command parsing
        if (!args || args.length === 0) {
            throw new Error(`Please specify the number of messages to delete (${CONSTANTS.MIN_MESSAGES}-${CONSTANTS.MAX_MESSAGES}).`);
        }

        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < CONSTANTS.MIN_MESSAGES || amount > CONSTANTS.MAX_MESSAGES) {
            throw new Error(`Please specify a valid number between ${CONSTANTS.MIN_MESSAGES} and ${CONSTANTS.MAX_MESSAGES}.`);
        }

        // Parse additional arguments
        let filter = "all";
        let silent = false;
        let targetUser = null;
        let reason = null;

        for (let i = 1; i < args.length; i++) {
            const arg = args[i].toLowerCase();
            if (Object.keys(FILTER_CONFIGS).includes(arg)) {
                filter = arg;
            } else if (arg === "--silent" || arg === "-s") {
                silent = true;
            } else if (arg === "--reason" || arg === "-r") {
                reason = args.slice(i + 1).join(" ");
                break;
            }
        }

        // Check for user mention
        const userMention = args.find(arg => arg.startsWith("<@") && arg.endsWith(">"));
        if (userMention) {
            const userId = userMention.replace(/[<@!>]/g, "");
            targetUser = await interaction.client.users.fetch(userId).catch(() => null);
        }

        return { amount, filter, targetUser, reason, silent };
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

            if (buttonInteraction.customId === "cancel_bulk_delete") {
                await buttonInteraction.update({
                    content: "❌ Bulk deletion cancelled.",
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
            .setTitle("🚨 Bulk Delete Confirmation")
            .setDescription(`**WARNING:** This will delete up to **${amount}** messages!\n\nThis action is **IRREVERSIBLE** and cannot be undone.`)
            .addFields(
                { name: "Channel", value: `<#${interaction.channel.id}>`, inline: true },
                { name: "Amount", value: `${amount} messages`, inline: true },
                { name: "Filter", value: FILTER_CONFIGS[filter].name, inline: true },
                { name: "Requested by", value: `<@${this.getUserId(interaction)}>`, inline: true }
            );

        if (targetUser?.id) {
            embed.addFields({ name: "Target User", value: `<@${targetUser.id}>`, inline: true });
        }

        if (reason) {
            embed.addFields({ name: "Reason", value: reason, inline: false });
        }

        return embed.setTimestamp().setFooter({ text: "⚠️ This action cannot be undone! ⚠️" });
    },

    /**
     * Create confirmation buttons
     */
    createConfirmationButtons() {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId("confirm_bulk_delete")
                    .setLabel("CONFIRM DELETE")
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji("💥"),
                new ButtonBuilder()
                    .setCustomId("cancel_bulk_delete")
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
            ["confirm_bulk_delete", "cancel_bulk_delete"].includes(buttonInteraction.customId);
    },

    /**
     * Handle confirmation timeout
     */
    async handleConfirmationTimeout(interaction, confirmMessage) {
        try {
            if (isSlashCommand(interaction)) {
                await confirmMessage.edit({
                    content: "⏰ Confirmation timed out. Bulk deletion cancelled.",
                    embeds: [],
                    components: []
                });
            } else {
                await interaction.channel.send("⏰ Confirmation timed out. Bulk deletion cancelled.");
            }
        } catch (editError) {
            await interaction.channel.send("⏰ Confirmation timed out. Bulk deletion cancelled.");
        }
    },

    /**
     * Get user ID from interaction (handles both slash and legacy commands)
     */
    getUserId(interaction) {
        return isSlashCommand(interaction) ? interaction.user.id : interaction.author.id;
    },

    /**
     * Perform the bulk deletion with progress tracking
     */
    async performBulkDelete(interaction, { amount, filter, targetUser, reason }) {
        try {
            let totalDeleted = 0;
            let batches = 0;
            const totalBatches = Math.ceil(amount / CONSTANTS.BATCH_SIZE);

            // Create progress embed
            const progressEmbed = this.createProgressEmbed(totalDeleted, amount, batches, totalBatches, "Starting...");
            const progressMessage = await editInteractionReply(interaction, {
                content: null,
                embeds: [progressEmbed],
                components: []
            });

            // Process deletion in batches
            while (totalDeleted < amount) {
                const batchSize = Math.min(CONSTANTS.BATCH_SIZE, amount - totalDeleted);

                try {
                    // Fetch and filter messages for this batch
                    const messages = await interaction.channel.messages.fetch({ limit: batchSize });
                    const filteredMessages = this.filterMessages(messages, { filter, targetUser, amount: batchSize });

                    if (filteredMessages.size === 0) {
                        break; // No more messages to delete
                    }

                    // Delete the batch
                    const deletedBatch = await interaction.channel.bulkDelete(filteredMessages, true);
                    totalDeleted += deletedBatch.size;
                    batches++;

                    // Update progress
                    const updatedProgressEmbed = this.createProgressEmbed(totalDeleted, amount, batches, totalBatches, "Processing...");
                    await progressMessage.edit({ embeds: [updatedProgressEmbed] });

                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, CONSTANTS.BATCH_DELAY));

                } catch (batchError) {
                    await this.handleBatchError(progressMessage, batchError, totalDeleted, amount, batches, totalBatches);
                    break;
                }
            }

            // Show final result
            await this.showFinalResult(interaction, { totalDeleted, batches, filter, targetUser, reason, amount });

            // Log the action
            this.logBulkDeleteAction(interaction, totalDeleted, batches);

        } catch (error) {
            await this.handleBulkDeleteError(interaction, error);
        }
    },

    /**
     * Create progress embed
     */
    createProgressEmbed(current, total, batches, totalBatches, status) {
        return new EmbedBuilder()
            .setColor(CONSTANTS.COLORS.PROGRESS)
            .setTitle("🔄 Bulk Deletion in Progress")
            .setDescription("Deleting messages... This may take a moment.")
            .addFields(
                { name: "Progress", value: `${current}/${total} messages deleted`, inline: true },
                { name: "Batches", value: `${batches}/${totalBatches} completed`, inline: true },
                { name: "Status", value: status, inline: true }
            )
            .setTimestamp();
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
            return FILTER_CONFIGS[filter].filter(msg, messages.client);
        });

        return filtered.first(amount);
    },

    /**
     * Handle batch errors
     */
    async handleBatchError(progressMessage, error, totalDeleted, amount, batches, totalBatches) {
        logger.error("Error in batch deletion:", error);

        let status = "Stopped - Unknown error";
        if (error.code === 50034) {
            status = "Stopped - Messages too old";
        } else if (error.code === 50013) {
            status = "Stopped - Permission error";
        }

        const errorProgressEmbed = this.createProgressEmbed(totalDeleted, amount, batches, totalBatches, status);
        await progressMessage.edit({ embeds: [errorProgressEmbed] });
    },

    /**
     * Show final result
     */
    async showFinalResult(interaction, { totalDeleted, batches, filter, targetUser, reason, amount }) {
        const successEmbed = new EmbedBuilder()
            .setColor(CONSTANTS.COLORS.SUCCESS)
            .setTitle("✅ Bulk Deletion Complete")
            .setDescription(`Successfully deleted **${totalDeleted}** messages in **${batches}** batches.`)
            .addFields(
                { name: "Channel", value: `<#${interaction.channel.id}>`, inline: true },
                { name: "Filter", value: FILTER_CONFIGS[filter].name, inline: true },
                { name: "Deleted by", value: `<@${this.getUserId(interaction)}>`, inline: true },
                { name: "Batches", value: `${batches} batches processed`, inline: true }
            );

        if (targetUser?.id) {
            successEmbed.addFields({ name: "Target User", value: `<@${targetUser.id}>`, inline: true });
        }

        if (reason) {
            successEmbed.addFields({ name: "Reason", value: reason, inline: false });
        }

        if (totalDeleted < amount) {
            successEmbed.addFields({
                name: "Note",
                value: `Only ${totalDeleted} messages were found and deleted out of ${amount} requested.`,
                inline: false
            });
        }

        const finalMessage = await editInteractionReply(interaction, {
            content: null,
            embeds: [successEmbed.setTimestamp().setFooter({ text: "Bulk deletion completed" })],
            components: []
        });

        // Auto-delete final message
        setTimeout(async () => {
            try {
                await finalMessage.delete();
            } catch (error) {
                // Message already deleted or no permission
            }
        }, CONSTANTS.SUCCESS_MESSAGE_DELETE_DELAY);
    },

    /**
     * Handle bulk delete errors
     */
    async handleBulkDeleteError(interaction, error) {
        logger.error("Error during bulk deletion:", error);

        let errorMessage = "❌ An error occurred during bulk deletion.";

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
     * Log bulk delete action
     */
    logBulkDeleteAction(interaction, totalDeleted, batches) {
        const userTag = isSlashCommand(interaction) ? interaction.user.tag : interaction.author.tag;
        logger.info(`Bulk delete executed by ${userTag} in ${interaction.channel.name}: ${totalDeleted} messages deleted in ${batches} batches`);
    }
}; 