import { pgClient } from "../prisma.js";
import { logger } from "../../logs/logger.js";
import { parseSlotCodeToTime } from "./timeAndDateFormatting.js";

/**
 * Booking domain helpers — centralised so the controller stays thin and pricing
 * is computed the SAME way for both the quote endpoint and real bookings (DRY).
 */

// The 90-minute discrete slot grid (matches the boolean columns on `slots`).
export const SLOT_CODES = Object.freeze([
    "t0000", "t0130", "t0300", "t0430", "t0600", "t0730", "t0900", "t1030",
    "t1200", "t1330", "t1500", "t1630", "t1800", "t1930", "t2100", "t2230",
]);

const SLOT_MINUTES = 90;

// ---------------------------------------------------------------------------
// Anti-spam policy
// ---------------------------------------------------------------------------
// An UNPAID booking is only a soft hold — it costs the holder nothing but blocks
// every other unpaid user on that slot. Left unbounded, one script could sit on
// the entire grid forever. Two limits keep that honest:
//   * holds EXPIRE (below), so an abandoned hold frees the slot on its own;
//   * a user may only hold a few slots at once.
// A PAID claim has neither limit — it carries a real transaction to verify.
export const UNPAID_HOLD_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
// Cap is PER TURF: a user may sit on at most this many unpaid holds within a
// single turf at once. Scoping it per-turf (rather than one global ceiling) lets
// a genuine organizer hold a few slots at each of several turfs while still
// stopping anyone from carpeting one turf's grid with free holds.
export const MAX_UNPAID_HOLDS_PER_TURF = 4;

// Paid/confirmed claims aren't time-boxed like unpaid holds; they stay locked
// until the booking is played or cancelled. Park the lock far in the future.
const PAID_LOCK_UNTIL = new Date("2999-12-31T00:00:00Z");

/** When does an unpaid hold created at `createdAt` die? */
export const holdExpiresAt = (createdAt) =>
    new Date(new Date(createdAt).getTime() + UNPAID_HOLD_TTL_MS);

/** Payment states that mean "money is claimed" — these hard-lock a slot. */
export const PAID_STATES = Object.freeze(["partial", "completed"]);

/** Booking states that still occupy a slot. */
export const ACTIVE_STATES = Object.freeze(["pending", "confirmed"]);

/** Is `code` a valid slot key on the grid? */
export const isValidSlotCode = (code) => SLOT_CODES.includes(code);

/**
 * Read the slot grid for a ground on a date.
 *
 * A `slots` row is an EXCEPTIONS record, not a precondition for booking: every
 * boolean column defaults to `true`, so "no row" means "the whole day is open".
 * Rows are only ever born when something needs to CLOSE a slot (an admin
 * disabling it, or a paid booking locking it) — see `lockSlot`/`unlockSlot`.
 *
 * Returning a virtual all-open grid here is what makes a freshly-created ground
 * bookable without any seeding step.
 *
 * @returns {Promise<Object>} a slots-shaped row (persisted or virtual)
 */
export async function getSlotGrid(groundId, date) {
    const row = await pgClient.slots.findUnique({
        where: { ground_id_date: { ground_id: groundId, date: new Date(date) } },
    });
    if (row) return row;

    // Virtual default — NOT written to the DB.
    const open = Object.fromEntries(SLOT_CODES.map((code) => [code, true]));
    return { ground_id: groundId, date: new Date(date), ...open };
}

/** Close a slot (paid-lock / admin-disable). Creates the exceptions row on demand. */
export async function lockSlot(groundId, date, slotCode, tx = pgClient) {
    const day = new Date(date);
    return tx.slots.upsert({
        where: { ground_id_date: { ground_id: groundId, date: day } },
        // Row didn't exist -> the rest of the day stays open (column defaults), this slot closed.
        create: { ground_id: groundId, date: day, [slotCode]: false },
        update: { [slotCode]: false },
    });
}

/** Re-open a slot (payment rejected / booking cancelled). No-op when no row exists. */
export async function unlockSlot(groundId, date, slotCode, tx = pgClient) {
    const day = new Date(date);
    return tx.slots.updateMany({
        where: { ground_id: groundId, date: day },
        data: { [slotCode]: true },
    });
}

// ---------------------------------------------------------------------------
// Slot claims — the concurrency referee
// ---------------------------------------------------------------------------
// `slot_locks` carries a DB-level `@@unique([ground_id, date, slot_code])`. That
// constraint — not an app-level "check then write" — is what makes booking
// race-proof: two concurrent requests for the same slot both try to INSERT, and
// Postgres rejects one with P2002. Because the insert happens inside the same
// transaction as the booking, the loser's booking rolls back entirely; there is
// no window in which a slot is sold twice.
//
// Every active claim (unpaid hold AND paid claim) owns a lock row. `locked_until`
// is what separates them: an unpaid hold expires, a paid claim effectively never does.
export const SLOT_LOCK_UNIQUE = "slot_locks_unique";

/** Is a Prisma error the slot_locks unique-constraint violation? */
export const isSlotLockConflict = (err) =>
    err?.code === "P2002" &&
    (err?.meta?.target === SLOT_LOCK_UNIQUE ||
        String(err?.meta?.target ?? "").includes("slot"));

/**
 * Claim (ground, date, slot) for a user. Throws P2002 if someone already holds it —
 * callers run this inside a transaction and map that to SLOT_UNAVAILABLE.
 */
export function claimSlot(tx, { groundId, date, slotCode, userId, paid }) {
    return tx.slot_locks.create({
        data: {
            ground_id: groundId,
            date: new Date(date),
            slot_code: slotCode,
            locked_by_user_id: userId,
            locked_until: paid ? PAID_LOCK_UNTIL : new Date(Date.now() + UNPAID_HOLD_TTL_MS),
        },
    });
}

/** Hand an existing claim to a new holder (paid booking superseding an unpaid hold). */
export function takeOverSlotClaim(tx, { groundId, date, slotCode, userId, paid }) {
    return tx.slot_locks.update({
        where: {
            ground_id_date_slot_code: { ground_id: groundId, date: new Date(date), slot_code: slotCode },
        },
        data: {
            locked_by_user_id: userId,
            locked_until: paid ? PAID_LOCK_UNTIL : new Date(Date.now() + UNPAID_HOLD_TTL_MS),
        },
    });
}

/** Drop a claim (booking cancelled / payment rejected). Safe when no row exists. */
export function releaseSlotClaim(groundId, date, slotCode, tx = pgClient) {
    return tx.slot_locks.deleteMany({
        where: { ground_id: groundId, date: new Date(date), slot_code: slotCode },
    });
}

// A lock's `locked_until` is the single source of truth for expiry — NOT the
// booking's created_at. That matters: when an admin rejects a payment hours
// later, the booking reverts to an unpaid hold whose TTL restarts from that
// moment. Deriving expiry from created_at would kill it instantly.
//
// Unpaid locks always sit within `now + TTL`; paid locks are parked in 2999. So
// "expires within the TTL horizon" cleanly identifies an unpaid hold.
const unpaidLockWindow = () => ({
    gt: new Date(),
    lte: new Date(Date.now() + UNPAID_HOLD_TTL_MS + 60_000), // +1min slack
});

/**
 * Kill unpaid holds that outlived their TTL: cancel the booking and drop the
 * lock, so the slot is genuinely free again.
 *
 * Called lazily on the availability + create paths (availability is therefore
 * always truthful with no cron in the way), and by the sweeper job for holds
 * nobody ever looks at again. Scope to a ground/date when you have one.
 *
 * @returns {Promise<number>} how many holds were expired
 */
export async function expireStaleHolds({ groundId, date } = {}) {
    const expired = await pgClient.slot_locks.findMany({
        where: {
            ...(groundId ? { ground_id: groundId } : {}),
            ...(date ? { date: new Date(date) } : {}),
            locked_until: { lt: new Date() },
        },
    });
    if (expired.length === 0) return 0;

    await pgClient.$transaction([
        // Cancel the unpaid bookings those dead locks were holding.
        ...expired.map((lock) =>
            pgClient.bookings.updateMany({
                where: {
                    ground_id: lock.ground_id,
                    booking_date: lock.date,
                    booking_status: "pending",
                    payment_status: "pending", // never touch a paid claim
                    slot: { path: ["code"], equals: lock.slot_code },
                },
                data: {
                    booking_status: "cancelled",
                    cancelled_at: new Date(),
                    cancellation_reason: "unpaid_hold_expired",
                },
            })
        ),
        pgClient.slot_locks.deleteMany({
            where: {
                ...(groundId ? { ground_id: groundId } : {}),
                ...(date ? { date: new Date(date) } : {}),
                locked_until: { lt: new Date() },
            },
        }),
    ]);

    logger.info(`Expired ${expired.length} stale unpaid hold(s)`);
    return expired.length;
}

/**
 * How many live unpaid holds is this user sitting on WITHIN one turf?
 *
 * `slot_locks` only carries `ground_id`, so we reach the turf through the
 * grounds relation (`grounds.turf_id`). This is the anti-spam lever enforced in
 * createBooking against MAX_UNPAID_HOLDS_PER_TURF.
 */
export function countActiveUnpaidHoldsForTurf(userId, turfId) {
    return pgClient.slot_locks.count({
        where: {
            locked_by_user_id: userId,
            locked_until: unpaidLockWindow(),
            grounds: { turf_id: turfId },
        },
    });
}

/** "18:00:00" + 90min -> "19:30:00" (end time of a slot, for display/storage). */
export function slotEndTime(slotCode) {
    const hh = parseInt(slotCode.slice(1, 3), 10);
    const mm = parseInt(slotCode.slice(3, 5), 10);
    const total = hh * 60 + mm + SLOT_MINUTES;
    const eh = Math.floor(total / 60) % 24;
    const em = total % 60;
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}:00`;
}

/**
 * Compute the price of a single 90-min slot, applying peak/weekend rates and an
 * optional promo code. Pure pricing — availability is checked separately.
 *
 * @param {Object}  params
 * @param {Object}  params.ground       loaded grounds row
 * @param {string}  params.slotCode     e.g. "t1800"
 * @param {string}  params.bookingDate  "YYYY-MM-DD"
 * @param {string} [params.promoCode]
 * @param {string} [params.userId]     the booker (enables user-targeted coupons)
 * @returns {Promise<{slot_time,day_of_week,is_peak,is_weekend,base_rate,discount,final_price,promotion}>}
 */
export async function computeSlotPricing({ ground, slotCode, bookingDate, promoCode, userId }) {
    const slot_time = parseSlotCodeToTime(slotCode);
    // Parse the booking date as UTC midnight ("...T00:00:00Z") so getUTCDay()
    // returns the CALENDAR weekday. Without the "Z" the string is read as local
    // midnight and getUTCDay() shifts it a day on any UTC+ server — which made a
    // Friday slot read as Thursday and wrongly failed day-scoped coupons.
    const js_date = new Date(bookingDate + "T00:00:00Z");
    const day_of_week = js_date.getUTCDay();

    const hourly_rate = Number(ground.hourly_rate);
    const weekend_rate = ground.weekend_hourly_rate ? Number(ground.weekend_hourly_rate) : hourly_rate;
    const peak_rate = ground.peak_hour_rate ? Number(ground.peak_hour_rate) : hourly_rate;
    const off_peak_rate = ground.off_peak_hour_rate ? Number(ground.off_peak_hour_rate) : hourly_rate;

    // BD weekend = Fri/Sat (day indices 5,6).
    const is_weekend = [5, 6].includes(day_of_week);

    const peak_setting = await pgClient.peak_hour_settings.findFirst({
        where: {
            ground_id: ground.id,
            day_of_week,
            is_active: true,
            start_time: { lte: new Date(`1970-01-01T${slot_time}`) },
            end_time: { gt: new Date(`1970-01-01T${slot_time}`) },
        },
    });
    const is_peak = !!peak_setting;

    let base_rate;
    if (is_peak) base_rate = peak_rate;
    else if (is_weekend) base_rate = weekend_rate;
    else base_rate = off_peak_rate;

    let discount = 0;
    let promotion = null;

    if (promoCode) {
        // Find the active code whose SCOPE covers this booking: the exact ground,
        // OR the whole turf, OR a global (turf-less) promo. The validity WINDOW is
        // checked below against the BOOKING date (you book slots in advance), not
        // the moment of checkout.
        const promo = await pgClient.promotions.findFirst({
            where: {
                code: promoCode.toString().trim().toUpperCase(),
                status: "active",
                OR: [
                    { ground_id: ground.id },
                    { ground_id: null, turf_id: ground.turf_id },
                    { ground_id: null, turf_id: null },
                ],
            },
        });

        // Validity window vs the booking DATE (date-only compare, TZ-safe).
        const inWindow =
            promo &&
            bookingDate >= promo.valid_from.toISOString().slice(0, 10) &&
            bookingDate <= promo.valid_until.toISOString().slice(0, 10);

        // JS-side eligibility: window, day / user targeting, usage cap, min spend.
        const eligible =
            promo &&
            inWindow &&
            // weekday targeting (0=Sun..6=Sat)
            (!Array.isArray(promo.applicable_days) ||
                promo.applicable_days.length === 0 ||
                promo.applicable_days.includes(day_of_week)) &&
            // user targeting (only enforced when we know who's booking)
            (!Array.isArray(promo.applicable_users) ||
                promo.applicable_users.length === 0 ||
                (userId && promo.applicable_users.includes(userId))) &&
            // global usage cap
            (promo.usage_limit == null || (promo.used_count ?? 0) < promo.usage_limit) &&
            // minimum booking amount
            (!promo.minimum_booking_amount || base_rate >= Number(promo.minimum_booking_amount));

        if (eligible) {
            let raw_discount =
                promo.discount_type === "percentage"
                    ? base_rate * (Number(promo.discount_value) / 100)
                    : Number(promo.discount_value);
            if (promo.maximum_discount_amount != null) {
                raw_discount = Math.min(raw_discount, Number(promo.maximum_discount_amount));
            }
            // Never discount below zero.
            discount = Math.min(raw_discount, base_rate);
            promotion = { id: promo.id, code: promo.code };
        }
    }

    const final_price = Math.max(base_rate - discount, 0);

    return { slot_time, day_of_week, is_peak, is_weekend, base_rate, discount, final_price, promotion };
}

// ---------------------------------------------------------------------------
// Input hardening
// ---------------------------------------------------------------------------

/**
 * Is `bookingDate` inside the bookable window?
 *  - not in the past (you can't book yesterday);
 *  - not beyond the turf's `advance_booking_days` (default 30) — this also caps
 *    how far ahead a spammer can carpet the calendar.
 * @returns {"past"|"too_far"|null} the reason it's rejected, or null when fine
 */
export function checkBookingWindow(bookingDate, advanceBookingDays = 30) {
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = startOfDay(new Date(bookingDate));
    const today = startOfDay(new Date());

    if (day < today) return "past";

    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + (advanceBookingDays ?? 30));
    if (day > horizon) return "too_far";

    return null;
}

// Payment proofs are uploaded through our own /api/upload -> imgbb flow, so a
// proof URL should only ever point at an imgbb host. Anything else is attacker-
// controlled: the turf admin clicks that link from the dashboard, which makes an
// arbitrary URL a phishing / malware delivery vector. Allowlist the host.
const PROOF_URL_HOSTS = Object.freeze(["i.ibb.co", "ibb.co", "image.ibb.co"]);

/** Is this payment-proof URL one we actually hosted? */
export function isAllowedProofUrl(url) {
    if (!url) return true; // no proof supplied is fine — a transaction_id can stand alone
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") return false;
        return PROOF_URL_HOSTS.includes(parsed.hostname);
    } catch {
        return false; // not even a URL
    }
}

/**
 * Trust snapshot for an event attached to a booking — lets the turf admin judge
 * how real the game is before confirming (how many players joined, capacity,
 * organizer). Returns null if the event no longer exists.
 */
export async function getEventTrust(eventId) {
    if (!eventId) return null;

    const event = await pgClient.events.findUnique({
        where: { id: eventId },
        select: {
            id: true,
            title: true,
            event_date: true,
            start_time: true,
            end_time: true,
            min_players: true,
            max_players: true,
            current_players: true,
            status: true,
            users: {
                select: { id: true, first_name: true, last_name: true, profile_picture_url: true },
            },
        },
    });
    if (!event) return null;

    // Approved players are the confirmed squad — the strongest trust signal.
    const approved_count = await pgClient.event_participants.count({
        where: { event_id: eventId, status: "approved" },
    });

    const { users, ...rest } = event;
    return { ...rest, organizer: users, approved_count };
}

/**
 * Short, human-typable ticket handle — "FT-7K3QX9A1", the first 8 hex of the
 * booking id.
 *
 * WHY THE SERVER OWNS THIS: the ref is a projection of the *internal* booking
 * UUID, and `lookupBookingByRef` resolves it with a SQL prefix match against
 * that same UUID. Since public ids are masked at the API boundary, the client no
 * longer has the value this is derived from and cannot compute the ref itself —
 * so it has to be sent. That is the right split regardless: a lookup key whose
 * shape is dictated by a database column belongs to the server, not to a
 * frontend helper that has to be kept in sync by hand.
 */
export const bookingRef = (id) =>
    id ? `FT-${String(id).replace(/-/g, "").slice(0, 8).toUpperCase()}` : null;

/**
 * Stamp `ref` onto a booking row, or onto every row of a list. Call this on any
 * booking that is about to be returned, so the printable ticket, the verify
 * screen and the dashboard all get the same handle from one place.
 */
export const withBookingRef = (booking) => {
    if (Array.isArray(booking)) return booking.map(withBookingRef);
    if (!booking || typeof booking !== "object") return booking;
    return { ...booking, ref: bookingRef(booking.id) };
};
