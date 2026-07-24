import { ApiError } from "../utils/apiError.js";
import { ERROR_CODES } from "../utils/errorCodes.js";

// Accepts any RFC 4122 variant, which is what `uuid_generate_v4()` emits.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Is this a well-formed UUID? Exported for ids that arrive in the request BODY
 * (`invitedUserId`, `newCaptainId`, `sport_id`, …), which the path-param
 * middleware below can't see.
 */
export const isUuid = (value) => typeof value === "string" && UUID_RE.test(value);

/**
 * Reject path params that aren't UUIDs, before they reach Prisma.
 *
 * WHY: every id column in the PostgreSQL schema is `@db.Uuid`. Handing Prisma a
 * malformed one raises `P2023`, which the terminal errorHandler would serialize
 * as a 500 carrying the raw Prisma code — the wrong status for what is plainly a
 * bad request, and it leaks an implementation detail to the client. Failing here
 * turns `/teams/not-a-uuid` into a clean 400 `VALIDATION_ERROR` and saves a
 * pointless database round-trip.
 *
 * Usage — name the params a route actually carries:
 *   router.route("/:teamId").get(validateUuidParams("teamId"), getTeamById);
 *
 * Params that are absent on a given request are skipped, so one middleware can
 * cover a route family whose members don't all take the same ids.
 *
 * @param {...string} names path param names to check
 */
export const validateUuidParams = (...names) => (req, _res, next) => {
    for (const name of names) {
        const value = req.params?.[name];
        if (value !== undefined && !isUuid(value)) {
            return next(
                ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
                    message: `${name} must be a valid id`,
                })
            );
        }
    }
    return next();
};

/**
 * Same check, for ids that arrive in the QUERY STRING (`?ground=`, `?userTwo=`).
 *
 * Worth having as its own guard: query ids skip the path-param middleware
 * entirely, so an id that failed to decode used to travel all the way into
 * Prisma and surface as a 500 reading "Inconsistent column data: Error creating
 * UUID, invalid character ... found `k` at 1". By the time this runs the
 * public-id layer has already translated tokens to UUIDs, so anything still not
 * UUID-shaped is genuinely a bad request.
 *
 * Usage:
 *   router.route("/available-slots").get(validateUuidQuery("ground"), getAvailableSlots);
 *
 * @param {...string} names query param names to check
 */
export const validateUuidQuery = (...names) => (req, _res, next) => {
    for (const name of names) {
        const value = req.query?.[name];
        if (value !== undefined && !isUuid(value)) {
            return next(
                ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
                    message: `${name} must be a valid id`,
                })
            );
        }
    }
    return next();
};
