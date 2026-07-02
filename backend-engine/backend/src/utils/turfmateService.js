import { pgClient } from "../prisma.js";
import { createNotification } from "./notificationService.js";
import { logger } from "../../logs/logger.js";

/**
 * Turfmate = an ACCEPTED user-to-user connection. This module centralises the
 * connection-graph reads so controllers stay thin and every feature computes
 * "who are my turfmates" the same way (DRY).
 */

/** Return the id of the OTHER party in a connection row, relative to `myId`. */
const otherParty = (row, myId) =>
    row.requester_id === myId ? row.recipient_id : row.requester_id;

/**
 * All accepted turfmate ids for a user (either direction).
 * @returns {Promise<string[]>}
 */
export async function getAcceptedTurfmateIds(userId) {
    const rows = await pgClient.connections.findMany({
        where: {
            status: "accepted",
            OR: [{ requester_id: userId }, { recipient_id: userId }],
        },
        select: { requester_id: true, recipient_id: true },
    });
    return rows.map((r) => otherParty(r, userId));
}

/**
 * Every user id that already has ANY connection with `userId` (pending/accepted/
 * rejected/blocked), plus the user themselves. Used to exclude people from
 * recommendations and duplicate requests.
 * @returns {Promise<Set<string>>}
 */
export async function getConnectedOrSelfIds(userId) {
    const rows = await pgClient.connections.findMany({
        where: { OR: [{ requester_id: userId }, { recipient_id: userId }] },
        select: { requester_id: true, recipient_id: true },
    });
    const set = new Set([userId]);
    rows.forEach((r) => set.add(otherParty(r, userId)));
    return set;
}

/**
 * Fan a notification out to all of a user's turfmates (e.g. "your turfmate
 * organized a match"). Best-effort per recipient — createNotification never
 * throws, so one bad row can't break the fan-out or the triggering action.
 *
 * @param {string} actorId  the user whose activity triggered this
 * @param {Object} payload  { type, title, message, data?, priority?, action_url? }
 * @returns {Promise<number>} how many turfmates were notified
 */
export async function broadcastToTurfmates(actorId, payload) {
    try {
        const turfmateIds = await getAcceptedTurfmateIds(actorId);
        if (turfmateIds.length === 0) return 0;

        await Promise.all(
            turfmateIds.map((uid) => createNotification({ ...payload, user_id: uid }))
        );
        logger.info(`turfmate broadcast: actor=${actorId} -> ${turfmateIds.length} turfmates`);
        return turfmateIds.length;
    } catch (err) {
        logger.error(`broadcastToTurfmates failed: ${err.message}`);
        return 0;
    }
}

/**
 * A user's "activity areas": the set of turf cities from events they organized
 * or joined. Used as the location signal when the user hasn't set a home area.
 * @returns {Promise<{cities:Set<string>}>}
 */
export async function getUserActivityAreas(userId) {
    // Original-case city strings so they can be matched exactly against
    // turfs.city in follow-up queries (Prisma `in` is case-sensitive).
    const cities = new Set();

    const collect = (turf) => {
        if (turf?.city) cities.add(turf.city.trim());
    };

    const [organized, joined] = await Promise.all([
        pgClient.events.findMany({
            where: { organizer_id: userId },
            select: { grounds: { select: { turfs: { select: { city: true } } } } },
        }),
        pgClient.event_participants.findMany({
            where: { user_id: userId },
            select: {
                events: { select: { grounds: { select: { turfs: { select: { city: true } } } } } },
            },
        }),
    ]);

    organized.forEach((e) => collect(e.grounds?.turfs));
    joined.forEach((p) => collect(p.events?.grounds?.turfs));

    return { cities };
}

/**
 * For a batch of candidate users, how many turfmates each shares with `myTurfmateSet`.
 * One query for the whole batch (no N+1).
 * @returns {Promise<Map<string, number>>} candidateId -> mutual count
 */
export async function computeMutualCounts(candidateIds, myTurfmateSet) {
    const counts = new Map(candidateIds.map((id) => [id, 0]));
    if (candidateIds.length === 0) return counts;

    const rows = await pgClient.connections.findMany({
        where: {
            status: "accepted",
            OR: [
                { requester_id: { in: candidateIds } },
                { recipient_id: { in: candidateIds } },
            ],
        },
        select: { requester_id: true, recipient_id: true },
    });

    for (const row of rows) {
        // Determine which side is the candidate and which is their turfmate.
        const candidate = counts.has(row.requester_id) ? row.requester_id : row.recipient_id;
        const theirMate = otherParty(row, candidate);
        if (myTurfmateSet.has(theirMate)) {
            counts.set(candidate, (counts.get(candidate) || 0) + 1);
        }
    }
    return counts;
}
