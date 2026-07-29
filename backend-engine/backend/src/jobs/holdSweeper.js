import { expireStaleHolds } from "../utils/bookingService.js";
import { logger } from "../../logs/logger.js";

/**
 * Expired-hold sweeper.
 *
 * An unpaid booking is a 2-hour soft hold on a slot. The read + create paths
 * already expire stale holds lazily for the ground/date being looked at, so
 * availability is never a lie. This job catches the rest: holds on slots nobody
 * happens to query again, which would otherwise linger as "pending" bookings in
 * the holder's list and keep their per-user hold cap consumed forever.
 *
 * Deliberately dumb — an interval, not a cron dependency. It's idempotent, so a
 * missed or doubled run is harmless.
 *
 * The API runs as a SINGLE instance, so exactly one sweeper is live. The work is
 * still written to be idempotent (each row is claimed by an UPDATE), which is
 * what makes it safe to run a second copy — a local dev server, or a future
 * scale-out — without coordination.
 */
const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes

/**
 * Random delay before the interval starts ticking.
 *
 * Keeps the sweep from landing at a fixed offset from boot, so a restart loop or
 * a second process (dev server, scale-out) doesn't put every sweep in lockstep —
 * simultaneous query bursts are expensive against a database with a very small
 * connection budget (see the pool notes in src/prisma.js).
 */
const JITTER_MS = 60 * 1000;

export function startHoldSweeper() {
    const sweep = async () => {
        try {
            const expired = await expireStaleHolds();
            if (expired > 0) logger.info(`hold sweeper: expired ${expired} stale hold(s)`);
        } catch (err) {
            // Never let a sweep failure take the process down — it's best-effort
            // cleanup, and the lazy expiry on the read path is the real guarantee.
            logger.error(`hold sweeper failed: ${err.message}`);
        }
    };

    const jitter = Math.floor(Math.random() * JITTER_MS);
    let timer = null;

    const starter = setTimeout(() => {
        timer = setInterval(sweep, SWEEP_INTERVAL_MS);
        // Don't hold the event loop open on shutdown.
        timer.unref?.();
    }, jitter);
    starter.unref?.();

    logger.info(
        `hold sweeper started (every ${SWEEP_INTERVAL_MS / 60000} min, +${Math.round(jitter / 1000)}s jitter)`
    );
    // A stop handle rather than the timer itself: the interval doesn't exist yet
    // when this returns, so there is no timer to hand back.
    return () => {
        clearTimeout(starter);
        if (timer) clearInterval(timer);
    };
}
