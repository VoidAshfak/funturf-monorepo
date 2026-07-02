/**
 * Helpers for reading the backend's standard error envelope:
 *   { success: false, code: "USER_NOT_FOUND", message: "...", errors: [], data: null }
 *
 * Works with:
 *  - RTK Query errors  -> `error.data` holds the envelope
 *  - raw parsed bodies -> pass the JSON object directly
 *
 * Branch UI on `code` (stable), show `message` to users. Keep the codes in sync
 * with backend `backend-engine/backend/src/utils/errorCodes.js` (see repo-root docs/api-guideline.md).
 */

/** Machine-readable code, or "INTERNAL_ERROR" when the shape is unexpected. */
export function getApiErrorCode(error) {
    const envelope = error?.data ?? error;
    return envelope?.code ?? "INTERNAL_ERROR";
}

/** Human-readable message, with a safe fallback. */
export function getApiErrorMessage(error, fallback = "Something went wrong") {
    const envelope = error?.data ?? error;
    return envelope?.message ?? fallback;
}

/** Field-level validation details, or an empty array. */
export function getApiErrorDetails(error) {
    const envelope = error?.data ?? error;
    return Array.isArray(envelope?.errors) ? envelope.errors : [];
}
