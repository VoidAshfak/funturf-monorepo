import { pgClient } from "../prisma.js";
import { createNotification } from "./notificationService.js";
import { emitToEvent } from "../socket.js";
import { ApiError } from "./apiError.js";
import { ERROR_CODES } from "./errorCodes.js";
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
 * May `userId` post in this event's discussion?
 *
 * The squad's discussion is for the squad: only people who are actually IN the
 * match may write. That means the organizer, a co_organizer, or a participant
 * whose join request was APPROVED. A `requested` (pending) or `rejected` user
 * can read the thread but not post — reading is public, writing is earned.
 *
 * @returns {Promise<boolean>}
 */
export async function canCommentOnEvent(eventId, userId) {
    if (!userId) return false;

    // Organizer and co_organizers are admins — always allowed.
    if (await isEventAdmin(eventId, userId)) return true;

    const participant = await pgClient.event_participants.findFirst({
        where: { event_id: eventId, user_id: userId, status: "approved" },
        select: { id: true },
    });
    return Boolean(participant);
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

/**
 * Notify every APPROVED participant of an event (the confirmed squad), optionally
 * excluding some ids (e.g. the organizer who triggered the change). Best-effort.
 *
 * @returns {Promise<number>} how many participants were notified
 */
export async function notifyEventParticipants(eventId, payload, excludeUserIds = []) {
    try {
        const rows = await pgClient.event_participants.findMany({
            where: { event_id: eventId, status: "approved" },
            select: { user_id: true },
        });
        const targets = [...new Set(rows.map((r) => r.user_id))].filter(
            (id) => !excludeUserIds.includes(id)
        );
        if (targets.length === 0) return 0;

        await Promise.all(
            targets.map((uid) => createNotification({ ...payload, user_id: uid }))
        );
        logger.info(`event-participant notify: event=${eventId} -> ${targets.length}`);
        return targets.length;
    } catch (err) {
        logger.error(`notifyEventParticipants failed: ${err.message}`);
        return 0;
    }
}

/**
 * Validate a booking the caller wants to attach to a match, and resolve the
 * venue/ground/date/slot it dictates. Shared by event create/edit so a match's
 * schedule always mirrors its real reservation (DRY, single source of truth).
 *
 * Rules: the booking must exist, belong to `userId`, and not already be tied to a
 * DIFFERENT event (re-attaching the booking already on `currentEventId` is a no-op
 * that's allowed).
 *
 * @returns {Promise<{ groundId, venueId, date, startTime, endTime }>}
 * @throws ApiError BOOKING_NOT_FOUND | VALIDATION_ERROR | BOOKING_ALREADY_ATTACHED
 */
export async function resolveBookingAttachment(bookingId, userId, currentEventId = null) {
    const booking = await pgClient.bookings.findUnique({
        where: { id: bookingId },
        select: {
            id: true, user_id: true, event_id: true,
            ground_id: true, booking_date: true, slot: true,
        },
    });
    if (!booking) throw ApiError.fromCode(ERROR_CODES.BOOKING_NOT_FOUND);
    if (booking.user_id !== userId) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "You can only attach a booking you made",
        });
    }
    // Already attached to some OTHER event -> blocked.
    if (booking.event_id && booking.event_id !== currentEventId) {
        throw ApiError.fromCode(ERROR_CODES.BOOKING_ALREADY_ATTACHED);
    }

    // Resolve the ground's turf so the event's venue_id stays consistent.
    const ground = booking.ground_id
        ? await pgClient.grounds.findUnique({
              where: { id: booking.ground_id },
              select: { turf_id: true },
          })
        : null;

    const slot = booking.slot || {};
    return {
        groundId: booking.ground_id ?? null,
        venueId: ground?.turf_id ?? null,
        date: booking.booking_date ?? null,     // Date
        startTime: slot.start_time ?? null,      // "HH:MM"
        endTime: slot.end_time ?? null,          // "HH:MM"
    };
}

/* ------------------------------------------------------------------ *
 *  Expired-event sweep
 * ------------------------------------------------------------------ */

// Statuses that still represent a "live" game. Once a game's slot has ended,
// these are auto-transitioned to `completed`. Terminal states (`completed`,
// `cancelled`) are never touched — the WHERE clause below excludes them, which
// is also what makes the UPDATE idempotent and safe to run on every replica.
const SWEEPABLE_STATUSES = ["open", "ready", "booked"];

// Event times (`event_date`, `start_time`, `end_time`) are stored as *naive*
// date/time values that mean Bangladesh wall-clock (UTC+6, no DST). To decide if
// a game has ended we must compare them against "now" expressed in the SAME
// naive local frame — comparing against the DB's `now()` (timestamptz) would be
// off by the server's timezone. Override via APP_TZ_OFFSET_MINUTES if the app
// ever serves a different region.
const APP_TZ_OFFSET_MIN = Number(process.env.APP_TZ_OFFSET_MINUTES ?? 360); // +06:00

// Current instant as a naive "YYYY-MM-DD HH:mm:ss" string in the app timezone.
// We shift the UTC instant by the offset, then read it with UTC getters so the
// wall-clock digits are the target-zone digits.
function nowNaiveLocal() {
    const shifted = new Date(Date.now() + APP_TZ_OFFSET_MIN * 60_000);
    const p = (n) => String(n).padStart(2, "0");
    return (
        `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())} ` +
        `${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}:${p(shifted.getUTCSeconds())}`
    );
}

/**
 * Take down expired games: flip every live event whose slot has already ended
 * to `completed`. Called on an interval by jobs/eventSweeper.js.
 *
 * The end instant is `event_date + end_time`, with a +1 day correction for slots
 * that cross midnight (`end_time <= start_time`, e.g. a 22:30–00:00 slot) so we
 * never mark such a game finished before it starts. Everything is compared in
 * the naive local frame (see nowNaiveLocal).
 *
 * Idempotent: re-running only affects rows still in a sweepable status, so
 * concurrent replica runs and repeated ticks are harmless.
 *
 * @returns {Promise<number>} how many events were completed this pass
 */
export async function completeExpiredEvents() {
    const nowLocal = nowNaiveLocal();

    // Parameterised raw UPDATE. Status literals are a fixed constant list (not
    // user input) so they're inlined; only the timestamp is a bound parameter.
    //
    // RETURNING is what makes notification exactly-once across replicas: the row
    // transition is the "claim". Two replicas may run this concurrently, but
    // Postgres row-locking means only the one that actually flips a row gets it
    // back here — the loser's WHERE no longer matches, so it returns 0 rows and
    // notifies nobody. No dedupe table / distributed lock needed.
    const completed = await pgClient.$queryRaw`
        UPDATE events
        SET status = 'completed', updated_at = now()
        WHERE status IN ('open', 'ready', 'booked')
          AND (
                event_date
                + end_time
                + CASE WHEN end_time <= start_time THEN interval '1 day'
                       ELSE interval '0'          END
              ) < ${nowLocal}::timestamp
        RETURNING id, title, organizer_id
    `;

    if (completed.length === 0) return 0;

    // Best-effort: tell everyone who was in each finished game. Never let a
    // notify failure undo the completion — it already committed above.
    await notifyGamesCompleted(completed).catch((err) =>
        logger.error(`notifyGamesCompleted failed: ${err.message}`)
    );

    return completed.length;
}

/**
 * Fan out an `event_completed` notification to every member of each just-ended
 * game, and nudge any open match page to refresh.
 *
 * Recipients per game = organizer + all APPROVED participants (deduped). We load
 * participants for the whole batch in one query, then group in memory (avoids an
 * N+1 across events).
 *
 * @param {Array<{id:string,title:string,organizer_id:string}>} events completed rows
 */
async function notifyGamesCompleted(events) {
    const eventIds = events.map((e) => e.id);

    // Approved participants across the whole batch, one round-trip.
    const participants = await pgClient.event_participants.findMany({
        where: { event_id: { in: eventIds }, status: "approved" },
        select: { event_id: true, user_id: true },
    });

    // event_id -> Set(user_id) of approved participants.
    const byEvent = new Map();
    for (const p of participants) {
        if (!byEvent.has(p.event_id)) byEvent.set(p.event_id, new Set());
        byEvent.get(p.event_id).add(p.user_id);
    }

    for (const event of events) {
        // Organizer is always a member even without an event_participants row.
        const recipients = byEvent.get(event.id) ?? new Set();
        recipients.add(event.organizer_id);

        await Promise.all(
            [...recipients].map((uid) =>
                createNotification({
                    user_id: uid,
                    type: "event_completed",
                    title: "Game completed",
                    message: `"${event.title}" has finished. Rate your teammates and the turf!`,
                    data: { event_id: event.id },
                    priority: "low",
                    action_url: `/events/${event.id}`,
                })
            )
        );

        // Non-sensitive live signal so anyone viewing the match page sees it
        // flip to "completed" without a manual refresh (frontend already
        // refetches the event on this room event).
        emitToEvent(event.id, "event:roster", { eventId: event.id });

        logger.info(
            `event completed: id=${event.id} notified ${recipients.size} member(s)`
        );
    }
}
