import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";
import { pgClient } from "../../prisma.js";
import { canCommentOnEvent, getEventAdminIds, isEventAdmin } from "../../utils/eventService.js";
import { emitToUser } from "../../socket.js";
import { logger } from "../../../logs/logger.js";

const MAX_MESSAGE_LEN = 2000;
const MAX_EMOJI_LEN = 16;
const MAX_URL_LEN = 1000;
const HISTORY_LIMIT = 50;
const VALID_MESSAGE_TYPES = new Set(["text", "image", "location", "system"]);

// The sender fields we expose on a chat message — enough to render the bubble.
const SENDER_SELECT = {
    id: true,
    first_name: true,
    last_name: true,
    profile_picture_url: true,
};

// Include shape shared by every read/write, so DTOs are always complete.
const MESSAGE_INCLUDE = {
    users_messages_sender_idTousers: { select: SENDER_SELECT },
    message_reactions: { select: { emoji: true, user_id: true } },
    reply_to: {
        select: {
            id: true,
            content: true,
            attachment_url: true,
            is_deleted: true,
            users_messages_sender_idTousers: { select: SENDER_SELECT },
        },
    },
};

const senderName = (u) => [u?.first_name, u?.last_name].filter(Boolean).join(" ") || "Player";

// Collapse raw reaction rows into [{ emoji, count, user_ids }] so the client can
// render counts and tell whether the caller reacted.
const groupReactions = (rows = []) => {
    const map = new Map();
    for (const r of rows) {
        const g = map.get(r.emoji) || { emoji: r.emoji, count: 0, user_ids: [] };
        g.count += 1;
        g.user_ids.push(r.user_id);
        map.set(r.emoji, g);
    }
    return [...map.values()];
};

// A short preview of the message being replied to (or a placeholder).
const replyPreview = (r) => {
    if (!r) return null;
    let text;
    if (r.is_deleted) text = "Deleted message";
    else if (r.content) text = r.content;
    else if (r.attachment_url) text = "Photo";
    else text = "";
    return { id: r.id, sender_name: senderName(r.users_messages_sender_idTousers), content: text };
};

// Shape a Prisma message row into the DTO the client renders. A soft-deleted
// message keeps its id/position but hides content/attachment/reactions.
const toDto = (m) => ({
    id: m.id,
    event_id: m.event_id,
    content: m.is_deleted ? null : m.content,
    attachment_url: m.is_deleted ? null : m.attachment_url,
    message_type: m.message_type,
    is_edited: Boolean(m.is_edited),
    is_deleted: Boolean(m.is_deleted),
    created_at: m.created_at,
    edited_at: m.edited_at,
    reply_to: m.is_deleted ? null : replyPreview(m.reply_to),
    reactions: m.is_deleted ? [] : groupReactions(m.message_reactions),
    sender: m.users_messages_sender_idTousers
        ? {
              id: m.users_messages_sender_idTousers.id,
              first_name: m.users_messages_sender_idTousers.first_name,
              last_name: m.users_messages_sender_idTousers.last_name,
              profile_picture_url: m.users_messages_sender_idTousers.profile_picture_url,
          }
        : { id: m.sender_id },
});

// Everyone allowed in the squad chat: admins (organizer + co_organizers) plus
// approved participants. Used to fan realtime updates out to their live sockets.
async function getEventMemberIds(eventId) {
    const [adminIds, approved] = await Promise.all([
        getEventAdminIds(eventId),
        pgClient.event_participants.findMany({
            where: { event_id: eventId, status: "approved" },
            select: { user_id: true },
        }),
    ]);
    return [...new Set([...adminIds, ...approved.map((p) => p.user_id)])];
}

// Push a realtime chat event to every member's open sockets. Best-effort: the DB
// write already happened, so a failed emit only costs live delivery.
async function fanOut(eventId, event, payload) {
    try {
        const memberIds = await getEventMemberIds(eventId);
        memberIds.forEach((uid) => emitToUser(uid, event, payload));
    } catch (err) {
        logger.error(`chat fan-out (${event}) failed for event=${eventId}: ${err.message}`);
    }
}

// Only https attachment URLs (they come from our own /api/upload → imgbb and are
// rendered as <img>). Cheap guard against junk/oversized values.
const isValidAttachmentUrl = (url) =>
    typeof url === "string" && /^https:\/\//i.test(url) && url.length <= MAX_URL_LEN;

/**
 * GET /events/:event_id/messages — squad chat history (last 50, oldest→newest).
 * Member-only (approved players + admins).
 */
export const getEventMessages = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { event_id } = req.params;

    const event = await pgClient.events.findUnique({ where: { id: event_id }, select: { id: true } });
    if (!event) throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_FOUND);
    if (!(await canCommentOnEvent(event_id, userId))) {
        throw ApiError.fromCode(ERROR_CODES.EVENT_CHAT_FORBIDDEN);
    }

    // Deleted messages are kept (as tombstones) so reply references stay intact.
    const rows = await pgClient.messages.findMany({
        where: { event_id },
        orderBy: { created_at: "desc" },
        take: HISTORY_LIMIT,
        include: MESSAGE_INCLUDE,
    });

    const messages = rows.reverse().map(toDto);
    return res.status(200).json(new ApiResponse(200, `${messages.length} messages`, { messages }));
});

/**
 * POST /events/:event_id/messages — send a message (text and/or image, optional
 * reply). Approved players + admins only. Persists + pushes `chat:new`.
 */
export const sendEventMessage = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { event_id } = req.params;
    const content = (req.body?.content ?? "").toString().trim();
    const attachment_url = req.body?.attachment_url ?? null;
    const reply_to_id = req.body?.reply_to_id ?? null;
    let message_type = (req.body?.message_type ?? "").toString();

    // A message must carry text OR an attachment (or both).
    if (!content && !attachment_url) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "Message cannot be empty" });
    }
    if (content.length > MAX_MESSAGE_LEN) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: `Message is too long (max ${MAX_MESSAGE_LEN} characters)`,
        });
    }
    if (attachment_url && !isValidAttachmentUrl(attachment_url)) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "Invalid attachment" });
    }
    // Derive/validate the type: an attachment defaults to image.
    if (!message_type) message_type = attachment_url ? "image" : "text";
    if (!VALID_MESSAGE_TYPES.has(message_type)) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "Invalid message type" });
    }

    const event = await pgClient.events.findUnique({ where: { id: event_id }, select: { id: true } });
    if (!event) throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_FOUND);
    if (!(await canCommentOnEvent(event_id, userId))) {
        throw ApiError.fromCode(ERROR_CODES.EVENT_CHAT_FORBIDDEN);
    }

    // A reply must point at a message in THIS same chat.
    if (reply_to_id) {
        const parent = await pgClient.messages.findUnique({
            where: { id: reply_to_id },
            select: { id: true, event_id: true },
        });
        if (!parent || parent.event_id !== event_id) {
            throw ApiError.fromCode(ERROR_CODES.MESSAGE_NOT_FOUND);
        }
    }

    const created = await pgClient.messages.create({
        data: {
            event_id,
            sender_id: userId,
            content, // "" for an attachment-only message
            attachment_url: attachment_url || null,
            message_type,
            reply_to_id: reply_to_id || null,
        },
        include: MESSAGE_INCLUDE,
    });
    const dto = toDto(created);

    await fanOut(event_id, "chat:new", dto);
    return res.status(201).json(new ApiResponse(201, "Message sent", dto));
});

/**
 * PATCH /events/:event_id/messages/:message_id — edit your own message's text.
 * Pushes `chat:update` with the full new DTO.
 */
export const editEventMessage = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { event_id, message_id } = req.params;
    const content = (req.body?.content ?? "").toString().trim();

    if (!content) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "Message cannot be empty" });
    }
    if (content.length > MAX_MESSAGE_LEN) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: `Message is too long (max ${MAX_MESSAGE_LEN} characters)`,
        });
    }

    const existing = await pgClient.messages.findUnique({
        where: { id: message_id },
        select: { id: true, sender_id: true, event_id: true, is_deleted: true },
    });
    if (!existing || existing.event_id !== event_id || existing.is_deleted) {
        throw ApiError.fromCode(ERROR_CODES.MESSAGE_NOT_FOUND);
    }
    if (existing.sender_id !== userId) throw ApiError.fromCode(ERROR_CODES.NOT_MESSAGE_OWNER);

    const updated = await pgClient.messages.update({
        where: { id: message_id },
        data: { content, is_edited: true, edited_at: new Date() },
        include: MESSAGE_INCLUDE,
    });
    const dto = toDto(updated);

    await fanOut(event_id, "chat:update", dto);
    return res.status(200).json(new ApiResponse(200, "Message updated", dto));
});

/**
 * DELETE /events/:event_id/messages/:message_id — soft-delete a message. Allowed
 * for the sender OR a match admin. Pushes `chat:delete` { id, event_id }.
 */
export const deleteEventMessage = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { event_id, message_id } = req.params;

    const existing = await pgClient.messages.findUnique({
        where: { id: message_id },
        select: { id: true, sender_id: true, event_id: true },
    });
    if (!existing || existing.event_id !== event_id) {
        throw ApiError.fromCode(ERROR_CODES.MESSAGE_NOT_FOUND);
    }

    const canDelete = existing.sender_id === userId || (await isEventAdmin(event_id, userId));
    if (!canDelete) throw ApiError.fromCode(ERROR_CODES.MESSAGE_DELETE_FORBIDDEN);

    await pgClient.messages.update({
        where: { id: message_id },
        data: { is_deleted: true, deleted_at: new Date() },
    });

    await fanOut(event_id, "chat:delete", { id: message_id, event_id });
    return res.status(200).json(new ApiResponse(200, "Message deleted", { id: message_id }));
});

/**
 * POST /events/:event_id/messages/read — mark this match's squad chat read for the
 * caller (upserts their read marker to now). Member-only. Clears the chat's unread
 * badge in the navbar conversation list. Read state is private/per-user, so nothing
 * is fanned out to other members.
 */
export const markEventChatRead = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { event_id } = req.params;

    if (!(await canCommentOnEvent(event_id, userId))) {
        throw ApiError.fromCode(ERROR_CODES.EVENT_CHAT_FORBIDDEN);
    }

    const now = new Date();
    await pgClient.event_chat_reads.upsert({
        where: { user_id_event_id: { user_id: userId, event_id } },
        update: { last_read_at: now, updated_at: now },
        create: { user_id: userId, event_id, last_read_at: now },
    });

    return res.status(200).json(new ApiResponse(200, "Chat marked read", { event_id }));
});

/**
 * POST /events/:event_id/messages/:message_id/reactions — toggle an emoji react
 * for the caller. Member-only. Pushes `chat:reaction` { message_id, event_id,
 * reactions } with the message's fresh grouped reactions.
 */
export const reactEventMessage = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { event_id, message_id } = req.params;
    const emoji = (req.body?.emoji ?? "").toString().trim();

    if (!emoji || emoji.length > MAX_EMOJI_LEN) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "Invalid emoji" });
    }

    if (!(await canCommentOnEvent(event_id, userId))) {
        throw ApiError.fromCode(ERROR_CODES.EVENT_CHAT_FORBIDDEN);
    }

    const message = await pgClient.messages.findUnique({
        where: { id: message_id },
        select: { id: true, event_id: true, is_deleted: true },
    });
    if (!message || message.event_id !== event_id || message.is_deleted) {
        throw ApiError.fromCode(ERROR_CODES.MESSAGE_NOT_FOUND);
    }

    // Toggle: remove the reaction if it exists, otherwise add it.
    const existing = await pgClient.message_reactions.findFirst({
        where: { message_id, user_id: userId, emoji },
        select: { id: true },
    });
    if (existing) {
        await pgClient.message_reactions.delete({ where: { id: existing.id } });
    } else {
        await pgClient.message_reactions.create({ data: { message_id, user_id: userId, emoji } });
    }

    const rows = await pgClient.message_reactions.findMany({
        where: { message_id },
        select: { emoji: true, user_id: true },
    });
    const reactions = groupReactions(rows);

    await fanOut(event_id, "chat:reaction", { message_id, event_id, reactions });
    return res.status(200).json(new ApiResponse(200, "Reaction updated", { message_id, reactions }));
});
