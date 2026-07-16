import { v2 as cloudinary } from "cloudinary"
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { logger } from "../../../logs/logger.js";


// Configuration
const config = cloudinary.config({
    cloud_name: 'funturf',
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_SECRET_KEY,
    secure: true
});


/**
 * POST /users/media/signature — mint a short-lived Cloudinary upload signature so
 * a signed-in user can upload straight from the browser (the file never transits
 * our API).
 *
 * AUTH REQUIRED (verifyJWT on the route): the signature IS the upload credential,
 * so handing it to anonymous callers let anyone upload into our Cloudinary
 * account. The api_secret is only ever used here to sign — it is never returned.
 * `apikey` is safe to return; Cloudinary's signed-upload flow expects the client
 * to send it alongside the signature.
 *
 * The signature is bound to `timestamp` and to the exact params below, so it
 * can't be replayed to upload outside the `images` folder.
 */
const signMedia = asyncHandler(async (req, res) => {

    const timestamp = Math.round((new Date).getTime() / 1000);

    const signature = cloudinary.utils.api_sign_request({
        timestamp: timestamp,
        source: 'uw',
        folder: 'images'
    },
        config.api_secret
    );

    logger.info(`cloudinary upload signature issued to user=${req.user.id}`);

    // Same ApiResponse envelope as every other endpoint — this used to return a
    // bare object, which forced clients to special-case it.
    return res.status(200).json(
        new ApiResponse(200, "Upload signature created", {
            signature: signature,
            timestamp: timestamp,
            cloudname: config.cloud_name,
            apikey: config.api_key
        })
    );
})

export { signMedia }
