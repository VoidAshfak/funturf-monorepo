import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";
import { pgClient } from "../../prisma.js";

// All handlers are scoped to the authenticated user (req.user.id set by verifyJWT).
// A user can only ever read/mutate their OWN notifications — every query is
// filtered by user_id, so there's no way to touch someone else's rows.

/**
 * GET /notifications?page=&limit=
 * Paginated list of the caller's notifications (newest first) + unread count.
 */
const getNotifications = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 50);
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
        pgClient.notifications.findMany({
            where: { user_id: userId },
            orderBy: { created_at: "desc" },
            skip,
            take: limit,
        }),
        pgClient.notifications.count({ where: { user_id: userId } }),
        pgClient.notifications.count({ where: { user_id: userId, is_read: false } }),
    ]);

    return res.status(200).json(
        new ApiResponse(200, `${notifications.length} notifications found`, {
            notifications,
            unreadCount,
            pagination: { page, limit, total, hasMore: skip + notifications.length < total },
        })
    );
});

/** GET /notifications/unread-count -> { unreadCount } */
const getUnreadCount = asyncHandler(async (req, res) => {
    const unreadCount = await pgClient.notifications.count({
        where: { user_id: req.user.id, is_read: false },
    });
    return res
        .status(200)
        .json(new ApiResponse(200, "Unread count", { unreadCount }));
});

/** PATCH /notifications/:id/read -> marks a single notification read (idempotent). */
const markAsRead = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    // Ownership check: only update if the row belongs to the caller.
    const existing = await pgClient.notifications.findFirst({
        where: { id, user_id: userId },
        select: { id: true },
    });
    if (!existing) throw ApiError.fromCode(ERROR_CODES.NOTIFICATION_NOT_FOUND);

    const notification = await pgClient.notifications.update({
        where: { id },
        data: { is_read: true, read_at: new Date() },
    });

    return res.status(200).json(new ApiResponse(200, "Notification marked as read", notification));
});

/** PATCH /notifications/read-all -> marks every unread notification read. */
const markAllAsRead = asyncHandler(async (req, res) => {
    const result = await pgClient.notifications.updateMany({
        where: { user_id: req.user.id, is_read: false },
        data: { is_read: true, read_at: new Date() },
    });

    return res
        .status(200)
        .json(new ApiResponse(200, "All notifications marked as read", { updated: result.count }));
});

/** DELETE /notifications/:id -> removes one of the caller's notifications. */
const deleteNotification = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    const existing = await pgClient.notifications.findFirst({
        where: { id, user_id: userId },
        select: { id: true },
    });
    if (!existing) throw ApiError.fromCode(ERROR_CODES.NOTIFICATION_NOT_FOUND);

    await pgClient.notifications.delete({ where: { id } });

    return res.status(200).json(new ApiResponse(200, "Notification deleted", { id }));
});

export {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
};
