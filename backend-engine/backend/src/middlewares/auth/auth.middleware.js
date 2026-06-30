import { ApiError } from "../../utils/apiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import { mongoClient, pgClient } from "../../prisma.js";
import bcrypt from "bcrypt";
import userCache from "../../utils/cache.js";


export const verifyJWT = asyncHandler(async (req, _, next) => {

        const authHeader = req.headers.authorization || "";
        const token = authHeader.replace("Bearer ", "");

        if (!token || !authHeader) throw new ApiError(401, "Missing token");

        const decodedInfo = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        // TODO: Remove console.log
        console.log("Decoded info:", decodedInfo);

        if (!decodedInfo.id || !decodedInfo.email) {
            throw new ApiError(401, "Invalid access token");
        }

        req.user = decodedInfo;

        next();

})


export const encryptPassword = asyncHandler(async (req, _, next) => {
    req.body.password_hash = await bcrypt.hash(req.body.password_hash, 10);
    next()
})