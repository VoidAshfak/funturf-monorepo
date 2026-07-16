import { Router } from "express";
import {
    getConversations,
    getDmThread,
    sendDm,
    reactDm,
    markDmRead,
} from "../../controllers/chat/dm.controller.js";
import { verifyJWT } from "../../middlewares/auth/auth.middleware.js";
import { commentWriteLimiter } from "../../middlewares/rateLimit.middleware.js";

const router = Router();

// Everything here is private to the caller (identity from the token).
//   GET  /chat/conversations        -> unified list (DMs + match chats)
//   GET  /chat/dm/:user_id          -> a DM thread (+ that user's profile)
//   POST /chat/dm/:user_id          -> send a DM (self-messaging blocked; supports reply_to_id)
//   POST /chat/dm/:user_id/read     -> mark that thread read
//   POST /chat/dm/:user_id/messages/:message_id/reactions -> toggle an emoji react
router.route("/conversations").get(verifyJWT, getConversations);
router.route("/dm/:user_id").get(verifyJWT, getDmThread).post(verifyJWT, commentWriteLimiter, sendDm);
router.route("/dm/:user_id/read").post(verifyJWT, markDmRead);
router
    .route("/dm/:user_id/messages/:message_id/reactions")
    .post(verifyJWT, commentWriteLimiter, reactDm);

export default router;
