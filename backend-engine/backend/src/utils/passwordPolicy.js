import { ApiError } from "./apiError.js";
import { ERROR_CODES } from "./errorCodes.js";

/**
 * Password strength policy — the ONE place the rules live.
 *
 * Enforced on every path that accepts a new password:
 *   - registration (`encryptPassword` middleware, before the bcrypt hash)
 *   - password reset (`resetPassword` controller)
 *
 * The same rule list is mirrored in the frontend at
 * `frontend-engine/src/utils/passwordPolicy.js` so the UI can show a live
 * checklist. That copy is COSMETIC — this file is the enforcement point. Keep the
 * two in sync when you change a rule.
 */

export const PASSWORD_MIN_LENGTH = 8;

/**
 * bcrypt silently TRUNCATES input past 72 bytes. Accepting a 100-character
 * passphrase and then ignoring the tail is worse than rejecting it: the user
 * believes they have more entropy than they do, and two different long passwords
 * can end up equivalent. So we reject instead of truncating.
 *
 * The limit is in BYTES, not characters — Bengali and emoji are multi-byte in
 * UTF-8, so a 30-character Bangla passphrase can exceed 72 bytes.
 */
export const PASSWORD_MAX_BYTES = 72;

/**
 * bcrypt cost factor, shared by register and reset so a password's protection
 * doesn't depend on which endpoint set it. 12 is ~250ms on Render's shared CPU:
 * slow enough to make offline cracking expensive, fast enough for a login.
 */
export const BCRYPT_ROUNDS = 12;

/**
 * The handful of passwords that show up first in every credential-stuffing list.
 * Deliberately tiny and inline — a real breach-corpus check (HaveIBeenPwned's
 * k-anonymity range API) is the proper upgrade, but that is a network call on the
 * signup path and needs its own failure handling. This costs nothing and blocks
 * the worst offenders.
 */
const COMMON_PASSWORDS = new Set([
    "password", "password1", "password123", "passw0rd", "12345678", "123456789",
    "1234567890", "qwerty123", "qwertyuiop", "abc12345", "iloveyou", "admin123",
    "welcome1", "welcome123", "letmein1", "football", "football1", "cricket1",
    "bangladesh", "dhaka1234", "funturf123", "changeme", "trustno1", "sunshine1",
]);

/**
 * The rules, in the order the UI should list them.
 * Each `test` takes the raw password and returns true when the rule is satisfied.
 */
export const PASSWORD_RULES = Object.freeze([
    {
        id: "length",
        label: `At least ${PASSWORD_MIN_LENGTH} characters`,
        test: (pw) => pw.length >= PASSWORD_MIN_LENGTH,
    },
    {
        id: "lowercase",
        label: "One lowercase letter (a–z)",
        test: (pw) => /[a-z]/.test(pw),
    },
    {
        id: "uppercase",
        label: "One uppercase letter (A–Z)",
        test: (pw) => /[A-Z]/.test(pw),
    },
    {
        id: "number",
        label: "One number (0–9)",
        test: (pw) => /\d/.test(pw),
    },
]);

/**
 * Validate a candidate password.
 *
 * @param {string} password raw password as typed
 * @param {{email?:string, firstName?:string, lastName?:string}} [context]
 *   Personal details the password must not contain. A password that is just the
 *   user's own name or email handle is trivially guessable by anyone who can see
 *   their profile — which, on FunTurf, is everyone.
 * @returns {{valid:boolean, failed:string[], messages:string[]}}
 */
export const validatePassword = (password, context = {}) => {
    const failed = [];
    const messages = [];

    if (typeof password !== "string" || password.length === 0) {
        return { valid: false, failed: ["required"], messages: ["Password is required"] };
    }

    for (const rule of PASSWORD_RULES) {
        if (!rule.test(password)) {
            failed.push(rule.id);
            messages.push(rule.label);
        }
    }

    if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
        failed.push("max_length");
        messages.push(`No longer than ${PASSWORD_MAX_BYTES} bytes (roughly ${PASSWORD_MAX_BYTES} characters)`);
    }

    const lowered = password.toLowerCase();

    if (COMMON_PASSWORDS.has(lowered)) {
        failed.push("common");
        messages.push("This password is too common — pick something less predictable");
    }

    // Personal-details check. Fragments shorter than 4 characters are skipped:
    // banning a 2-letter surname would reject far more good passwords than bad ones.
    const personal = [
        context.firstName,
        context.lastName,
        // Email LOCAL part only ("touhid" from "touhid@gmail.com") — the domain is
        // shared by millions of users and carries no information about this one.
        typeof context.email === "string" ? context.email.split("@")[0] : null,
    ]
        .filter((value) => typeof value === "string" && value.trim().length >= 4)
        .map((value) => value.trim().toLowerCase());

    if (personal.some((fragment) => lowered.includes(fragment))) {
        failed.push("personal");
        messages.push("Password must not contain your name or email address");
    }

    return { valid: failed.length === 0, failed, messages };
};

/**
 * Throwing wrapper for controllers/middleware. Raises WEAK_PASSWORD (400) with
 * every unmet rule in `errors`, so the client can highlight all of them at once
 * instead of making the user discover them one submit at a time.
 */
export const assertPasswordPolicy = (password, context = {}) => {
    const result = validatePassword(password, context);
    if (!result.valid) {
        throw ApiError.fromCode(ERROR_CODES.WEAK_PASSWORD, {
            errors: result.failed.map((id, index) => ({ rule: id, message: result.messages[index] })),
        });
    }
    return true;
};
