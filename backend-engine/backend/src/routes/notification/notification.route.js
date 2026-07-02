import { Router } from "express";
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
} from "../../controllers/notification/notification.controller.js";
import { verifyJWT } from "../../middlewares/auth/auth.middleware.js";

const router = Router();

// Every notification route is private to the logged-in user.
router.use(verifyJWT);

router.route("/").get(getNotifications);
router.route("/unread-count").get(getUnreadCount);
// Static path before the dynamic ":id" so "read-all" isn't swallowed as an id.
router.route("/read-all").patch(markAllAsRead);
router.route("/:id/read").patch(markAsRead);
router.route("/:id").delete(deleteNotification);

export default router;
