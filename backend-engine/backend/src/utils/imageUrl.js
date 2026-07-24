import { ApiError } from "./apiError.js";
import { ERROR_CODES } from "./errorCodes.js";

/**
 * Validation for image URLs that arrive from the CLIENT.
 *
 * Every image on FunTurf is uploaded browser-side first (POST /api/upload ->
 * image host) and only the resulting URL is PATCHed back to us. That makes the
 * URL untrusted input: without a host allowlist a user could point their avatar,
 * or a turf its logo, at any address on the internet — which turns our pages
 * into a hotlink/tracking surface for a third party and embeds content we never
 * vetted. Only https, only hosts we actually upload to.
 *
 * Shared by the profile write path (PATCH /users/me) and the turf write path
 * (PATCH /venues/:venue_id) so the two can never drift apart on what counts as
 * an acceptable image.
 *
 * Extend via the PROFILE_IMAGE_HOSTS env var (comma-separated) if the image
 * host ever changes — no code change needed to add a CDN.
 */
const DEFAULT_IMAGE_HOSTS = [
    "i.ibb.co",
    "ibb.co",
    "image.ibb.co",
    "res.cloudinary.com",
];

export const allowedImageHosts = () => {
    const extra = (process.env.PROFILE_IMAGE_HOSTS || "")
        .split(",")
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
    return new Set([...DEFAULT_IMAGE_HOSTS, ...extra]);
};

const fail = (message) => ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message });

/**
 * An https URL on an allowed image host, or throw a 400 naming the field.
 *
 * @param {string} field human-readable field name, used in the error message
 * @param {*}      value raw value from the request body
 * @returns {string} the normalised URL
 */
export function coerceImageUrl(field, value) {
    let url;
    try {
        url = new URL(String(value));
    } catch {
        throw fail(`${field} must be a valid URL`);
    }
    if (url.protocol !== "https:") {
        throw fail(`${field} must be an https URL`);
    }
    if (!allowedImageHosts().has(url.hostname.toLowerCase())) {
        // Named explicitly: a silent reject here just looks like "my photo didn't save".
        throw fail(`${field} must be an image uploaded through FunTurf`);
    }
    return url.toString();
}

/**
 * A list of image URLs (a turf's photo gallery), each validated as above.
 *
 * @param {string} field
 * @param {*}      value
 * @param {number} [max] cap on list length — an unbounded array is a cheap way
 *                       to bloat a JSON column
 */
export function coerceImageUrlArray(field, value, max = 10) {
    if (!Array.isArray(value)) throw fail(`${field} must be an array of image URLs`);
    if (value.length > max) throw fail(`${field} accepts at most ${max} images`);
    return value
        .filter((v) => v !== null && v !== undefined && v !== "")
        .map((v) => coerceImageUrl(field, v));
}

/**
 * A `#RRGGBB` colour.
 *
 * Strict by necessity: this value is written into a CSS custom property in the
 * admin panel, so anything that isn't a literal hex triple is a style-injection
 * vector. No named colours, no rgb(), no shorthand.
 */
export function coerceHexColor(field, value) {
    const hex = String(value).trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
        throw fail(`${field} must be a hex colour like #1DB954`);
    }
    return hex.toLowerCase();
}
