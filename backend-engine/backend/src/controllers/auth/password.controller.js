import crypto from "node:crypto";
import bcrypt from "bcrypt";

import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";
import { pgClient } from "../../prisma.js";
import { logger } from "../../../logs/logger.js";
import { sendMail } from "../../utils/mailer.js";
import { passwordResetEmail, passwordChangedEmail } from "../../utils/emailTemplates.js";
import { assertPasswordPolicy, BCRYPT_ROUNDS } from "../../utils/passwordPolicy.js";
import userCache, { del as cacheDel } from "../../utils/cache.js";

/**
 * Forgot / reset password.
 *
 * THE FLOW
 *   1. POST /users/password/forgot   { email }
 *      -> mints a single-use token, emails `${FRONTEND_URL}/reset-password?token=…`
 *      -> ALWAYS answers 200 with the same message (see "no enumeration" below)
 *   2. POST /users/password/reset/validate { token }
 *      -> pre-flight so the UI can say "this link expired" before showing a form
 *   3. POST /users/password/reset    { token, password }
 *      -> sets the new hash, kills every session, emails a security notice
 *
 * WHY THE TOKEN TRAVELS IN A POST BODY, NOT A QUERY STRING
 * The obvious design is `GET /password/reset/validate?token=…`. We do not do that
 * because this app logs every request line with morgan — a token in the URL would
 * be written verbatim into the API logs (and into any proxy's access log, and
 * into Referer headers on outbound links from the page). A single-use credential
 * belongs in a body, which is not logged.
 *
 * ACCOUNT EXISTENCE IS DISCLOSED — DELIBERATE PRODUCT DECISION
 * Step 1 answers 404 USER_NOT_FOUND for an address that has no account, so the
 * frontend can send that person to /signup instead of leaving them staring at a
 * "check your inbox" panel for an email that will never arrive.
 *
 * Understand the cost before changing anything here: this makes the endpoint a
 * membership oracle. Anyone can test whether a given email plays on FunTurf. What
 * keeps it from being a bulk harvesting tool:
 *   - passwordResetRequestLimiter — 5 requests per hour per IP (rateLimit.middleware.js)
 *   - every miss is logged with the caller's IP, so sweeps are visible
 * If we ever need to close the oracle, the change is exactly one branch below
 * (return the generic 200 instead of throwing) plus the USER_NOT_FOUND handler in
 * frontend-engine/src/components/forms/forgot-password-form.jsx.
 *
 * A SUSPENDED account still gets the generic 200, NOT a 404. It exists, so
 * pointing its owner at the signup form would be wrong, and "suspended" is not
 * something we volunteer to an anonymous caller.
 */

// --- configuration -----------------------------------------------------------

/** 32 bytes = 256 bits of CSPRNG output; 43 URL-safe characters once encoded. */
const TOKEN_BYTES = 32;

/**
 * Link lifetime. Short by design: the window in which a leaked email (shared
 * screen, forwarded thread, compromised inbox backup) is still usable.
 * Clamped so a typo in .env can't produce a 1-minute or a 1-year link.
 */
const TTL_MINUTES = Math.min(
    Math.max(Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES) || 30, 5),
    120
);

/**
 * Per-ACCOUNT cooldown between reset emails. The IP rate limiter caps one
 * caller; this caps one victim, so an attacker on rotating IPs still cannot
 * flood somebody else's inbox by looping the form.
 */
const RESEND_COOLDOWN_SECONDS = 60;

/** Where the emailed link points. Must be the FRONTEND origin, not the API's. */
const FRONTEND_URL = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/+$/, "");

// --- helpers -----------------------------------------------------------------

/**
 * SHA-256 hex digest — what we persist. See the model comment in schema.prisma
 * for why a fast hash is the right choice for a high-entropy token.
 */
const hashToken = (rawToken) => crypto.createHash("sha256").update(rawToken).digest("hex");

/**
 * Mask an address for display on the reset page ("t••••d@gmail.com").
 * Confirms to the user which account they are resetting without printing an
 * address that anyone holding the link could then harvest.
 */
const maskEmail = (email) => {
    const [local, domain] = String(email).split("@");
    if (!domain) return "•••";
    if (local.length <= 2) return `${local[0]}•••@${domain}`;
    return `${local[0]}${"•".repeat(Math.min(local.length - 2, 6))}${local.at(-1)}@${domain}`;
};

/**
 * The one 200 body every non-404 /forgot outcome returns — mail sent, account
 * suspended, or cooldown hit all look the same from outside. Worded without "if an
 * account exists" now that a missing account is an explicit 404; the remaining
 * ambiguity (suspended / throttled) is the part we still don't disclose.
 * Built fresh each call so a caller can't mutate a shared object.
 */
const genericForgotResponse = () => ({
    message: `A password reset link is on its way. The link expires in ${TTL_MINUTES} minutes.`,
    expires_in_minutes: TTL_MINUTES,
});

/**
 * Look a reset token up and assert it is live.
 * Throws the specific ERROR_CODES entry for missing / used / expired.
 */
const loadLiveToken = async (rawToken) => {
    if (typeof rawToken !== "string" || rawToken.trim().length === 0) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "token is required" });
    }

    const row = await pgClient.password_reset_tokens.findUnique({
        where: { token_hash: hashToken(rawToken.trim()) },
        select: {
            id: true,
            user_id: true,
            expires_at: true,
            used_at: true,
            users: {
                select: { id: true, email: true, first_name: true, last_name: true, password_hash: true, status: true },
            },
        },
    });

    // Unknown digest, or the account was deleted underneath it.
    if (!row || !row.users) {
        throw ApiError.fromCode(ERROR_CODES.RESET_TOKEN_INVALID);
    }
    if (row.used_at) {
        throw ApiError.fromCode(ERROR_CODES.RESET_TOKEN_USED);
    }
    if (row.expires_at.getTime() <= Date.now()) {
        throw ApiError.fromCode(ERROR_CODES.RESET_TOKEN_EXPIRED);
    }
    // A ticket minted before the account was suspended must not still work.
    if (row.users.status !== "active") {
        logger.warn(`password reset: token for non-active account user=${row.user_id} status=${row.users.status}`);
        throw ApiError.fromCode(ERROR_CODES.RESET_TOKEN_INVALID);
    }

    return row;
};

// --- controllers -------------------------------------------------------------

/**
 * POST /users/password/forgot  { email }
 *
 * 404 USER_NOT_FOUND when no account has that address (the frontend turns this
 * into a redirect to signup). Otherwise 200: every other early return below is a
 * *silent* stop — logged server-side so abuse and misconfiguration stay visible,
 * but byte-identical to the success path, so a caller cannot tell "suspended" or
 * "throttled" apart from "mail sent".
 */
const forgotPassword = asyncHandler(async (req, res) => {
    const rawEmail = req.body?.email;

    if (typeof rawEmail !== "string" || !rawEmail.includes("@")) {
        // A malformed address is the one case we do reject — it cannot belong to
        // any account, so saying so leaks nothing and helps a real user.
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "A valid email address is required",
        });
    }

    // Stored addresses are as the user typed them at signup; compare
    // case-insensitively so "Touhid@x.com" finds "touhid@x.com".
    const email = rawEmail.trim().toLowerCase();

    const user = await pgClient.users.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true, email: true, first_name: true, status: true },
    });

    if (!user) {
        // Logged at warn, not info: a burst of these from one IP is someone probing
        // for registered addresses, and this line is the only place that shows it.
        logger.warn(`password reset requested for unknown email ip=${req.ip}`);
        throw ApiError.fromCode(ERROR_CODES.USER_NOT_FOUND, {
            message: "No FunTurf account is registered with that email",
        });
    }

    if (user.status !== "active") {
        logger.warn(`password reset requested for non-active account user=${user.id} status=${user.status}`);
        return res.status(200).json(new ApiResponse(200, "Password reset requested", genericForgotResponse()));
    }

    // Housekeeping: drop this user's dead tickets (expired, or spent more than a
    // day ago). Keeps the table from growing without bound without needing a
    // separate sweeper job — the only rows that matter are the live ones.
    await pgClient.password_reset_tokens.deleteMany({
        where: {
            user_id: user.id,
            OR: [
                { expires_at: { lt: new Date() } },
                { used_at: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
            ],
        },
    });

    // Per-account cooldown (see RESEND_COOLDOWN_SECONDS).
    const recent = await pgClient.password_reset_tokens.findFirst({
        where: {
            user_id: user.id,
            used_at: null,
            created_at: { gt: new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000) },
        },
        select: { id: true },
    });

    if (recent) {
        logger.info(`password reset throttled (cooldown) user=${user.id} ip=${req.ip}`);
        return res.status(200).json(new ApiResponse(200, "Password reset requested", genericForgotResponse()));
    }

    // Mint the ticket. `base64url` keeps it safe to drop straight into a URL with
    // no percent-encoding (and therefore no chance of a mail client mangling it).
    const rawToken = crypto.randomBytes(TOKEN_BYTES).toString("base64url");

    await pgClient.password_reset_tokens.create({
        data: {
            user_id: user.id,
            token_hash: hashToken(rawToken),
            expires_at: new Date(Date.now() + TTL_MINUTES * 60 * 1000),
            request_ip: req.ip?.slice(0, 45) ?? null,
            user_agent: req.get("user-agent")?.slice(0, 255) ?? null,
        },
    });

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}`;
    const message = passwordResetEmail({
        firstName: user.first_name,
        resetUrl,
        ttlMinutes: TTL_MINUTES,
    });

    // Not awaited on purpose. Two reasons: the caller shouldn't wait on an SMTP
    // round-trip, and awaiting would make the "account exists" path measurably
    // slower than the "unknown email" path — a timing side-channel around the
    // enumeration guard above. `sendMail` never throws and logs its own failures.
    void sendMail({ to: user.email, ...message });

    logger.info(`password reset link issued user=${user.id} ip=${req.ip} ttl=${TTL_MINUTES}m`);

    return res.status(200).json(new ApiResponse(200, "Password reset requested", genericForgotResponse()));
});

/**
 * POST /users/password/reset/validate  { token }
 *
 * Cheap pre-flight for the reset page: lets the UI show "this link has expired,
 * request a new one" instead of rendering a password form that is guaranteed to
 * fail on submit. Read-only — it does NOT consume the token.
 */
const validateResetToken = asyncHandler(async (req, res) => {
    const row = await loadLiveToken(req.body?.token);

    return res.status(200).json(
        new ApiResponse(200, "Reset link is valid", {
            valid: true,
            email: maskEmail(row.users.email),
            first_name: row.users.first_name,
            expires_at: row.expires_at,
        })
    );
});

/**
 * POST /users/password/reset  { token, password }
 *
 * Consumes the token and sets the new password. Everything that must happen
 * together happens in ONE transaction: a run that set the password but left the
 * token spendable, or spent the token without setting the password, would both be
 * security bugs.
 */
const resetPassword = asyncHandler(async (req, res) => {
    const { token, password } = req.body ?? {};

    const row = await loadLiveToken(token);
    const user = row.users;

    // Policy is enforced here, not in the client. The `context` argument blocks a
    // password built out of this user's own name or email handle.
    assertPasswordPolicy(password, {
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
    });

    // Reusing the current password would mean an attacker who triggered the reset
    // learns nothing changed — and a user who reset because of a suspected leak
    // would still be exposed.
    if (await bcrypt.compare(password, user.password_hash)) {
        throw ApiError.fromCode(ERROR_CODES.PASSWORD_UNCHANGED);
    }

    const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const now = new Date();

    await pgClient.$transaction([
        pgClient.users.update({
            where: { id: user.id },
            data: {
                password_hash: newHash,
                // Sign the account out EVERYWHERE. A reset is the standard response
                // to "someone may be in my account", so any session an attacker
                // already holds has to die with the old password.
                refresh_token: null,
                // Completing this flow proves control of the mailbox, which is
                // exactly what email verification asserts.
                email_verified: true,
                updated_at: now,
            },
        }),
        // Spend this ticket…
        pgClient.password_reset_tokens.update({
            where: { id: row.id },
            data: { used_at: now },
        }),
        // …and void every other outstanding one for this user, so an older link
        // sitting in the inbox can't be used to change the password again.
        pgClient.password_reset_tokens.deleteMany({
            where: { user_id: user.id, id: { not: row.id }, used_at: null },
        }),
    ]);

    // Auth reads are cached; drop both shapes so the next request sees the change
    // (see utils/cache.js — legacy node-cache keyed by id, plus the profile key).
    userCache.del(user.id);
    await cacheDel(`user:profile:${user.id}`);

    // Security notice — see passwordChangedEmail. Fire-and-forget: the password is
    // already changed and a mail failure must not turn that into an error.
    void sendMail({
        to: user.email,
        ...passwordChangedEmail({
            firstName: user.first_name,
            loginUrl: `${FRONTEND_URL}/login`,
            when: now,
        }),
    });

    logger.info(`password reset completed user=${user.id} ip=${req.ip} — all sessions revoked`);

    return res.status(200).json(
        new ApiResponse(200, "Password updated successfully", {
            message: "Your password has been changed. Log in with your new password.",
            // The client MUST discard any stored tokens: the refresh token is dead.
            sessions_revoked: true,
        })
    );
});

export { forgotPassword, validateResetToken, resetPassword };
