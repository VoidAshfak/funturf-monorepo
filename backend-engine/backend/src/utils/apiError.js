/**
 * Standard error thrown by controllers/middleware. The terminal `errorHandler`
 * serializes it into the API error envelope: { success, code, message, errors, data }.
 *
 * Prefer the `ApiError.fromCode(...)` factory with a centralized ERROR_CODES entry
 * (see utils/errorCodes.js) so responses carry a stable machine-readable `code`.
 * The positional constructor is kept for backward compatibility with existing calls.
 */
class ApiError extends Error {
    constructor(
        statusCode,
        message,
        errors = [],
        stack = "",
        code = undefined
    ) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.data = null;
        this.success = false;
        this.errors = errors;
        this.code = code; // machine-readable code (undefined for legacy calls)
        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Build an ApiError from a centralized ERROR_CODES entry.
     * @param {{code:string, statusCode:number, message:string}} errorCode - an ERROR_CODES entry
     * @param {{message?:string, errors?:any[], statusCode?:number}} [overrides]
     */
    static fromCode(errorCode, { message, errors = [], statusCode } = {}) {
        return new ApiError(
            statusCode ?? errorCode.statusCode,
            message ?? errorCode.message,
            errors,
            "",
            errorCode.code
        );
    }
}

export { ApiError }
