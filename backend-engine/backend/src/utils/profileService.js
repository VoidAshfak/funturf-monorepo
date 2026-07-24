import { ApiError } from "./apiError.js";
import { ERROR_CODES } from "./errorCodes.js";

/**
 * Player-profile domain rules: what a user may edit about themselves, how each
 * value is validated, and how "complete" the result is.
 *
 * Everything lives here rather than in the controller so the write path
 * (PATCH /users/me) and the read path (GET /users/:id, which returns the
 * completion summary) can never disagree about which fields count — the
 * checklist a player sees is generated from the same list the API accepts.
 */

// ---------------------------------------------------------------------------
// What may be written
// ---------------------------------------------------------------------------
// Split by destination table. A field absent from BOTH lists is silently
// ignored, which is the point: this is an allowlist, not a blocklist, so adding
// a column to the schema never accidentally makes it user-writable.
//
// Deliberately NOT writable here, and why:
//   email, user_type, status, email_verified,
//   phone_verified, password_hash, refresh_token  -> identity / trust boundary,
//                                                    each needs its own verified flow
//   rating, total_games_played,
//   total_games_organized, reliability_score      -> server-derived reputation;
//                                                    self-editing would make it meaningless

/** Enum columns -> the exact values the Prisma schema allows. */
const ENUMS = {
    gender: ["male", "female", "other", "prefer_not_to_say"],
    skill_level: ["beginner", "intermediate", "advanced", "professional", "any"],
    preferred_foot: ["left", "right", "both"],
    preferred_play_time: ["morning", "afternoon", "evening", "night", "flexible"],
};

/** Integer columns -> sane [min, max]. Keeps typos and joke values out of scouting. */
const INT_RANGES = {
    years_of_experience: [0, 60],
    jersey_number: [0, 99],
    height_cm: [50, 260],
    weight_kg: [20, 250],
    max_travel_distance_km: [0, 200],
};

/** Free-text columns -> max length, so one user can't store a novel. */
const TEXT_LIMITS = {
    first_name: 100,
    last_name: 100,
    phone: 20,
    division: 100,
    district: 100,
    bio: 1000,
    achievements: 1000,
};

/**
 * Image URLs are supplied by the CLIENT (it uploads to the image host first and
 * PATCHes the resulting URL back), so they are untrusted input. Without a host
 * allowlist a user could point their avatar at any URL on the internet: that
 * turns our profile pages into a hotlink/tracking surface for a third party and
 * lets someone embed content we never vetted. Only https, only hosts we upload
 * to. Extend via PROFILE_IMAGE_HOSTS (comma-separated) if the image host changes.
 */
const DEFAULT_IMAGE_HOSTS = [
    "i.ibb.co",
    "ibb.co",
    "image.ibb.co",
    "res.cloudinary.com",
];

const allowedImageHosts = () => {
    const extra = (process.env.PROFILE_IMAGE_HOSTS || "")
        .split(",")
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
    return new Set([...DEFAULT_IMAGE_HOSTS, ...extra]);
};

/** Columns on `users` a user may edit about themselves. */
export const USER_EDITABLE_FIELDS = [
    "first_name", "last_name", "phone", "date_of_birth", "gender",
    "bio", "division", "district", "profile_picture_url", "cover_photo_url",
];

/** Columns on `player_profiles` a user may edit about themselves. */
export const PLAYER_PROFILE_EDITABLE_FIELDS = [
    "preferred_positions", "skill_level", "years_of_experience", "preferred_foot",
    "jersey_number", "height_cm", "weight_kg", "achievements", "sports_played",
    "preferred_play_time", "max_travel_distance_km",
];

// ---------------------------------------------------------------------------
// Validation / coercion
// ---------------------------------------------------------------------------

const fail = (message) =>
    ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message });

/** Treat null / undefined / "" as "clear this field". */
const isCleared = (v) => v === null || v === undefined || v === "";

/** A JSON string array (positions, sports) — deduped, trimmed, capped. */
function coerceStringArray(field, value, max = 20) {
    if (!Array.isArray(value)) {
        throw fail(`${field} must be an array`);
    }
    const list = [
        ...new Set(
            value
                .filter((v) => typeof v === "string")
                .map((v) => v.trim())
                .filter(Boolean)
        ),
    ];
    if (list.length > max) throw fail(`${field} accepts at most ${max} entries`);
    if (list.some((v) => v.length > 60)) throw fail(`${field} entries are too long`);
    return list;
}

/** An https URL on an allowed image host. */
function coerceImageUrl(field, value) {
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
        // Named explicitly: a silent reject here looks like "my photo didn't save".
        throw fail(`${field} must be an image uploaded through FunTurf`);
    }
    return url.toString();
}

/** A calendar date that isn't in the future and implies an age of 10..120. */
function coerceDateOfBirth(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw fail("date_of_birth must be a valid date");

    const years = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (years < 10 || years > 120) {
        throw fail("date_of_birth must correspond to an age between 10 and 120");
    }
    return d;
}

/**
 * Validate + coerce ONE field. Returns the value to persist (possibly null when
 * the user is clearing it). Throws ApiError(VALIDATION_ERROR) on bad input.
 */
export function coerceProfileField(field, raw) {
    // Clearing is always allowed — except for the two names, which the account
    // can't exist without (they're NOT NULL on `users`).
    if (isCleared(raw)) {
        if (field === "first_name" || field === "last_name") {
            throw fail(`${field} cannot be empty`);
        }
        return null;
    }

    if (field === "date_of_birth") return coerceDateOfBirth(raw);

    if (field === "profile_picture_url" || field === "cover_photo_url") {
        return coerceImageUrl(field, raw);
    }

    if (field === "preferred_positions") return coerceStringArray(field, raw, 6);
    if (field === "sports_played") return coerceStringArray(field, raw, 12);

    if (ENUMS[field]) {
        const value = String(raw);
        if (!ENUMS[field].includes(value)) {
            throw fail(`${field} must be one of: ${ENUMS[field].join(", ")}`);
        }
        return value;
    }

    if (INT_RANGES[field]) {
        const [min, max] = INT_RANGES[field];
        const n = Number(raw);
        if (!Number.isInteger(n) || n < min || n > max) {
            throw fail(`${field} must be a whole number between ${min} and ${max}`);
        }
        return n;
    }

    if (TEXT_LIMITS[field]) {
        const text = String(raw).trim();
        if (!text) {
            // Whitespace-only — same as clearing, subject to the name rule above.
            if (field === "first_name" || field === "last_name") {
                throw fail(`${field} cannot be empty`);
            }
            return null;
        }
        if (text.length > TEXT_LIMITS[field]) {
            throw fail(`${field} must be ${TEXT_LIMITS[field]} characters or fewer`);
        }
        // Phone: digits, spaces and the usual separators only. Uniqueness is
        // enforced by the DB (see the CONFLICT mapping in the controller).
        if (field === "phone" && !/^\+?[0-9\s\-()]{6,20}$/.test(text)) {
            throw fail("phone must be a valid phone number");
        }
        return text;
    }

    // Reached only if a field was added to an EDITABLE list without a rule here.
    throw fail(`${field} cannot be updated`);
}

// ---------------------------------------------------------------------------
// Completion scoring
// ---------------------------------------------------------------------------
/**
 * The checklist a player works through. Order is the order the UI shows them, so
 * the cheapest, highest-value wins come first (a photo and a bio do more for
 * getting picked than a jersey number does).
 *
 * `weight` reflects how much a field actually helps other people find and pick
 * you — it is not just 1-per-field, because a profile photo and a skill level
 * matter far more to a captain scanning for a striker than height does.
 *
 * `source`: "user" -> users table, "player" -> player_profiles table.
 */
export const PROFILE_CHECKLIST = [
    { key: "profile_picture_url", source: "user", weight: 3, label: "Profile photo", hint: "Squads pick faces they recognise" },
    { key: "cover_photo_url", source: "user", weight: 1, label: "Cover photo", hint: "Make your profile yours" },
    { key: "bio", source: "user", weight: 2, label: "Short bio", hint: "Say how you play in a line or two" },
    { key: "sports_played", source: "player", weight: 3, label: "Sports you play", hint: "The main filter organizers search on" },
    { key: "skill_level", source: "player", weight: 3, label: "Skill level", hint: "Gets you matched to the right games" },
    { key: "preferred_positions", source: "player", weight: 3, label: "Preferred positions", hint: "Captains scout by position" },
    { key: "district", source: "user", weight: 2, label: "District", hint: "Surfaces turfs and matches near you" },
    { key: "division", source: "user", weight: 1, label: "Division", hint: "Widens your local match feed" },
    { key: "phone", source: "user", weight: 2, label: "Phone number", hint: "Organizers can reach you on match day" },
    { key: "date_of_birth", source: "user", weight: 1, label: "Date of birth", hint: "Some matches are age-grouped" },
    { key: "gender", source: "user", weight: 1, label: "Gender", hint: "Some matches are gender-specific" },
    { key: "preferred_play_time", source: "player", weight: 2, label: "Preferred play time", hint: "Matches you to games at your hours" },
    { key: "max_travel_distance_km", source: "player", weight: 2, label: "Travel range", hint: "Stops you seeing turfs too far away" },
    { key: "years_of_experience", source: "player", weight: 1, label: "Years of experience", hint: "Adds weight to your skill level" },
    { key: "preferred_foot", source: "player", weight: 1, label: "Preferred foot", hint: "Useful detail for football squads" },
    { key: "jersey_number", source: "player", weight: 1, label: "Jersey number", hint: "Shown on team sheets" },
    { key: "height_cm", source: "player", weight: 1, label: "Height", hint: "Helps for positions where it matters" },
    { key: "weight_kg", source: "player", weight: 1, label: "Weight", hint: "Optional physical detail" },
    { key: "achievements", source: "player", weight: 1, label: "Achievements", hint: "Trophies, tournaments, anything worth knowing" },
];

/** A value counts as "filled" when it's present and not an empty string/array. */
const isFilled = (v) => {
    if (v === null || v === undefined || v === "") return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
};

/**
 * Score a profile against PROFILE_CHECKLIST.
 *
 * @param {Object} user            a `users` row (or DTO with the same keys)
 * @param {Object|null} playerProfile  the user's `player_profiles` row, if any
 * @returns {{ percent, earned, total, filled_count, total_count, missing, completed }}
 *          `missing` carries label + hint so the client renders the checklist
 *          without duplicating this domain knowledge.
 */
export function computeProfileCompletion(user = {}, playerProfile = null) {
    const totalWeight = PROFILE_CHECKLIST.reduce((sum, f) => sum + f.weight, 0);

    let earned = 0;
    const missing = [];
    const completed = [];

    for (const field of PROFILE_CHECKLIST) {
        const row = field.source === "player" ? playerProfile : user;
        const done = isFilled(row?.[field.key]);

        if (done) {
            earned += field.weight;
            completed.push(field.key);
        } else {
            missing.push({
                key: field.key,
                label: field.label,
                hint: field.hint,
                weight: field.weight,
                source: field.source,
            });
        }
    }

    return {
        percent: totalWeight === 0 ? 100 : Math.round((earned / totalWeight) * 100),
        earned,
        total: totalWeight,
        filled_count: completed.length,
        total_count: PROFILE_CHECKLIST.length,
        missing,
        completed,
    };
}

// ---------------------------------------------------------------------------
// Discovery ranking
// ---------------------------------------------------------------------------
/**
 * Public-safe columns for any endpoint that LISTS other users (scouting,
 * recommendations). Contact details are deliberately absent: a people-search
 * that returned `email`/`phone` would be a harvesting endpoint, and neither is
 * needed to decide whether to invite someone. A captain gets contact details
 * only after a connection or an accepted invite.
 */
export const PUBLIC_PLAYER_SELECT = {
    id: true,
    first_name: true,
    last_name: true,
    profile_picture_url: true,
    cover_photo_url: true,
    division: true,
    district: true,
    bio: true,
};

/** Player-profile columns worth showing on a scouting result card. */
export const PUBLIC_PLAYER_PROFILE_SELECT = {
    skill_level: true,
    preferred_positions: true,
    sports_played: true,
    preferred_foot: true,
    preferred_play_time: true,
    years_of_experience: true,
    jersey_number: true,
    max_travel_distance_km: true,
    rating: true,
    reliability_score: true,
    total_games_played: true,
};

/** Maximum contribution `completionBoost` can make to a discovery score. */
export const COMPLETION_BOOST_MAX = 10;

/**
 * How much a profile's completeness should lift it in people-discovery results.
 *
 * WHY this exists: a captain can only pick a player they can evaluate. A profile
 * with no sport, no position and no skill level is unrankable noise in a scouting
 * list, however close by the person lives — so completeness is a genuine quality
 * signal for discovery, not a participation trophy. Surfacing complete profiles
 * higher is also the mechanism behind the "finish your profile" nudge: the
 * benefit it promises is this function.
 *
 * Scales linearly with the same weighted percent the profile page shows, so the
 * number a player sees is exactly the number that moves them up the list.
 *
 * @param {Object} user
 * @param {Object|null} playerProfile
 * @param {number} [max] cap on the contribution (default COMPLETION_BOOST_MAX)
 * @returns {number} 0..max
 */
export function completionBoost(user, playerProfile, max = COMPLETION_BOOST_MAX) {
    const { percent } = computeProfileCompletion(user, playerProfile);
    return (percent / 100) * max;
}
