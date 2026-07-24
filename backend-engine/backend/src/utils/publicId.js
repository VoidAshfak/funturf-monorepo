import crypto from "crypto";
import { logger } from "../../logs/logger.js";

/**
 * Public id codec — turns an internal UUID primary key into an opaque 22-char
 * token for the outside world, and back again.
 *
 *   f47ac10b-58cc-4372-a567-0e02b2c3d479  ->  ROxl8HkZND7yrL1B59ZocA
 *
 * WHY THIS EXISTS
 * Every `id` column in the PostgreSQL schema is `uuid_generate_v4()`, so the raw
 * ids were never *guessable* — 122 bits of randomness is not enumerable, and
 * authorization is enforced server-side on every route regardless. The problem
 * masking solves is different: internal primary keys were ending up in browser
 * URLs, and from there in history, `Referer` headers sent to third parties,
 * bookmarks, analytics payloads and support screenshots. Handing out a value
 * that is *not* the database key means none of that exposure matters.
 *
 * HOW
 * AES-128 over the UUID's 16 raw bytes — exactly one block, so the output is
 * also 16 bytes (22 chars once base64url-encoded, shorter than the 36-char UUID
 * it replaces). ECB mode is normally a mistake, but the objection to it is that
 * identical plaintext blocks produce identical ciphertext blocks and leak the
 * structure of a longer message. With a single block there is no structure to
 * leak, and determinism is exactly what we want: one turf must always produce
 * one URL, or links would break and nothing would be cacheable.
 *
 * This is a mapping, not a secret store. It hides the internal key from the
 * client; it is NOT an access control. Every route still checks ownership after
 * decoding — see the row-level checks in the venue/booking controllers.
 */

// Length of a UUID in raw bytes, and of the base64url token that encodes it.
const UUID_BYTES = 16;
const TOKEN_LENGTH = 22;

// A token is base64url only: no `+`, `/` or `=` (all three are painful in URLs).
const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

/**
 * Any well-formed UUID, of any version.
 *
 * Deliberately NOT version-locked. The schema defaults are `uuid_generate_v4()`,
 * but the seeded rows that make up most of the current database are v5 — so a
 * `4`-in-the-version-nibble check would reject almost every real id. Nothing here
 * cares which version a key is; it only has to be 16 bytes.
 */
const UUID_ANY_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let cachedKey = null;

/**
 * Derive the 16-byte AES key from the configured secret.
 *
 * Falls back to ACCESS_TOKEN_SECRET so an existing deploy keeps working without
 * a new env var, but that is a convenience, not a recommendation: rotating the
 * JWT secret would then silently invalidate every public URL ever issued. Set
 * PUBLIC_ID_SECRET explicitly and treat it as permanent — changing it changes
 * every link on the site at once.
 */
function getKey() {
    if (cachedKey) return cachedKey;

    const secret = process.env.PUBLIC_ID_SECRET || process.env.ACCESS_TOKEN_SECRET;
    if (!secret) {
        throw new Error(
            "PUBLIC_ID_SECRET (or ACCESS_TOKEN_SECRET) must be set — public ids cannot be derived without it"
        );
    }
    if (!process.env.PUBLIC_ID_SECRET) {
        logger.warn(
            "PUBLIC_ID_SECRET is not set; falling back to ACCESS_TOKEN_SECRET. " +
            "Rotating the JWT secret will break every public URL — set PUBLIC_ID_SECRET."
        );
    }

    // sha256 gives a uniform 32 bytes from a secret of any length/entropy; we
    // need 16 for AES-128.
    cachedKey = crypto.createHash("sha256").update(secret).digest().subarray(0, UUID_BYTES);
    return cachedKey;
}

/** Is this string shaped like a public id token? (Cheap pre-check, no crypto.) */
export const isPublicId = (value) =>
    typeof value === "string" && TOKEN_RE.test(value);

/** Is this string a well-formed UUID of any version? */
export const isUuidLike = (value) =>
    typeof value === "string" && UUID_ANY_RE.test(value);

/**
 * UUID -> opaque token. Returns the input untouched if it isn't a UUID, so this
 * is safe to map over mixed data.
 */
export function encodeId(uuid) {
    if (!isUuidLike(uuid)) return uuid;

    const cipher = crypto.createCipheriv("aes-128-ecb", getKey(), null);
    cipher.setAutoPadding(false); // input is exactly one block; padding would add a second
    const encrypted = Buffer.concat([
        cipher.update(Buffer.from(uuid.replace(/-/g, ""), "hex")),
        cipher.final(),
    ]);
    return encrypted.toString("base64url");
}

/**
 * Opaque token -> UUID, or `null` if the input isn't even token-shaped.
 *
 * There is NO integrity check, and there cannot be a cheap one: any 16 bytes
 * decrypt to some 16 bytes, and every 16 bytes is a syntactically valid UUID.
 * A forged token therefore decodes to a random id that matches no row — the
 * caller gets a 404. That is the correct outcome and is why no MAC is carried:
 * the id is not a capability, so there is nothing for a forgery to gain. Every
 * endpoint re-checks ownership after resolving the id.
 *
 * CONSEQUENCE FOR ROUTING (see `rewritePath` in the middleware): because decode
 * accepts any 22-char base64url string, a *static* route segment of exactly 22
 * URL-safe characters would be rewritten into a UUID and stop matching. No such
 * segment exists today — the longest are the 23-char `*-turfmate-request`
 * routes — but keep static segments away from that length, or give them a
 * character outside `[A-Za-z0-9_-]`.
 */
export function decodeId(token) {
    if (!isPublicId(token)) return null;

    let hex;
    try {
        const buf = Buffer.from(token, "base64url");
        if (buf.length !== UUID_BYTES) return null;

        const decipher = crypto.createDecipheriv("aes-128-ecb", getKey(), null);
        decipher.setAutoPadding(false);
        hex = Buffer.concat([decipher.update(buf), decipher.final()]).toString("hex");
    } catch {
        return null; // malformed base64url, bad key length, etc.
    }

    const uuid = [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20),
    ].join("-");

    return uuid;
}

/**
 * Accept either form and return the internal UUID.
 *
 * Raw UUIDs are still accepted on the way IN. They were never secret, older
 * clients and integration scripts may still hold them, and rejecting them would
 * turn a cosmetic change into a breaking one. Nothing is weakened by this: the
 * ownership check after the lookup is what actually guards the row.
 */
export function toInternalId(value) {
    if (isUuidLike(value)) return value;
    return decodeId(value) ?? value;
}

/**
 * Keys whose values are free prose and must never be rewritten, even if a user
 * happened to paste something UUID-shaped into them. Outbound masking is
 * otherwise deliberately value-driven rather than key-driven — see `maskDeep`.
 */
const FREE_TEXT_KEYS = new Set([
    "message",
    "content",
    "text",
    "body",
    "title",
    "description",
    "bio",
    "notes",
    "admin_notes",
    "cancellation_reason",
    "reason",
]);

// Runaway guard. Real DTOs nest maybe 5 deep; anything past this is a bug or a
// cycle, and we would rather return the branch untouched than blow the stack.
const MAX_DEPTH = 12;

/**
 * Walk an outbound payload and replace every UUID with its public token.
 *
 * Deliberately matches on the VALUE (does this look like a UUID?) rather than on
 * the key name. Key-driven masking would have to know every id-bearing column
 * name in a 27-model schema, and would silently leak the day someone adds a
 * column like `cancelled_by` that carries a UUID without an `_id` suffix — which
 * this schema already has. Matching on value fails closed instead: a new id
 * column is masked the moment it appears, with no code change.
 *
 * The cost of that choice is that genuine prose containing a UUID would be
 * rewritten, which FREE_TEXT_KEYS exists to prevent.
 */
export function maskDeep(node, depth = 0) {
    if (depth > MAX_DEPTH) return node;

    if (typeof node === "string") return isUuidLike(node) ? encodeId(node) : node;
    if (node === null || typeof node !== "object") return node;
    // Dates, Decimals and Buffers are leaves — recursing into them would
    // reduce them to a bag of internal properties.
    if (node instanceof Date || Buffer.isBuffer(node)) return node;

    if (Array.isArray(node)) return node.map((item) => maskDeep(item, depth + 1));

    const out = {};
    for (const [key, value] of Object.entries(node)) {
        out[key] =
            FREE_TEXT_KEYS.has(key) ? value : maskDeep(value, depth + 1);
    }
    return out;
}

/**
 * Does this key name hold an id?
 *
 * Three shapes, all taken from the actual schema rather than guessed:
 *   `id`                                    — every primary key
 *   `user_id`, `turf_id`, `invitedUserId`   — every foreign key
 *   `cancelled_by`, `deleted_by`, …         — the audit columns
 *
 * Plural forms (`user_ids`, `inviteeIds`) are included too. No endpoint takes an
 * id array in its body today — every `*Ids` name in the codebase is an internal
 * variable — but the singular-only rule would have failed silently the first
 * time one was added, handing Prisma a bag of tokens.
 *
 * The `_by` case matters: those six columns (`cancellation_requested_by`,
 * `cancelled_by`, `deleted_by`, `invited_by`, `reported_by`, `reviewed_by`) are
 * `@db.Uuid` but carry no `_id` suffix, so an `_id`-only rule would silently
 * skip them. Matching the suffix instead of listing the names means a future
 * audit column is covered the day it is added.
 *
 * A false positive here is harmless: `toInternalId` only rewrites a value that
 * is genuinely a 22-char token decrypting to a valid v4 UUID, so a query like
 * `?sort_by=created_at` passes through untouched.
 */
const ID_KEY_RE = /(^id$|_ids?$|Ids?$|_by$)/;

const isIdKey = (key) => ID_KEY_RE.test(key);

/**
 * Walk an inbound payload and turn public tokens back into UUIDs.
 *
 * Mirror image of `maskDeep`, but KEY-driven, and that asymmetry is on purpose.
 * A 22-char base64url string is not rare — a password, a nonce or a short note
 * can easily match — and blindly "decoding" one would corrupt the field. Only
 * touching keys that are known to hold ids keeps that from happening.
 */
export function unmaskDeep(node, depth = 0) {
    if (depth > MAX_DEPTH || node === null || typeof node !== "object") return node;
    if (node instanceof Date || Buffer.isBuffer(node)) return node;

    if (Array.isArray(node)) return node.map((item) => unmaskDeep(item, depth + 1));

    const out = {};
    for (const [key, value] of Object.entries(node)) {
        if (isIdKey(key)) {
            if (typeof value === "string") {
                out[key] = toInternalId(value);
                continue;
            }
            // e.g. `user_ids: [...]` — an array of ids under one id-ish key.
            if (Array.isArray(value)) {
                out[key] = value.map((v) =>
                    typeof v === "string" ? toInternalId(v) : unmaskDeep(v, depth + 1)
                );
                continue;
            }
        }
        out[key] = unmaskDeep(value, depth + 1);
    }
    return out;
}
