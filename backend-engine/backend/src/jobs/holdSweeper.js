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
 * NOTE: the API runs as 3 replicas behind nginx, so all three will sweep. That's
 * safe (the work is idempotent and each row is claimed by an UPDATE), just
 * mildly redundant. Move to a single leader or a real scheduler if that ever costs.
 */
const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes

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

    const timer = setInterval(sweep, SWEEP_INTERVAL_MS);
    // Don't hold the event loop open on shutdown.
    timer.unref?.();

    logger.info(`hold sweeper started (every ${SWEEP_INTERVAL_MS / 60000} min)`);
    return timer;
}
