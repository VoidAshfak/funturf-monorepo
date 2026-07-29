/**
 * The app's wall-clock frame.
 *
 * Event times (`events.event_date`, `start_time`, `end_time`) and slot dates are
 * stored as *naive* date/time values that mean Bangladesh wall-clock (UTC+6, no
 * DST). Anything that has to answer "has this already happened?" must compare
 * against a "now" expressed in the SAME naive frame — comparing against the
 * server's `Date.now()` or the database's `now()` is off by whatever timezone
 * the host happens to run in, which on Render is UTC.
 *
 * This module is the single definition of that frame. Import from here rather
 * than re-deriving the offset; override for a different region with
 * APP_TZ_OFFSET_MINUTES.
 */

/** Minutes to add to UTC to reach app-local wall clock. +06:00 for Bangladesh. */
export const APP_TZ_OFFSET_MIN = Number(process.env.APP_TZ_OFFSET_MINUTES ?? 360);

/** The current instant shifted into the app timezone, read with UTC getters. */
function shiftedNow() {
    return new Date(Date.now() + APP_TZ_OFFSET_MIN * 60_000);
}

const pad = (n) => String(n).padStart(2, "0");

/** Current instant as a naive "YYYY-MM-DD HH:mm:ss" string in app-local time. */
export function nowNaiveLocal() {
    const d = shiftedNow();
    return (
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
        `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
    );
}

/** Today's date in app-local time as "YYYY-MM-DD". */
export function todayLocalISO() {
    const d = shiftedNow();
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Minutes since app-local midnight — the same unit `slotStartMinute()` returns,
 * so the two can be compared directly to tell whether a slot has already begun.
 */
export function nowLocalMinutes() {
    const d = shiftedNow();
    return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/**
 * Is `date` (a "YYYY-MM-DD" string or Date) today in app-local time? Slots only
 * need the "already started" filter on today; every future date is fully open.
 */
export function isTodayLocal(date) {
    const iso = date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10);
    return iso === todayLocalISO();
}
