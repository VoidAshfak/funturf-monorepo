import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { timingSafeEqual } from "node:crypto";
import { ApiError } from "../utils/apiError.js";
import { ERROR_CODES } from "../utils/errorCodes.js";
import { logger } from "../../logs/logger.js";

/**
 * Rate limiting.
 *
 * Booking is the most abusable surface on the platform: an unpaid booking costs
 * the caller nothing but denies the slot to other unpaid users, so a loop could
 * carpet the whole grid. The per-user hold cap and the hold TTL (see
 * `utils/bookingService.js`) bound how much damage a spammer can hold onto;
 * these limiters bound how FAST they can try.
 *
 * Limits are keyed by USER id when authenticated, falling back to IP — otherwise
 * one NAT'd office would share a single bucket, and a logged-in attacker could
 * dodge the limit by rotating IPs.
 */

// Errors go through the normal ApiError -> errorHandler path, so a rate-limited
// caller gets the same envelope shape as any other failure.
const rateLimitHandler = (req, _res, next) => {
    logger.warn(`rate limit hit: ${req.method} ${req.originalUrl} user=${req.user?.id ?? "anon"} ip=${req.ip}`);
    next(ApiError.fromCode(ERROR_CODES.RATE_LIMITED));
};

// Authenticated callers are limited per USER, so rotating IPs buys nothing.
// Anonymous callers fall back to IP — but a raw IPv6 address is useless as a key:
// a single home connection typically owns a whole /64, so an attacker could mint
// unlimited addresses and a fresh bucket for each. `ipKeyGenerator` normalises
// IPv6 down to its subnet (and leaves IPv4 alone), which is the unit that
// actually costs an attacker something.
const keyByUserOrIp = (req) => req.user?.id ?? ipKeyGenerator(req.ip);

/**
 * Load-test bypass — OFF unless deliberately switched on.
 *
 * Why this exists: every limiter below is keyed by user-id-or-IP, and a load
 * test drives thousands of requests from ONE host. Register (3/hour) and login
 * (10/15min) wall off after a handful of virtual users, so a load run measures
 * the rate limiter instead of the API. There is no way to load test the real
 * request path without a way past them.
 *
 * Why it is safe:
 *   1. It is opt-in twice over. The operator must set LOAD_TEST_BYPASS_TOKEN
 *      *and* every request must carry it in the `x-loadtest-token` header. With
 *      the env var unset (the default, including production) `skip` is a
 *      constant `false` and the limiters behave exactly as before.
 *   2. The token must be >= 32 chars, so a guessable value can't be configured
 *      by accident. A shorter one is rejected and the bypass stays off.
 *   3. Comparison is constant-time, so the token can't be recovered by timing
 *      the endpoint.
 *   4. Enabling it logs a loud warning at boot, so a token left set on a real
 *      environment is visible in the logs rather than silent.
 *
 * NEVER set LOAD_TEST_BYPASS_TOKEN on production. Load test against staging.
 */
const LOAD_TEST_BYPASS_TOKEN = process.env.LOAD_TEST_BYPASS_TOKEN ?? "";
const loadTestBypassEnabled = LOAD_TEST_BYPASS_TOKEN.length >= 32;
const loadTestTokenBuffer = Buffer.from(LOAD_TEST_BYPASS_TOKEN, "utf8");

if (LOAD_TEST_BYPASS_TOKEN && !loadTestBypassEnabled) {
    logger.error(
        "LOAD_TEST_BYPASS_TOKEN is set but shorter than 32 characters — bypass DISABLED. Use a long random value."
    );
} else if (loadTestBypassEnabled) {
    logger.warn(
        "⚠ RATE LIMIT BYPASS ENABLED — requests carrying a valid x-loadtest-token header skip ALL rate limiters. This must never be set in production."
    );
}

/**
 * True only for a request that presents the configured bypass token.
 * `express-rate-limit` calls this as `skip`: returning true means the request is
 * neither counted nor blocked.
 */
const isLoadTestClient = (req) => {
    if (!loadTestBypassEnabled) return false;

    const presented = req.get("x-loadtest-token");
    if (!presented) return false;

    // timingSafeEqual throws on a length mismatch, so compare lengths first.
    // Length is not secret (the operator chose it), the token contents are.
    const presentedBuffer = Buffer.from(presented, "utf8");
    if (presentedBuffer.length !== loadTestTokenBuffer.length) return false;

    return timingSafeEqual(presentedBuffer, loadTestTokenBuffer);
};

const baseOptions = {
    standardHeaders: "draft-7", // RateLimit-* response headers
    legacyHeaders: false,
    keyGenerator: keyByUserOrIp,
    handler: rateLimitHandler,
    skip: isLoadTestClient,
};

/**
 * Writes that create or mutate a booking. Deliberately tight: a human books a
 * handful of slots, never 10 a minute.
 */
export const bookingWriteLimiter = rateLimit({
    ...baseOptions,
    windowMs: 60 * 1000,
    limit: 10,
});

/**
 * Public availability/quote reads. Generous (the UI polls these while the user
 * clicks around the slot grid) but still capped, so the endpoints can't be used
 * to scrape or hammer the DB.
 */
export const bookingReadLimiter = rateLimit({
    ...baseOptions,
    windowMs: 60 * 1000,
    limit: 120,
});

/**
 * Comment/like writes. Only approved players can post at all, so this is less
 * about outsiders and more about flooding: it stops a member spamming the thread
 * (or hammering the like toggle) faster than a human ever would.
 */
export const commentWriteLimiter = rateLimit({
    ...baseOptions,
    windowMs: 60 * 1000,
    limit: 20,
});

/**
 * Team writes — above all, invites. An invite pushes a high-priority
 * notification to someone else's bell, so an unbounded loop would turn a team
 * into a spam cannon. Roster edits ride the same limiter: a captain adjusts
 * positions a few times, never dozens a minute.
 */
export const teamWriteLimiter = rateLimit({
    ...baseOptions,
    windowMs: 60 * 1000,
    limit: 20,
});

/**
 * Profile self-edits. A person adjusts their own bio/photos a handful of times
 * in a sitting, never dozens a minute — and each save re-reads the profile and
 * busts the auth cache, so an unbounded loop is a cheap way to make us do work.
 */
export const profileWriteLimiter = rateLimit({
    ...baseOptions,
    windowMs: 60 * 1000,
    limit: 20,
});

/**
 * Swagger UI + raw spec (`utils/swagger.js`). Anonymous by definition, so this
 * keys on IP. One page load pulls the HTML plus a handful of static assets, so
 * the limit is generous — it exists to stop the ~9k-line spec being scraped in
 * a loop, not to ration normal reading.
 */
export const docsLimiter = rateLimit({
    ...baseOptions,
    windowMs: 60 * 1000,
    limit: 60,
});

/**
 * Login — the most attacked endpoint. Keys on IP only (no user yet).
 * 10 attempts per 15 minutes makes brute-forcing impractical while
 * tolerating a user retyping a wrong password a few times.
 */
export const loginLimiter = rateLimit({
    ...baseOptions,
    windowMs: 15 * 60 * 1000,
    limit: 10,
});

/**
 * Registration — prevents account-creation floods.
 * 3 per hour per IP. Legitimate users signing up once are never
 * affected; a script minting dummy accounts hits the wall fast.
 */
export const registerLimiter = rateLimit({
    ...baseOptions,
    windowMs: 60 * 60 * 1000,
    limit: 3,
});
