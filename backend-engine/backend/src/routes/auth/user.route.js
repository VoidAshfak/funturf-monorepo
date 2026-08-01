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
import {
    forgotPassword,
    validateResetToken,
    resetPassword,
} from "../../controllers/auth/password.controller.js";
import {
    profileWriteLimiter,
    loginLimiter,
    registerLimiter,
    passwordResetRequestLimiter,
    passwordResetConfirmLimiter,
} from "../../middlewares/rateLimit.middleware.js";
import { signMedia } from "../../controllers/auth/media.controller.js"
import { upload } from "../../middlewares/file-upload/multer.middleware.js";
import {
    verifyJWT,
    encryptPassword
} from "../../middlewares/auth/auth.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const router = Router();


router.route("/register").post(
    registerLimiter,
    // upload.fields([
    //     {
    //         name: "profilePicture", 
    //         maxCount: 1
    //     }
    // ]),
    encryptPassword,
    registerUser
);
router.route("/login").post(loginLimiter, loginUser);
router.route("/refresh").post(tokenRefresh);

/**
 * Forgot / reset password — all three are PUBLIC by necessity: a user who can't
 * log in has no token to present. What stands in for auth is possession of the
 * emailed single-use token (see password.controller.js).
 *
 * The token is taken from the POST BODY, never a query string, so it is not
 * written into morgan's request log. Declared before "/:user_id" so "password"
 * is not swallowed as a user id.
 */
router.route("/password/forgot").post(passwordResetRequestLimiter, forgotPassword);
router.route("/password/reset/validate").post(passwordResetConfirmLimiter, validateResetToken);
router.route("/password/reset").post(passwordResetConfirmLimiter, resetPassword);

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