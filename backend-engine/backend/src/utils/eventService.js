import { pgClient } from "../prisma.js";
import { createNotification } from "./notificationService.js";
import { logger } from "../../logs/logger.js";

/**
 * Event-admin helpers.
 *
 * An event's "admins" are:
 *   - the organizer (events.organizer_id) — always an admin, can't be removed;
 *   - any APPROVED participant promoted to role = co_organizer.
 * Multiple admins are supported. Only the organizer may grant/revoke admin.
 *
 * These reads are centralised here so controllers stay thin and every feature
 * computes "who can moderate this event" the same way (DRY).
 */

/**
 * All admin user ids for an event: organizer + approved co_organizers.
 * @param {string} eventId
 * @returns {Promise<string[]>} unique admin user ids (empty if event missing)
 */
export async function getEventAdminIds(eventId) {
    const event = await pgClient.events.findUnique({
        where: { id: eventId },
        select: { organizer_id: true },
    });
    if (!event) return [];

    const coOrganizers = await pgClient.event_participants.findMany({
        where: { event_id: eventId, role: "co_organizer", status: "approved" },
        select: { user_id: true },
    });

    // Set de-dupes in case the organizer also has a participant row.
    return [...new Set([event.organizer_id, ...coOrganizers.map((p) => p.user_id)])];
}

/**
 * Is `userId` an admin (organizer or co_organizer) of the event?
 * @returns {Promise<boolean>}
 */
export async function isEventAdmin(eventId, userId) {
    const adminIds = await getEventAdminIds(eventId);
    return adminIds.includes(userId);
}

/**
 * Fan a notification out to every admin of an event, minus any excluded ids
 * (typically the actor themselves, so they don't get notified of their own
 * action). Best-effort per recipient — createNotification never throws.
 *
 * @param {string} eventId
 * @param {Object} payload            { type, title, message, data?, priority?, action_url? }
 * @param {string[]} [excludeUserIds] ids to skip (e.g. the acting admin)
 * @returns {Promise<number>} how many admins were notified
 */
export async function notifyEventAdmins(eventId, payload, excludeUserIds = []) {
    try {
        const adminIds = await getEventAdminIds(eventId);
        const targets = adminIds.filter((id) => !excludeUserIds.includes(id));
        if (targets.length === 0) return 0;

        await Promise.all(
            targets.map((uid) => createNotification({ ...payload, user_id: uid }))
        );
        logger.info(`event-admin notify: event=${eventId} -> ${targets.length} admins`);
        return targets.length;
    } catch (err) {
        logger.error(`notifyEventAdmins failed: ${err.message}`);
        return 0;
    }
}
