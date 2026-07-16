import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";
import { pgClient, Prisma } from "../../prisma.js";
import { emitToUser } from "../../socket.js";
import { logger } from "../../../logs/logger.js";

// Direct 1:1 messaging, plus a unified "conversations" list that also surfaces the
// user's match/squad chats. DMs reuse the shared `messages` table (event_id NULL,
// recipient_id set); match chats live under events and are read via the event
// message endpoints — here we only need their last-message preview for the list.

const MAX_MESSAGE_LEN = 2000;
const MAX_EMOJI_LEN = 16;
const MAX_URL_LEN = 1000;
const HISTORY_LIMIT = 50;

const SENDER_SELECT = {
    id: true,
    first_name: true,
    last_name: true,
    profile_picture_url: true,
};

// Include shape shared by every DM read/write so DTOs are always complete
// (sender profile, grouped reactions, and the replied-to message preview).
const DM_INCLUDE = {
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

const displayName = (u) =>
    [u?.first_name, u?.last_name].filter(Boolean).join(" ") || "Player";

// Only https attachment URLs (from our own /api/upload → imgbb), rendered as <img>.
const isValidAttachmentUrl = (url) =>
    typeof url === "string" && /^https:\/\//i.test(url) && url.length <= MAX_URL_LEN;

// Collapse raw reaction rows into [{ emoji, count, user_ids }].
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

// Short preview of the message being replied to (or a placeholder).
const replyPreview = (r) => {
    if (!r) return null;
    let text;
    if (r.is_deleted) text = "Deleted message";
    else if (r.content) text = r.content;
    else if (r.attachment_url) text = "Photo";
    else text = "";
    return { id: r.id, sender_name: displayName(r.users_messages_sender_idTousers), content: text };
};

// Shape a DM message row into the client DTO (mirrors the event-chat DTO so the
// same bubble component can render both — now incl. reactions + reply preview).
const toDmDto = (m) => ({
    id: m.id,
    recipient_id: m.recipient_id,
    content: m.is_deleted ? null : m.content,
    attachment_url: m.is_deleted ? null : m.attachment_url,
    message_type: m.message_type,
    is_edited: Boolean(m.is_edited),
    is_deleted: Boolean(m.is_deleted),
    created_at: m.created_at,
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

// True when a message is part of the 1:1 DM thread between `me` and `other`.
const inThread = (msg, me, other) =>
    msg.event_id === null &&
    ((msg.sender_id === me && msg.recipient_id === other) ||
        (msg.sender_id === other && msg.recipient_id === me));

/**
 * GET /chat/conversations — one merged, activity-sorted list of the caller's
 * conversations: 1:1 DM threads (with unread counts) AND the match chats they're
 * a member of (organizer / approved player). Powers the navbar chat box.
 */
export const getConversations = asyncHandler(async (req, res) => {
    const me = req.user.id;

    // --- DM threads: last message per partner + unread count (partner -> me) ---
    const dmRows = await pgClient.$queryRaw`
        WITH dm AS (
            SELECT
                CASE WHEN sender_id = ${me}::uuid THEN recipient_id ELSE sender_id END AS other_id,
                id, content, attachment_url, is_deleted, created_at, sender_id, recipient_id, is_read
            FROM messages
            WHERE event_id IS NULL AND recipient_id IS NOT NULL
              AND (sender_id = ${me}::uuid OR recipient_id = ${me}::uuid)
        ),
        last AS (
            SELECT DISTINCT ON (other_id)
                other_id, content, attachment_url, is_deleted, created_at, sender_id
            FROM dm
            ORDER BY other_id, created_at DESC
        ),
        unread AS (
            SELECT other_id, COUNT(*)::int AS n
            FROM dm
            WHERE recipient_id = ${me}::uuid AND is_read = false AND is_deleted = false
            GROUP BY other_id
        )
        SELECT
            l.other_id, l.content, l.attachment_url, l.is_deleted, l.created_at, l.sender_id,
            COALESCE(u.n, 0)::int AS unread,
            usr.first_name, usr.last_name, usr.profile_picture_url
        FROM last l
        JOIN users usr ON usr.id = l.other_id
        LEFT JOIN unread u ON u.other_id = l.other_id
    `;

    // --- Match chats: events the caller is a member of + last message + unread ---
    // Unread = messages in that event's chat sent by someone else, after the
    // caller's read marker (or all of them when they've never opened it).
    const matchRows = await pgClient.$queryRaw`
        WITH my_events AS (
            SELECT id, title, sport_type, created_at
            FROM events
            WHERE organizer_id = ${me}::uuid AND status <> 'cancelled'
            UNION
            SELECT e.id, e.title, e.sport_type, e.created_at
            FROM events e
            JOIN event_participants ep ON ep.event_id = e.id
            WHERE ep.user_id = ${me}::uuid AND ep.status = 'approved' AND e.status <> 'cancelled'
        ),
        reads AS (
            SELECT event_id, last_read_at
            FROM event_chat_reads
            WHERE user_id = ${me}::uuid
        ),
        last AS (
            SELECT DISTINCT ON (m.event_id)
                m.event_id, m.content, m.attachment_url, m.is_deleted, m.created_at, m.sender_id
            FROM messages m
            JOIN my_events ev ON ev.id = m.event_id
            ORDER BY m.event_id, m.created_at DESC
        ),
        unread AS (
            SELECT m.event_id, COUNT(*)::int AS n
            FROM messages m
            JOIN my_events ev ON ev.id = m.event_id
            LEFT JOIN reads r ON r.event_id = m.event_id
            WHERE m.sender_id <> ${me}::uuid
              AND m.is_deleted = false
              AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
            GROUP BY m.event_id
        )
        SELECT
            ev.id, ev.title, ev.sport_type, ev.created_at AS event_created_at,
            l.content, l.attachment_url, l.is_deleted, l.created_at, l.sender_id,
            COALESCE(u.n, 0)::int AS unread
        FROM my_events ev
        LEFT JOIN last l ON l.event_id = ev.id
        LEFT JOIN unread u ON u.event_id = ev.id
    `;

    const previewText = (r) =>
        r.is_deleted ? "Message deleted" : r.content ? r.content : r.attachment_url ? "Photo" : "";

    const dmConversations = dmRows.map((r) => ({
        type: "dm",
        id: r.other_id,
        title: displayName(r),
        avatar: r.profile_picture_url ?? null,
        unread: r.unread ?? 0,
        last_message: r.created_at
            ? {
                  content: previewText(r),
                  created_at: r.created_at,
                  from_me: r.sender_id === me,
              }
            : null,
        activity: r.created_at ? new Date(r.created_at).getTime() : 0,
    }));

    const matchConversations = matchRows.map((r) => ({
        type: "match",
        id: r.id,
        title: r.title || "Match",
        sport_type: r.sport_type ?? null,
        avatar: null,
        unread: r.unread ?? 0,
        last_message: r.created_at
            ? {
                  content: previewText(r),
                  created_at: r.created_at,
                  from_me: r.sender_id === me,
              }
            : null,
        // Message-less matches still show so a member can start the chat; fall
        // back to the event's own creation time so they sort sensibly.
        activity: r.created_at
            ? new Date(r.created_at).getTime()
            : r.event_created_at
              ? new Date(r.event_created_at).getTime()
              : 0,
    }));

    const conversations = [...dmConversations, ...matchConversations].sort(
        (a, b) => b.activity - a.activity
    );
    const total_unread = conversations.reduce((sum, c) => sum + (c.unread || 0), 0);

    return res
        .status(200)
        .json(new ApiResponse(200, `${conversations.length} conversations`, { conversations, total_unread }));
});

/**
 * GET /chat/dm/:user_id — DM thread with another user (last 50, oldest→newest),
 * plus that user's profile for the header. You cannot open a thread with yourself.
 */
export const getDmThread = asyncHandler(async (req, res) => {
    const me = req.user.id;
    const { user_id: other } = req.params;

    if (other === me) throw ApiError.fromCode(ERROR_CODES.SELF_MESSAGE_FORBIDDEN);

    const user = await pgClient.users.findUnique({
        where: { id: other },
        select: SENDER_SELECT,
    });
    if (!user) throw ApiError.fromCode(ERROR_CODES.USER_NOT_FOUND);

    const rows = await pgClient.messages.findMany({
        where: {
            event_id: null,
            OR: [
                { sender_id: me, recipient_id: other },
                { sender_id: other, recipient_id: me },
            ],
        },
        orderBy: { created_at: "desc" },
        take: HISTORY_LIMIT,
        include: DM_INCLUDE,
    });

    const messages = rows.reverse().map(toDmDto);
    return res
        .status(200)
        .json(new ApiResponse(200, `${messages.length} messages`, { user, messages }));
});

/**
 * POST /chat/dm/:user_id — send a DM (text and/or image). Blocks self-messaging.
 * Persists + pushes `dm:new` to BOTH participants' user rooms (multi-device).
 */
export const sendDm = asyncHandler(async (req, res) => {
    const me = req.user.id;
    const { user_id: other } = req.params;
    const content = (req.body?.content ?? "").toString().trim();
    const attachment_url = req.body?.attachment_url ?? null;
    const reply_to_id = req.body?.reply_to_id ?? null;

    // A player cannot message themselves.
    if (other === me) throw ApiError.fromCode(ERROR_CODES.SELF_MESSAGE_FORBIDDEN);

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

    const recipient = await pgClient.users.findUnique({
        where: { id: other },
        select: { id: true },
    });
    if (!recipient) throw ApiError.fromCode(ERROR_CODES.USER_NOT_FOUND);

    // A reply must point at a message in THIS same DM thread.
    if (reply_to_id) {
        const parent = await pgClient.messages.findUnique({
            where: { id: reply_to_id },
            select: { id: true, sender_id: true, recipient_id: true, event_id: true },
        });
        if (!parent || !inThread(parent, me, other)) {
            throw ApiError.fromCode(ERROR_CODES.MESSAGE_NOT_FOUND);
        }
    }

    const created = await pgClient.messages.create({
        data: {
            sender_id: me,
            recipient_id: other,
            content, // "" for an attachment-only message
            attachment_url: attachment_url || null,
            message_type: attachment_url ? "image" : "text",
            reply_to_id: reply_to_id || null,
        },
        include: DM_INCLUDE,
    });
    const dto = toDmDto(created);

    // Live delivery to the recipient AND the sender's other tabs/devices.
    emitToUser(other, "dm:new", dto);
    emitToUser(me, "dm:new", dto);

    logger.info(`dm sent: ${me} -> ${other} (${created.id})`);
    return res.status(201).json(new ApiResponse(201, "Message sent", dto));
});

/**
 * POST /chat/dm/:user_id/messages/:message_id/reactions — toggle an emoji reaction
 * on a DM. Only a participant of the thread may react. Pushes `dm:reaction`
 * { message_id, reactions } to both parties so their open threads update live.
 */
export const reactDm = asyncHandler(async (req, res) => {
    const me = req.user.id;
    const { user_id: other, message_id } = req.params;
    const emoji = (req.body?.emoji ?? "").toString().trim();

    if (other === me) throw ApiError.fromCode(ERROR_CODES.SELF_MESSAGE_FORBIDDEN);
    if (!emoji || emoji.length > MAX_EMOJI_LEN) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "Invalid emoji" });
    }

    // The message must exist AND belong to this DM thread (the caller must be a
    // participant) — otherwise you could react to strangers' messages by id.
    const message = await pgClient.messages.findUnique({
        where: { id: message_id },
        select: { id: true, sender_id: true, recipient_id: true, event_id: true, is_deleted: true },
    });
    if (!message || message.is_deleted || !inThread(message, me, other)) {
        throw ApiError.fromCode(ERROR_CODES.MESSAGE_NOT_FOUND);
    }

    // Toggle: remove if the caller already reacted with this emoji, else add.
    const existing = await pgClient.message_reactions.findFirst({
        where: { message_id, user_id: me, emoji },
        select: { id: true },
    });
    if (existing) {
        await pgClient.message_reactions.delete({ where: { id: existing.id } });
    } else {
        await pgClient.message_reactions.create({ data: { message_id, user_id: me, emoji } });
    }

    const rows = await pgClient.message_reactions.findMany({
        where: { message_id },
        select: { emoji: true, user_id: true },
    });
    const reactions = groupReactions(rows);

    const payload = { message_id, reactions };
    emitToUser(other, "dm:reaction", payload);
    emitToUser(me, "dm:reaction", payload);

    return res.status(200).json(new ApiResponse(200, "Reaction updated", payload));
});

/**
 * POST /chat/dm/:user_id/read — mark every message from :user_id to the caller as
 * read. Clears the thread's unread badge; notifies the caller's other devices.
 */
export const markDmRead = asyncHandler(async (req, res) => {
    const me = req.user.id;
    const { user_id: other } = req.params;

    if (other === me) throw ApiError.fromCode(ERROR_CODES.SELF_MESSAGE_FORBIDDEN);

    const { count } = await pgClient.messages.updateMany({
        where: { sender_id: other, recipient_id: me, event_id: null, is_read: false },
        data: { is_read: true, read_at: new Date() },
    });

    if (count > 0) emitToUser(me, "dm:read", { user_id: other });

    return res.status(200).json(new ApiResponse(200, "Marked read", { user_id: other, count }));
});
