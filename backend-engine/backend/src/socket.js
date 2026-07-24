import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { logger } from "../logs/logger.js";
import { allowedOrigins } from "./utils/corsOrigins.js";
import { maskDeep, toInternalId } from "./utils/publicId.js";

// Single Socket.IO server instance for the process. Held in module scope so
// controllers/services can `emitToUser` without threading `io` through every call.
let io = null;

// Room naming: every authenticated socket joins a private room keyed by user id,
// so we can push a notification to *all* of a user's open tabs/devices at once.
const userRoom = (userId) => `user:${userId}`;

// Event rooms carry NON-SENSITIVE live updates for a match page (roster changes,
// join-request counts) to everyone currently viewing it. Private data (chat
// messages) is NOT sent here — it goes to member user-rooms via emitToUser.
const eventRoom = (eventId) => `event:${eventId}`;

/**
 * Attach Socket.IO to the HTTP server and wire JWT auth.
 *
 * NOTE (production / multi-replica): this keeps connection state in-process. The
 * deploy runs 3 replicas behind nginx, so for real-time to work across replicas
 * you must add nginx sticky sessions (ip_hash) + a Redis adapter
 * (`@socket.io/redis-adapter`). Single-process dev works as-is.
 */
export function initSocket(server) {
    io = new Server(server, {
        // Same whitelist as the REST layer (utils/corsOrigins.js) so the two
        // never drift. credentials:true matches app.js.
        cors: {
            origin: allowedOrigins,
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    // Handshake auth: the client sends its access token in `auth.token`.
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error("MISSING_TOKEN"));

            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
            if (!decoded?.id) return next(new Error("INVALID_TOKEN"));

            // stash the authenticated identity on the socket for later handlers
            socket.user = decoded;
            return next();
        } catch (err) {
            return next(new Error("INVALID_TOKEN"));
        }
    });

    io.on("connection", (socket) => {
        const { id: userId } = socket.user;
        socket.join(userRoom(userId));
        logger.info(`socket connected: user=${userId} sid=${socket.id}`);

        // A client viewing a match page subscribes to that event's room to get
        // live roster/request updates. Only non-sensitive data flows here (see
        // eventRoom note), so plain membership of the room needs no extra auth.
        // The client only ever holds the masked event id (that is all the REST
        // layer hands out), so translate before deriving the room name — rooms are
        // keyed by the internal UUID, matching what controllers pass to emitToEvent.
        socket.on("event:subscribe", (eventId) => {
            if (typeof eventId === "string" && eventId) {
                socket.join(eventRoom(toInternalId(eventId)));
            }
        });
        socket.on("event:unsubscribe", (eventId) => {
            if (typeof eventId === "string" && eventId) {
                socket.leave(eventRoom(toInternalId(eventId)));
            }
        });

        socket.on("disconnect", (reason) => {
            logger.info(`socket disconnected: user=${userId} sid=${socket.id} (${reason})`);
        });
    });

    logger.info("Socket.IO initialized");
    return io;
}

/** Accessor for the initialized io instance (throws if used before initSocket). */
export function getIo() {
    if (!io) throw new Error("Socket.IO not initialized — call initSocket(server) first");
    return io;
}

/**
 * Emit an event to every socket a given user has open. Safe no-op if the socket
 * layer isn't up yet (e.g. a unit context), so callers never need to guard.
 */
export function emitToUser(userId, event, payload) {
    if (!io || !userId) return;
    // Real-time payloads never pass through res.json, so they need the same
    // masking applied explicitly — otherwise a notification would hand the client
    // the raw UUIDs that the REST layer just went to the trouble of hiding.
    io.to(userRoom(userId)).emit(event, maskDeep(payload));
}

/**
 * Emit to everyone subscribed to a match's event room (all current viewers).
 * Use ONLY for non-sensitive live updates (roster/request changes). Safe no-op
 * if the socket layer isn't up.
 */
export function emitToEvent(eventId, event, payload) {
    if (!io || !eventId) return;
    // Callers pass the internal UUID (rooms are keyed on it); the payload still
    // gets masked, same reasoning as emitToUser.
    io.to(eventRoom(eventId)).emit(event, maskDeep(payload));
}
