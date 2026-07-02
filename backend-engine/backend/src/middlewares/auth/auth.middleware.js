import { ApiError } from "../../utils/apiError.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import { mongoClient, pgClient } from "../../prisma.js";
import bcrypt from "bcrypt";
import userCache from "../../utils/cache.js";


export const verifyJWT = asyncHandler(async (req, _, next) => {

        const authHeader = req.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ")
            ? authHeader.slice(7).trim()
            : "";

        if (!token) throw ApiError.fromCode(ERROR_CODES.MISSING_TOKEN);

        // jwt.verify throws on tampered/expired tokens — translate that into our
        // standard INVALID_TOKEN envelope instead of leaking a raw 500.
        let decodedInfo;
        try {
            decodedInfo = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        } catch (error) {
            throw ApiError.fromCode(ERROR_CODES.INVALID_TOKEN);
        }

        if (!decodedInfo.id || !decodedInfo.email) {
            throw ApiError.fromCode(ERROR_CODES.INVALID_TOKEN);
        }

        req.user = decodedInfo;

        next();

})


export const encryptPassword = asyncHandler(async (req, _, next) => {
    req.body.password_hash = await bcrypt.hash(req.body.password_hash, 10);
    next()
})


/**
 * Role-based access guard. Allows the request only if the authenticated user's
 * `user_type` is in `allowedRoles`. MUST be mounted AFTER `verifyJWT` (it reads
 * `req.user.user_type`, which comes from the access token).
 *
 * Usage: router.post("/x", verifyJWT, authorizeRoles("turf_admin", "super_admin"), handler)
 */
export const authorizeRoles = (...allowedRoles) =>
    asyncHandler(async (req, _, next) => {
        if (!req.user) {
            throw ApiError.fromCode(ERROR_CODES.UNAUTHORIZED);
        }
        if (!allowedRoles.includes(req.user.user_type)) {
            throw ApiError.fromCode(ERROR_CODES.FORBIDDEN);
        }
        next();
    });