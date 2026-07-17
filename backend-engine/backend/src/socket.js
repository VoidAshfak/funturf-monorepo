import { Server } from "socket.io";
import { Redis } from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import jwt from "jsonwebtoken";
import { logger } from "../logs/logger.js";
import { allowedOrigins } from "./utils/corsOrigins.js";

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
 * Wire the Redis adapter onto an io instance, so multiple replicas behave as one.
 *
 * THE PROBLEM IT SOLVES: Socket.IO's connection registry is per-process. Run
 * three replicas and a socket held by app2 simply does not exist as far as app1
 * is concerned — so an `emitToUser()` triggered by a REST call that happened to
 * land on app1 is silently dropped for a user connected to app2. No error, no
 * log; the notification just never arrives. That bug is invisible on a single
 * process, which is exactly why the local cluster runs three.
 *
 * HOW IT SOLVES IT: the adapter relays every emit over Redis pub/sub, so all
 * replicas deliver to whichever sockets they personally hold.
 *
 * WHY TWO CLIENTS: a Redis connection in subscriber mode may not issue normal
 * commands, so the adapter needs a dedicated subscriber alongside the publisher.
 * `.duplicate()` clones the connection options rather than re-parsing the URL.
 *
 * WHY ioredis over node-redis: it re-establishes subscriptions automatically
 * after a reconnect. node-redis can silently come back without them — the
 * process looks healthy while cross-replica events quietly stop flowing.
 *
 * NOTE: this does NOT remove the need for nginx sticky sessions (see
 * ../../nginx/nginx.conf). The adapter fixes cross-replica delivery; stickiness
 * is what keeps a single client's HTTP long-polling handshake on one replica.
 * Both are required.
 *
 * Returns false (and leaves io on its default in-memory adapter) when REDIS_URL
 * is unset — the correct behaviour for host-side `npm run dev`, which is a single
 * process and needs no backplane.
 */
function attachRedisAdapter(io) {
    const url = process.env.REDIS_URL;

    if (!url) {
        // Not an error: single-process dev is a legitimate mode. Logged at warn
        // rather than info because if this shows up in a MULTI-replica
        // environment, real-time is broken in the subtle way described above.
        logger.warn(
            "REDIS_URL not set — Socket.IO running with the in-memory adapter. " +
            "Fine for single-process dev; cross-replica emits WILL be dropped if more than one instance is running."
        );
        return false;
    }

    // `lazyConnect: false` (the default) means ioredis dials immediately and
    // queues commands until it's up — so initSocket stays synchronous and the
    // server can start listening without awaiting Redis. A brief Redis outage
    // therefore delays events rather than crashing the process.
    const pubClient = new Redis(url, {
        // Keep retrying forever with a capped backoff. Default ioredis behaviour
        // gives up after 20 attempts; a backplane that permanently stops
        // reconnecting after a routine Redis restart would silently degrade the
        // whole cluster's real-time layer until someone redeploys.
        retryStrategy: (times) => Math.min(times * 200, 5000),
        maxRetriesPerRequest: null,
    });
    const subClient = pubClient.duplicate();

    // Redis being down must never take the API down with it: real-time is a
    // degradation, REST still works. Without these handlers an ioredis error
    // surfaces as an unhandled 'error' event and kills the process.
    pubClient.on("error", (err) => logger.error(`Redis (pub) error: ${err.message}`));
    subClient.on("error", (err) => logger.error(`Redis (sub) error: ${err.message}`));
    pubClient.on("ready", () => logger.info("Redis (pub) connected — Socket.IO backplane live"));

    io.adapter(createAdapter(pubClient, subClient));
    return true;
}

/**
 * Attach Socket.IO to the HTTP server, wire JWT auth, and connect the
 * multi-replica backplane.
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

    // Must happen before any connection is accepted, so no early emit bypasses
    // the backplane.
    const clustered = attachRedisAdapter(io);

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
        socket.on("event:subscribe", (eventId) => {
            if (typeof eventId === "string" && eventId) socket.join(eventRoom(eventId));
        });
        socket.on("event:unsubscribe", (eventId) => {
            if (typeof eventId === "string" && eventId) socket.leave(eventRoom(eventId));
        });

        socket.on("disconnect", (reason) => {
            logger.info(`socket disconnected: user=${userId} sid=${socket.id} (${reason})`);
        });
    });

    logger.info(
        `Socket.IO initialized (adapter: ${clustered ? "redis — multi-replica safe" : "in-memory — single process only"})`
    );
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
    io.to(userRoom(userId)).emit(event, payload);
}

/**
 * Emit to everyone subscribed to a match's event room (all current viewers).
 * Use ONLY for non-sensitive live updates (roster/request changes). Safe no-op
 * if the socket layer isn't up.
 */
export function emitToEvent(eventId, event, payload) {
    if (!io || !eventId) return;
    io.to(eventRoom(eventId)).emit(event, payload);
}
