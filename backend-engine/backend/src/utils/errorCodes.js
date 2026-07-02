/**
 * Centralized, machine-readable API error codes.
 *
 * WHY: The frontend keys UI behaviour off a stable `code` string, not off the
 * human message (messages get reworded, translated, etc). Every error the API
 * returns carries one of these codes so both sides stay in lock-step.
 *
 * CONTRACT for new developers:
 *   - `code`       stable identifier — NEVER rename once shipped (frontend depends on it).
 *   - `statusCode` default HTTP status when this code is thrown.
 *   - `message`    default human-readable message (a controller may override it).
 *
 * Usage:
 *   import { ERROR_CODES } from "../../utils/errorCodes.js";
 *   throw ApiError.fromCode(ERROR_CODES.USER_NOT_FOUND);
 *   throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "email is required" });
 *
 * Add new codes here (grouped by domain) rather than inventing ad-hoc strings.
 */
export const ERROR_CODES = Object.freeze({
    // ---- generic ----
    INTERNAL_ERROR:   { code: "INTERNAL_ERROR",   statusCode: 500, message: "Internal server error" },
    VALIDATION_ERROR: { code: "VALIDATION_ERROR", statusCode: 400, message: "One or more fields are invalid" },
    BAD_REQUEST:      { code: "BAD_REQUEST",      statusCode: 400, message: "Bad request" },
    NOT_FOUND:        { code: "NOT_FOUND",        statusCode: 404, message: "Resource not found" },
    UNAUTHORIZED:     { code: "UNAUTHORIZED",     statusCode: 401, message: "Authentication required" },
    FORBIDDEN:        { code: "FORBIDDEN",        statusCode: 403, message: "You do not have permission to perform this action" },
    CONFLICT:         { code: "CONFLICT",         statusCode: 409, message: "Resource already exists" },

    // ---- auth / users ----
    MISSING_TOKEN:        { code: "MISSING_TOKEN",        statusCode: 401, message: "Authentication token is missing" },
    INVALID_TOKEN:        { code: "INVALID_TOKEN",        statusCode: 401, message: "Access token is invalid or expired" },
    INVALID_CREDENTIALS:  { code: "INVALID_CREDENTIALS",  statusCode: 401, message: "Invalid email or password" },
    USER_NOT_FOUND:       { code: "USER_NOT_FOUND",       statusCode: 404, message: "User not found" },
    USER_ALREADY_EXISTS:  { code: "USER_ALREADY_EXISTS",  statusCode: 409, message: "A user with this email or phone already exists" },
    TOKEN_GENERATION_FAILED: { code: "TOKEN_GENERATION_FAILED", statusCode: 500, message: "Could not generate authentication tokens" },

    // ---- events ----
    EVENT_NOT_FOUND:     { code: "EVENT_NOT_FOUND",     statusCode: 404, message: "Event not found" },
    NOT_EVENT_ORGANIZER: { code: "NOT_EVENT_ORGANIZER", statusCode: 403, message: "Only the event organizer can perform this action" },

    // ---- bookings / slots ----
    GROUND_NOT_FOUND: { code: "GROUND_NOT_FOUND", statusCode: 404, message: "Ground not found" },
    SLOT_NOT_FOUND:   { code: "SLOT_NOT_FOUND",   statusCode: 404, message: "No slots found for this ground and date" },
    SLOT_UNAVAILABLE: { code: "SLOT_UNAVAILABLE", statusCode: 409, message: "This slot is already booked" },

    // ---- turfmates / connections ----
    CANNOT_CONNECT_SELF:        { code: "CANNOT_CONNECT_SELF",        statusCode: 400, message: "You cannot send a turfmate request to yourself" },
    CONNECTION_ALREADY_EXISTS:  { code: "CONNECTION_ALREADY_EXISTS",  statusCode: 409, message: "A turfmate connection or request already exists" },
    CONNECTION_NOT_FOUND:       { code: "CONNECTION_NOT_FOUND",       statusCode: 404, message: "Turfmate request not found" },
});

/**
 * Fallback map so LEGACY `new ApiError(status, message)` calls (which don't pass
 * a code) still get a sensible `code` in the response envelope.
 */
export const STATUS_TO_CODE = Object.freeze({
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    500: "INTERNAL_ERROR",
});
