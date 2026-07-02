import { pgClient } from "../prisma.js";
import { emitToUser } from "../socket.js";
import { logger } from "../../logs/logger.js";

/**
 * Create a notification row and push it in real-time to the recipient.
 *
 * This is the single entry point every feature should use to notify a user, so
 * persistence + delivery stay in one place (DRY). It never throws for delivery
 * problems — a failed socket emit must not roll back the business action that
 * triggered it; the row is still stored and will show on next fetch.
 *
 * @param {Object} params
 * @param {string} params.user_id      recipient user id (required)
 * @param {string} params.type         notification_type enum value (required)
 * @param {string} params.title        short headline (required)
 * @param {string} params.message      body text (required)
 * @param {Object} [params.data]       arbitrary JSON payload (ids, etc.)
 * @param {string} [params.priority]   priority_type enum (default 'medium')
 * @param {string} [params.action_url] deep link the client can navigate to
 * @returns {Promise<Object|null>} the created notification, or null on failure
 */
export async function createNotification({
    user_id,
    type,
    title,
    message,
    data = null,
    priority = "medium",
    action_url = null,
}) {
    if (!user_id || !type || !title || !message) {
        logger.warn("createNotification called with missing required fields");
        return null;
    }

    try {
        const notification = await pgClient.notifications.create({
            data: { user_id, type, title, message, data, priority, action_url },
        });

        // Real-time push to every open tab of the recipient.
        emitToUser(user_id, "notification:new", notification);

        logger.info(`notification created: user=${user_id} type=${type}`);
        return notification;
    } catch (err) {
        // Swallow — the trigger action (e.g. sending a turfmate request) should
        // still succeed even if we couldn't record/deliver the notification.
        logger.error(`createNotification failed: ${err.message}`);
        return null;
    }
}
