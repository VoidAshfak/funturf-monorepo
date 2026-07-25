import { pgClient } from "../prisma.js";
import userCache from "./cache.js";
import { SLOT_CODES, SLOT_MINUTES, slotStartMinute } from "./slotGrid.js";

/**
 * Operating-hours gate for the 90-minute slot grid.
 *
 * The grid itself is fixed (`t0000 … t2230`, see slotGrid.js), but a turf only
 * trades between its `operating_hours.open` and `.close`. This module decides
 * which of those 16 codes actually fall inside a given turf's trading day, so a
 * slot that runs past closing is never offered, quoted, or booked.
 *
 * It is a PURE derivation — nothing is persisted. That is what makes the
 * requirement "change the hours and availability updates" free: the next read
 * recomputes from the new hours, with no backfill and no stale rows to reconcile.
 */

/**
 * How far a slot may overrun closing time and still be sold.
 *
 * A turf that closes at 23:30 would otherwise lose its 22:30 slot over a
 * 30-minute tail, which is not how grounds are run in practice — the last game
 * finishes a little after the gate time. The overrun must be STRICTLY under this
 * value, so at least 45 of the slot's 90 minutes are inside the trading day.
 *
 *   close 23:00 -> t2230 ends 00:00, overrun 60  -> closed
 *   close 23:15 -> t2230 ends 00:00, overrun 45  -> closed (not strictly under)
 *   close 23:30 -> t2230 ends 00:00, overrun 30  -> OPEN
 */
export const CLOSING_GRACE_MINUTES = 45;

const MINUTES_PER_DAY = 24 * 60;

// Hours are read on every availability call but change perhaps once a year, so
// they live in the shared node-cache. `updateVenue` busts these keys when the
// hours actually change (see invalidateGroundHoursForTurf).
const HOURS_CACHE_PREFIX = "ophrs:";
const HOURS_CACHE_TTL_SECONDS = 10 * 60;

/**
 * "22:30" | "22:30:00" -> 1350. Returns null for anything unparseable, which the
 * callers below read as "no hours configured" (= open all day).
 */
export function minutesFromHHMM(value) {
    if (typeof value !== "string") return null;
    const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 24 || minutes > 59) return null;

    // "24:00" is a legitimate way to write midnight-close; fold it to 0 so the
    // wrap-around maths below treats it the same as "00:00".
    return (hours * 60 + minutes) % MINUTES_PER_DAY;
}

/**
 * Normalise a turf's `operating_hours` Json into a trading WINDOW.
 *
 * Returns `{ openMinute, lengthMinutes }` where `lengthMinutes` is measured
 * forward from opening. Expressing it that way (rather than as two clock times)
 * is what makes overnight hours fall out for free: a turf open 18:00 -> 02:00 is
 * simply `openMinute 1080, lengthMinutes 480` — no special case, no branch.
 *
 * A missing, malformed, or zero-length (`open === close`) value means 24 hours
 * open. That is the backward-compatible reading: turfs onboarded before hours
 * were enforced have no value stored, and must keep their full grid.
 */
export function toTradingWindow(operatingHours) {
    const openMinute = minutesFromHHMM(operatingHours?.open);
    const closeMinute = minutesFromHHMM(operatingHours?.close);

    if (openMinute === null || closeMinute === null) {
        return { openMinute: 0, lengthMinutes: MINUTES_PER_DAY, alwaysOpen: true };
    }

    // (close - open) mod 1440 wraps correctly for overnight hours. A zero result
    // means open === close, which reads as round-the-clock rather than "shut".
    const span = (closeMinute - openMinute + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return {
        openMinute,
        lengthMinutes: span === 0 ? MINUTES_PER_DAY : span,
        alwaysOpen: span === 0,
    };
}

/**
 * Does this slot fall inside the trading window (with the closing grace)?
 *
 * Two conditions, both measured relative to opening:
 *   1. the slot must START during trading hours;
 *   2. it may only run past closing by less than CLOSING_GRACE_MINUTES.
 *
 * Condition 2 subsumes "don't sell a slot that starts 10 minutes before we shut"
 * — that slot overruns by 80 minutes and is rejected by the same test.
 */
export function isSlotWithinHours(slotCode, operatingHours) {
    const { openMinute, lengthMinutes, alwaysOpen } = toTradingWindow(operatingHours);
    if (alwaysOpen) return true;

    const startOffset =
        (slotStartMinute(slotCode) - openMinute + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    if (startOffset >= lengthMinutes) return false; // starts after closing

    const overrun = startOffset + SLOT_MINUTES - lengthMinutes;
    return overrun < CLOSING_GRACE_MINUTES;
}

// Memoised per distinct hours pair. There are 16 codes and a handful of distinct
// opening-hour combinations across the whole platform, so this collapses the
// per-request work to a single Map lookup after the first call.
const closedSlotCache = new Map();

/** Shared immutable "nothing is closed" result for 24h turfs. */
const EMPTY_SET = Object.freeze(new Set());

/**
 * The slot codes a turf with these hours never sells, as a Set.
 *
 * @param {{open?: string, close?: string}|null} operatingHours
 * @returns {Set<string>} empty when the turf trades 24h
 */
export function closedSlotCodes(operatingHours) {
    const { openMinute, lengthMinutes, alwaysOpen } = toTradingWindow(operatingHours);
    if (alwaysOpen) return EMPTY_SET;

    const key = `${openMinute}-${lengthMinutes}`;
    let cached = closedSlotCache.get(key);
    if (!cached) {
        cached = new Set(SLOT_CODES.filter((code) => !isSlotWithinHours(code, operatingHours)));
        closedSlotCache.set(key, cached);
    }
    return cached;
}

// ---------------------------------------------------------------------------
// Reading a ground's hours
// ---------------------------------------------------------------------------

/**
 * The operating hours that govern a GROUND, cached.
 *
 * Hours live on the turf, but everything downstream (bookings, locks, the slot
 * grid) is ground-scoped, so this hides the join. Returns `{open, close}` or null
 * when the ground has no hours configured (-> 24h open).
 */
export async function getGroundOperatingHours(groundId) {
    const key = HOURS_CACHE_PREFIX + groundId;
    const hit = userCache.get(key);
    if (hit !== undefined) return hit;

    const ground = await pgClient.grounds.findUnique({
        where: { id: groundId },
        select: { turfs: { select: { operating_hours: true } } },
    });
    const hours = ground?.turfs?.operating_hours ?? null;

    userCache.set(key, hours, HOURS_CACHE_TTL_SECONDS);
    return hours;
}

/**
 * Drop the cached hours for every ground under a turf.
 *
 * Called when an admin edits the turf's opening/closing time, so the very next
 * availability read reflects the new grid instead of waiting out the TTL. This
 * is the "hours change -> availability changes immediately" guarantee.
 */
export async function invalidateGroundHoursForTurf(turfId) {
    const grounds = await pgClient.grounds.findMany({
        where: { turf_id: turfId },
        select: { id: true },
    });
    userCache.del(grounds.map((g) => HOURS_CACHE_PREFIX + g.id));
    return grounds.length;
}

/** Seed/refresh the cache from hours we already loaded, to save a round-trip. */
export function primeGroundOperatingHours(groundId, hours) {
    userCache.set(HOURS_CACHE_PREFIX + groundId, hours ?? null, HOURS_CACHE_TTL_SECONDS);
}

/** "06:00" + "23:30" -> "06:00 – 23:30", for error messages. */
export const formatHours = (operatingHours) =>
    operatingHours?.open && operatingHours?.close
        ? `${operatingHours.open} – ${operatingHours.close}`
        : "24 hours";
