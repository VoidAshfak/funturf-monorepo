import { completeExpiredEvents } from "../utils/eventService.js";
import { logger } from "../../logs/logger.js";

/**
 * Expired-game sweeper.
 *
 * A game (event) is "live" while its status is open/ready/booked. Once its slot
 * has ended it should stop showing up as joinable and settle into `completed`.
 * Nothing lazily does this on read, so this background job is the source of
 * truth: every tick it transitions any live event whose slot end time has passed.
 *
 * Deliberately dumb — an interval, not a cron dependency (mirrors holdSweeper).
 * The underlying UPDATE only touches rows still in a sweepable status, so it's
 * idempotent: a missed, doubled, or multi-replica run is harmless.
 *
 * NOTE: the API runs as 3 replicas behind nginx, so all three sweep. Safe (each
 * row is claimed by the UPDATE's WHERE), just mildly redundant. Move to a single
 * leader or a real scheduler if that ever costs.
 */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

/**
 * Random delay applied to both the boot sweep and the interval start, so the
 * three replicas don't fire their queries in lockstep against a database with a
 * very small connection budget (see the pool notes in src/prisma.js).
 */
const JITTER_MS = 60 * 1000;

export function startEventSweeper() {
    const sweep = async () => {
        try {
            const completed = await completeExpiredEvents();
            if (completed > 0) logger.info(`event sweeper: completed ${completed} expired game(s)`);
        } catch (err) {
            // Never let a sweep failure take the process down — it's best-effort
            // background cleanup.
            logger.error(`event sweeper failed: ${err.message}`);
        }
    };

    const jitter = Math.floor(Math.random() * JITTER_MS);
    let timer = null;

    // Run once shortly after boot so a freshly started process doesn't wait a
    // full interval to catch games that expired while it was down. The jitter
    // keeps three replicas from doing that boot sweep simultaneously.
    const boot = setTimeout(sweep, 15 * 1000 + jitter);
    boot.unref?.();

    const starter = setTimeout(() => {
        timer = setInterval(sweep, SWEEP_INTERVAL_MS);
        // Don't hold the event loop open on shutdown.
        timer.unref?.();
    }, jitter);
    starter.unref?.();

    logger.info(
        `event sweeper started (every ${SWEEP_INTERVAL_MS / 60000} min, +${Math.round(jitter / 1000)}s jitter)`
    );
    // A stop handle rather than the timer itself: the interval doesn't exist yet
    // when this returns, so there is no timer to hand back.
    return () => {
        clearTimeout(boot);
        clearTimeout(starter);
        if (timer) clearInterval(timer);
    };
}
