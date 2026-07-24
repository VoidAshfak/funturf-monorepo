import { STATUS_TO_CODE } from "./errorCodes.js";

/**
 * Prisma error codes that are really CLIENT mistakes, mapped to the envelope the
 * rest of the API uses.
 *
 * Without this an unguarded id turns into a 500 whose `message` is Prisma's raw
 * multi-line text — the failing model, the method, and a chunk of the query:
 *
 *   GET /users/me
 *   500 { "code": "P2023", "message": "\nInvalid `prisma.users.findUnique()` invocation:
 *         \n\nInconsistent column data: Error creating UUID, invalid character ..." }
 *
 * Three things wrong with that: the status is wrong (a malformed id is a bad
 * request, not a server fault), `code` is a database implementation detail the
 * frontend should never branch on, and the message discloses internal schema and
 * query shape to any unauthenticated caller.
 *
 * Handled centrally rather than per route: ~33 dynamic id routes exist and each
 * one is a chance to forget. This layer means a missing per-route guard costs a
 * correct 400 instead of a leak.
 */
const PRISMA_ERROR_MAP = Object.freeze({
    P2023: { statusCode: 400, code: "VALIDATION_ERROR", message: "One or more ids are invalid" },
    P2003: { statusCode: 400, code: "VALIDATION_ERROR", message: "Referenced record does not exist" },
    P2000: { statusCode: 400, code: "VALIDATION_ERROR", message: "One or more fields are too long" },
    P2002: { statusCode: 409, code: "CONFLICT",         message: "Resource already exists" },
    P2025: { statusCode: 404, code: "NOT_FOUND",        message: "Resource not found" },
});

// Anything else Prisma throws is a genuine server fault. Its message still must
// not reach the client — see above — so it is replaced with a generic one. The
// real error is logged below and stays available in the server logs.
const isPrismaErrorCode = (code) => typeof code === "string" && /^P\d{4}$/.test(code);

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

    // Translate raw Prisma failures before anything else reads the error.
    const prisma = isPrismaErrorCode(err.code)
        ? PRISMA_ERROR_MAP[err.code] ?? {
              statusCode: 500,
              code: "INTERNAL_ERROR",
              message: "Internal server error",
          }
        : null;

    const statusCode = prisma?.statusCode ?? err.statusCode ?? err.status ?? 500;

    // Prefer the explicit code; otherwise derive from status; otherwise generic.
    const code = prisma?.code ?? err.code ?? STATUS_TO_CODE[statusCode] ?? "INTERNAL_ERROR";

    res.status(statusCode).json({
        success: false,
        code,
        message: prisma?.message ?? err.message ?? "Internal Server Error",
        errors: Array.isArray(err.errors) ? err.errors : [],
        data: err.data ?? null,
    });
};
