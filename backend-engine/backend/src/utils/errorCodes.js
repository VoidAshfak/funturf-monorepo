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
    EVENT_NOT_FOUND:       { code: "EVENT_NOT_FOUND",       statusCode: 404, message: "Event not found" },
    NOT_EVENT_ORGANIZER:   { code: "NOT_EVENT_ORGANIZER",   statusCode: 403, message: "Only the event organizer can perform this action" },
    EVENT_FULL:            { code: "EVENT_FULL",            statusCode: 409, message: "This match is already full" },
    ALREADY_JOINED:        { code: "ALREADY_JOINED",        statusCode: 409, message: "You have already joined this match" },
    NOT_EVENT_PARTICIPANT: { code: "NOT_EVENT_PARTICIPANT", statusCode: 400, message: "You are not a participant of this match" },
    NOT_EVENT_ADMIN:       { code: "NOT_EVENT_ADMIN",       statusCode: 403, message: "Only an event admin can perform this action" },
    JOIN_REQUEST_NOT_FOUND:{ code: "JOIN_REQUEST_NOT_FOUND", statusCode: 404, message: "No pending join request found" },
    ALREADY_ADMIN:         { code: "ALREADY_ADMIN",         statusCode: 409, message: "This user is already an event admin" },

    // ---- event comments ----
    COMMENT_NOT_FOUND:   { code: "COMMENT_NOT_FOUND",   statusCode: 404, message: "Comment not found" },
    NOT_COMMENT_AUTHOR:  { code: "NOT_COMMENT_AUTHOR",  statusCode: 403, message: "You can only edit your own comment" },
    CANNOT_COMMENT:      { code: "CANNOT_COMMENT",      statusCode: 403, message: "Only players in this match can post. Join the match to take part in the discussion" },
    COMMENT_EMPTY:       { code: "COMMENT_EMPTY",       statusCode: 400, message: "A comment cannot be empty" },
    COMMENT_TOO_LONG:    { code: "COMMENT_TOO_LONG",    statusCode: 400, message: "A comment cannot be longer than 2000 characters" },
    REPLY_DEPTH_EXCEEDED:{ code: "REPLY_DEPTH_EXCEEDED", statusCode: 400, message: "You can only reply to a top-level comment" },

    // ---- bookings / slots ----
    GROUND_NOT_FOUND: { code: "GROUND_NOT_FOUND", statusCode: 404, message: "Ground not found" },
    SLOT_NOT_FOUND:   { code: "SLOT_NOT_FOUND",   statusCode: 404, message: "No slots found for this ground and date" },
    SLOT_UNAVAILABLE: { code: "SLOT_UNAVAILABLE", statusCode: 409, message: "This slot is already booked" },
    SLOT_HELD_UNPAID: { code: "SLOT_HELD_UNPAID", statusCode: 409, message: "This slot is held by an unpaid booking — book it with payment to take it" },
    TURF_NOT_VERIFIED:{ code: "TURF_NOT_VERIFIED", statusCode: 403, message: "This turf is not verified for bookings yet" },
    GROUND_NOT_AVAILABLE: { code: "GROUND_NOT_AVAILABLE", statusCode: 409, message: "This ground is not available for bookings" },
    INVALID_SLOT_CODE: { code: "INVALID_SLOT_CODE", statusCode: 400, message: "Invalid slot code" },
    BOOKING_NOT_FOUND: { code: "BOOKING_NOT_FOUND", statusCode: 404, message: "Booking not found" },
    NOT_BOOKING_OWNER: { code: "NOT_BOOKING_OWNER", statusCode: 403, message: "You are not the owner of this booking" },
    NOT_TURF_ADMIN:    { code: "NOT_TURF_ADMIN",    statusCode: 403, message: "Only a turf admin can perform this action" },
    PAYMENT_PROOF_REQUIRED: { code: "PAYMENT_PROOF_REQUIRED", statusCode: 400, message: "A transaction number or payment proof is required for a paid booking" },
    BOOKING_NOT_PAID_CLAIM: { code: "BOOKING_NOT_PAID_CLAIM", statusCode: 409, message: "This booking has no payment awaiting verification" },
    BOOKING_ALREADY_CANCELLED: { code: "BOOKING_ALREADY_CANCELLED", statusCode: 409, message: "This booking is already cancelled" },
    CANCELLATION_WINDOW_CLOSED: { code: "CANCELLATION_WINDOW_CLOSED", statusCode: 409, message: "Free cancellation is only allowed until 2 days before the booking" },
    CANCELLATION_NOT_REQUESTED: { code: "CANCELLATION_NOT_REQUESTED", statusCode: 409, message: "No mutual cancellation has been requested for this booking" },
    // anti-spam / integrity
    TOO_MANY_UNPAID_HOLDS:  { code: "TOO_MANY_UNPAID_HOLDS",  statusCode: 429, message: "You already hold the maximum number of unpaid bookings. Pay for one or cancel it before holding another slot" },
    BOOKING_DATE_IN_PAST:   { code: "BOOKING_DATE_IN_PAST",   statusCode: 400, message: "You cannot book a date in the past" },
    BOOKING_TOO_FAR_AHEAD:  { code: "BOOKING_TOO_FAR_AHEAD",  statusCode: 400, message: "This date is beyond the turf's advance booking window" },
    DUPLICATE_TRANSACTION:  { code: "DUPLICATE_TRANSACTION",  statusCode: 409, message: "This transaction number is already used by another booking" },
    INVALID_PAYMENT_PROOF:  { code: "INVALID_PAYMENT_PROOF",  statusCode: 400, message: "The payment proof must be an image uploaded through FunTurf" },
    ALREADY_BOOKED_SLOT:    { code: "ALREADY_BOOKED_SLOT",    statusCode: 409, message: "You already have a booking on this slot" },
    RATE_LIMITED:           { code: "RATE_LIMITED",           statusCode: 429, message: "Too many requests — slow down and try again shortly" },

    // ---- turfmates / connections ----
    CANNOT_CONNECT_SELF:        { code: "CANNOT_CONNECT_SELF",        statusCode: 400, message: "You cannot send a turfmate request to yourself" },
    CONNECTION_ALREADY_EXISTS:  { code: "CONNECTION_ALREADY_EXISTS",  statusCode: 409, message: "A turfmate connection or request already exists" },
    CONNECTION_NOT_FOUND:       { code: "CONNECTION_NOT_FOUND",       statusCode: 404, message: "Turfmate request not found" },

    // ---- notifications ----
    NOTIFICATION_NOT_FOUND: { code: "NOTIFICATION_NOT_FOUND", statusCode: 404, message: "Notification not found" },
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
