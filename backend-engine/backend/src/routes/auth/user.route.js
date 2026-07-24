import { Router } from "express";
import {
    registerUser,
    loginUser,
    logoutUser,
    tokenRefresh,
    varifyLogin,
    getUserById,
    updateMyProfile,
    scoutPlayers,
} from "../../controllers/auth/user.controller.js"
import { profileWriteLimiter } from "../../middlewares/rateLimit.middleware.js";
import { signMedia } from "../../controllers/auth/media.controller.js"
import { upload } from "../../middlewares/file-upload/multer.middleware.js";
import {
    verifyJWT,
    encryptPassword
} from "../../middlewares/auth/auth.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();


router.route("/register").post(
    // upload.fields([
    //     {
    //         name: "profilePicture", 
    //         maxCount: 1
    //     }
    // ]),
    encryptPassword,
    registerUser
);
router.route("/login").post(loginUser);
router.route("/refresh").post(tokenRefresh);

// Cloudinary upload signature — AUTH REQUIRED. This mints a credential that lets
// the holder upload into our Cloudinary account, so leaving it public let anyone
// on the internet fill our storage (and our bill) with arbitrary files. Signing
// is only ever needed by a signed-in user uploading their own media.
// Declared BEFORE "/:user_id" — a static path must never be reachable as an id.
router.route("/media/signature").post(verifyJWT, signMedia);

// Edit your OWN profile. The target user is taken from the verified JWT, never
// from the URL — "me" is a literal, so there is no id to tamper with. Declared
// BEFORE "/:user_id" for the same reason as /media/signature: a static path must
// never be swallowed by the id route.
router.route("/me").patch(verifyJWT, profileWriteLimiter, updateMyProfile);

// Player search for team recruitment. AUTH REQUIRED — this lists other users, so
// leaving it public would make it an anonymous directory of everyone on the
// platform. Results carry no contact details either (see PUBLIC_PLAYER_SELECT).
// Declared BEFORE "/:user_id" so "scout" isn't swallowed as a user id.
router.route("/scout").get(verifyJWT, scoutPlayers);

router.route("/:user_id").get(getUserById);


// protected routes
// router.route("/logout").post(verifyJWT, logoutUser)
// router.route("/varify-login").post(varifyLogin)

export default router;