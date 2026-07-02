import { STATUS_TO_CODE } from "./errorCodes.js";

/**
 * Terminal error middleware (mounted last in app.js). Serializes every thrown
 * error into ONE consistent envelope the frontend can rely on:
 *
 *   { success: false, code: "USER_NOT_FOUND", message: "...", errors: [], data: null }
 *
 * `code` is machine-readable and stable; `message` is for humans. Legacy
 * ApiError calls without an explicit code fall back to a status-derived code.
 */
export const errorHandler = (err, req, res, next) => {

    console.error(err.stack || err);

    const statusCode = err.statusCode || err.status || 500;

    // Prefer the explicit code; otherwise derive from status; otherwise generic.
    const code = err.code || STATUS_TO_CODE[statusCode] || "INTERNAL_ERROR";

    res.status(statusCode).json({
        success: false,
        code,
        message: err.message || "Internal Server Error",
        errors: Array.isArray(err.errors) ? err.errors : [],
        data: err.data ?? null,
    });
};
