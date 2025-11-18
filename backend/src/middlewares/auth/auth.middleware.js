import { ApiError } from "../../utils/apiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import { mongoClient, pgClient } from "../../prisma.js";
import bcrypt from "bcrypt";
import userCache from "../../utils/cache.js";


export const verifyJWT = asyncHandler(async (req, _, next) => {


    try {
        const authHeader = req.headers.authorization || "";
        const token = authHeader.replace("Bearer ", "");

        // console.log("Header", authHeader);
        // console.log("Token", token);

        if (!token || !authHeader) throw new ApiError(401, "Missing token");

        const decodedInfo = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        console.log("Decoded info:", decodedInfo);

        // const user = await pgClient.users.findUnique({
        //     where: {
        //         id: decodedInfo.id
        //     },
        //     select: {
        //         id: true,
        //         email: true,
        //         first_name: true,
        //         last_name: true
        //     }
        // })

        if (!decodedInfo.id || !decodedInfo.email) {
            throw new ApiError(401, "Invalid access token")
        }

        req.user = decodedInfo
        next()
    } catch (error) {
        throw new ApiError(401, "Unauthorized request. Token expired or invalid")
    }

})

// export const hitCache = asyncHandler(async (req, _, next) => {
//     const accessToken = req.cookies?.accessToken || req.header("Authorization").replace("Bearer ", "")

//     if(!accessToken) {
//         throw new ApiError(401, "Unauthorized request")
//     }

//     try {
//         const decodedToken = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET)
//         const userId = decodedToken.id

//         let user = await userCache.get(userId)

//         if(!user) {

//             next()
//         } else {

//         }

//     } catch (error) {

//     }
// })

export const encryptPassword = asyncHandler(async (req, _, next) => {
    console.log(req.body.password_hash);

    req.body.password_hash = await bcrypt.hash(req.body.password_hash, 10);
    next()
})