import { Router } from "express";
import { 
    registerUser, 
    loginUser, 
    logoutUser, 
    tokenRefresh, 
    varifyLogin ,
    getUserById,
} from "../../controllers/auth/user.controller.js"
import {signMedia} from "../../controllers/auth/media.controller.js"
import {upload} from "../../middlewares/file-upload/multer.middleware.js";
import { 
    verifyJWT, 
    encryptPassword 
} from "../../middlewares/auth/auth.middleware.js";

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
router.route("/:user_id").get(getUserById);
router.route("/media/signature").post(signMedia)


// protected routes
// router.route("/logout").post(verifyJWT, logoutUser)
// router.route("/varify-login").post(varifyLogin)

export default router;