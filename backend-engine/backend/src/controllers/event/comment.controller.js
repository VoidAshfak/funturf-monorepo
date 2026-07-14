import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";
import { logger } from "../../../logs/logger.js";
import { pgClient } from "../../prisma.js";
import { createNotification } from "../../utils/notificationService.js";
import { canCommentOnEvent, isEventAdmin } from "../../utils/eventService.js";

/**
 * Event discussion (event_comments + comment_likes).
 *
 * Access model:
 *   - READ  is public. The thread is social proof that a match is real, so it's
 *     visible to anyone looking at the event — including signed-out visitors.
 *   - WRITE is earned: only the organizer, a co_organizer, or a participant whose
 *     join request was APPROVED may post (`canCommentOnEvent`). A pending or
 *     rejected requester can read but not post.
 *
 * Threading is ONE level deep (Reddit-style top-level comment + flat replies
 * under it). Anything deeper turns into an unreadable ladder on mobile, so a
 * reply-to-a-reply is re-parented onto the same root.
 */

const MAX_COMMENT_LENGTH = 2000;

// Author fields returned with every comment — enough to render the byline.
const AUTHOR_SELECT = {
    select: { id: true, first_name: true, last_name: true, profile_picture_url: true },
};

/** Shape a Prisma row into the API's comment DTO. */
const toDTO = (c, likedIds = new Set()) => ({
    id: c.id,
    event_id: c.event_id,
    parent_comment_id: c.parent_comment_id,
    // A soft-deleted comment is kept so its replies still have a parent, but its
    // content must never leak. Render it as a tombstone.
    content: c.is_deleted ? null : c.content,
    is_deleted: Boolean(c.is_deleted),
    is_edited: Boolean(c.is_edited),
    is_pinned: Boolean(c.is_pinned),
    likes_count: c.likes_count ?? 0,
    liked_by_me: likedIds.has(c.id),
    created_at: c.created_at,
    edited_at: c.edited_at,
    author: c.is_deleted ? null : c.users_event_comments_user_idTousers,
    user_id: c.is_deleted ? null : c.user_id,
});

/**
 * GET /events/:event_id/comments — the whole thread, flat.
 *
 * Returns a flat list (the client nests it); `liked_by_me` is filled in when the
 * caller is signed in (route uses optional auth), so the like button renders in
 * the right state on first paint instead of flickering.
 */
export const getComments = asyncHandler(async (req, res) => {
    const { event_id } = req.params;
    const userId = req.user?.id;

    const event = await pgClient.events.findUnique({
        where: { id: event_id },
        select: { id: true },
    });
    if (!event) throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_FOUND);

    const comments = await pgClient.event_comments.findMany({
        where: { event_id },
        orderBy: [{ is_pinned: "desc" }, { created_at: "asc" }],
        include: { users_event_comments_user_idTousers: AUTHOR_SELECT },
    });

    // Which of these has the caller already liked?
    let likedIds = new Set();
    if (userId && comments.length > 0) {
        const likes = await pgClient.comment_likes.findMany({
            where: { user_id: userId, comment_id: { in: comments.map((c) => c.id) } },
            select: { comment_id: true },
        });
        likedIds = new Set(likes.map((l) => l.comment_id));
    }

    // Tell the client up front whether to show a composer or a "join to comment"
    // prompt — otherwise it has to guess from the participant list.
    const can_comment = userId ? await canCommentOnEvent(event_id, userId) : false;

    return res.status(200).json(
        new ApiResponse(200, `${comments.length} comments`, {
            comments: comments.map((c) => toDTO(c, likedIds)),
            can_comment,
        })
    );
});

/**
 * POST /events/:event_id/comments — post a comment or a reply.
 * Body: { content, parent_comment_id? }
 */
export const createComment = asyncHandler(async (req, res) => {
    const { event_id } = req.params;
    const userId = req.user.id;
    const { content, parent_comment_id } = req.body || {};

    const text = String(content ?? "").trim();
    if (!text) throw ApiError.fromCode(ERROR_CODES.COMMENT_EMPTY);
    if (text.length > MAX_COMMENT_LENGTH) throw ApiError.fromCode(ERROR_CODES.COMMENT_TOO_LONG);

    const event = await pgClient.events.findUnique({
        where: { id: event_id },
        select: { id: true, title: true, organizer_id: true },
    });
    if (!event) throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_FOUND);

    // The gate: you must actually be in this match to post in it.
    if (!(await canCommentOnEvent(event_id, userId))) {
        logger.warn(`comment blocked: user=${userId} is not an approved player of event=${event_id}`);
        throw ApiError.fromCode(ERROR_CODES.CANNOT_COMMENT);
    }

    // Replies are one level deep. Replying to a reply attaches to its root instead
    // of nesting further, so the thread can't turn into a staircase.
    let parentId = null;
    let parent = null;
    if (parent_comment_id) {
        parent = await pgClient.event_comments.findUnique({
            where: { id: parent_comment_id },
            select: { id: true, event_id: true, user_id: true, parent_comment_id: true },
        });
        if (!parent || parent.event_id !== event_id) {
            throw ApiError.fromCode(ERROR_CODES.COMMENT_NOT_FOUND);
        }
        parentId = parent.parent_comment_id ?? parent.id;
    }

    const comment = await pgClient.$transaction(async (tx) => {
        const created = await tx.event_comments.create({
            data: {
                event_id,
                user_id: userId,
                parent_comment_id: parentId,
                content: text,
            },
            include: { users_event_comments_user_idTousers: AUTHOR_SELECT },
        });

        // Keep the parent's replies_count honest (it's what the UI counts on).
        if (parentId) {
            await tx.event_comments.update({
                where: { id: parentId },
                data: { replies_count: { increment: 1 } },
            });
        }
        return created;
    });

    logger.info(`comment created: id=${comment.id} event=${event_id} user=${userId} reply=${Boolean(parentId)}`);

    // Notify the person being replied to (never yourself). Medium priority: it
    // belongs in the bell, but it shouldn't interrupt with a toast.
    if (parent && parent.user_id !== userId) {
        await createNotification({
            user_id: parent.user_id,
            type: "comment_reply",
            title: "New reply",
            message: `Someone replied to your comment on "${event.title}"`,
            data: { eventId: event_id, commentId: comment.id },
            priority: "medium",
            action_url: `/events/${event_id}`,
        });
    } else if (!parent && event.organizer_id !== userId) {
        // A new top-level comment is worth telling the organizer about, quietly.
        await createNotification({
            user_id: event.organizer_id,
            type: "comment_added",
            title: "New comment",
            message: `A new comment was posted on "${event.title}"`,
            data: { eventId: event_id, commentId: comment.id },
            priority: "low",
            action_url: `/events/${event_id}`,
        });
    }

    return res.status(201).json(new ApiResponse(201, "Comment posted", toDTO(comment)));
});

/** PATCH /events/:event_id/comments/:comment_id — author edits their own comment. */
export const updateComment = asyncHandler(async (req, res) => {
    const { comment_id } = req.params;
    const userId = req.user.id;
    const { content } = req.body || {};

    const text = String(content ?? "").trim();
    if (!text) throw ApiError.fromCode(ERROR_CODES.COMMENT_EMPTY);
    if (text.length > MAX_COMMENT_LENGTH) throw ApiError.fromCode(ERROR_CODES.COMMENT_TOO_LONG);

    const comment = await pgClient.event_comments.findUnique({ where: { id: comment_id } });
    if (!comment || comment.is_deleted) throw ApiError.fromCode(ERROR_CODES.COMMENT_NOT_FOUND);
    // Editing is author-only — not even an event admin may put words in your mouth.
    if (comment.user_id !== userId) throw ApiError.fromCode(ERROR_CODES.NOT_COMMENT_AUTHOR);

    const updated = await pgClient.event_comments.update({
        where: { id: comment_id },
        data: { content: text, is_edited: true, edited_at: new Date() },
        include: { users_event_comments_user_idTousers: AUTHOR_SELECT },
    });

    logger.info(`comment edited: id=${comment_id} user=${userId}`);
    return res.status(200).json(new ApiResponse(200, "Comment updated", toDTO(updated)));
});

/**
 * DELETE /events/:event_id/comments/:comment_id
 * Author OR an event admin (moderation). SOFT delete: the row survives so its
 * replies keep a parent, but the content is blanked out of every response.
 */
export const deleteComment = asyncHandler(async (req, res) => {
    const { event_id, comment_id } = req.params;
    const userId = req.user.id;

    const comment = await pgClient.event_comments.findUnique({ where: { id: comment_id } });
    if (!comment || comment.is_deleted) throw ApiError.fromCode(ERROR_CODES.COMMENT_NOT_FOUND);

    const isAuthor = comment.user_id === userId;
    const isAdmin = await isEventAdmin(event_id, userId);
    if (!isAuthor && !isAdmin) throw ApiError.fromCode(ERROR_CODES.NOT_COMMENT_AUTHOR);

    await pgClient.event_comments.update({
        where: { id: comment_id },
        data: {
            is_deleted: true,
            deleted_at: new Date(),
            deleted_by: userId,
        },
    });

    logger.info(`comment deleted: id=${comment_id} by=${userId} asAdmin=${!isAuthor && isAdmin}`);
    return res.status(200).json(new ApiResponse(200, "Comment deleted", { comment_id }));
});

/**
 * POST /events/:event_id/comments/:comment_id/like — toggle.
 *
 * `comment_likes` has a unique (comment_id, user_id), so the row's existence IS
 * the like. Toggle + counter update run in one transaction, otherwise a double
 * tap can drift `likes_count` away from the real count.
 */
export const toggleCommentLike = asyncHandler(async (req, res) => {
    const { event_id, comment_id } = req.params;
    const userId = req.user.id;

    const comment = await pgClient.event_comments.findUnique({ where: { id: comment_id } });
    if (!comment || comment.is_deleted) throw ApiError.fromCode(ERROR_CODES.COMMENT_NOT_FOUND);

    // Liking is a form of participation — same gate as posting.
    if (!(await canCommentOnEvent(event_id, userId))) {
        throw ApiError.fromCode(ERROR_CODES.CANNOT_COMMENT);
    }

    const existing = await pgClient.comment_likes.findUnique({
        where: { comment_id_user_id: { comment_id, user_id: userId } },
    });

    const result = await pgClient.$transaction(async (tx) => {
        if (existing) {
            await tx.comment_likes.delete({
                where: { comment_id_user_id: { comment_id, user_id: userId } },
            });
            const row = await tx.event_comments.update({
                where: { id: comment_id },
                // Never let a race drive the counter negative.
                data: { likes_count: { decrement: 1 } },
                select: { likes_count: true },
            });
            return { liked: false, likes_count: Math.max(row.likes_count ?? 0, 0) };
        }

        await tx.comment_likes.create({ data: { comment_id, user_id: userId } });
        const row = await tx.event_comments.update({
            where: { id: comment_id },
            data: { likes_count: { increment: 1 } },
            select: { likes_count: true },
        });
        return { liked: true, likes_count: row.likes_count ?? 1 };
    });

    return res.status(200).json(new ApiResponse(200, result.liked ? "Liked" : "Unliked", {
        comment_id,
        ...result,
    }));
});
