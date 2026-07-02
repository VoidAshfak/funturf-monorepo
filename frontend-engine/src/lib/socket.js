import { io } from "socket.io-client";

// The REST base is like "http://localhost:8080/api/v1"; Socket.IO connects to the
// server ORIGIN (no /api/v1 path), so strip the trailing API segment.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const SOCKET_URL = API_BASE.replace(/\/api\/v1\/?$/, "");

// Process-wide singleton so every subscriber shares one connection.
let socket = null;
let currentToken = null;

/**
 * Get (or lazily create) the authenticated socket. Reuses the existing
 * connection while the token is unchanged; reconnects with fresh auth if the
 * token changes (e.g. after a re-login).
 */
export function getSocket(token) {
    if (!token) return null;

    if (socket && currentToken === token) return socket;

    // Token changed -> tear down the old connection before opening a new one.
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    currentToken = token;
    socket = io(SOCKET_URL, {
        auth: { token },
        transports: ["websocket"],
        autoConnect: true,
    });
    return socket;
}

/** Close and forget the socket (call on logout). */
export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
        currentToken = null;
    }
}
