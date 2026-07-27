import { logger } from "../../logs/logger.js";

// Single source of truth for which browser origins may talk to this API — used by
// both the REST layer (app.js) and Socket.IO (socket.js) so they never drift.
//
// Configure per-environment via the CORS_ORIGINS env var: a comma-separated list
// of allowed origins, e.g.
//   CORS_ORIGINS=http://localhost:3000,https://funturf-frontend.vercel.app
// If unset, we fall back to the known-good defaults below (local dev + the
// deployed Vercel frontend). We intentionally do NOT default to "*" anymore.
const DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "https://funturf-frontend.vercel.app",
];

// Parse the env list once at module load. Trim whitespace, drop empties, and
// strip any trailing slash so "https://x.com/" and "https://x.com" compare equal.
const parsed = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);

export const allowedOrigins = parsed.length > 0 ? parsed : DEFAULT_ORIGINS;

logger.info(`CORS allowed origins: ${allowedOrigins.join(", ")}`);

/**
 * Decide whether a request/handshake origin is allowed.
 *
 * A missing origin (server-to-server calls, NextAuth's server-side login POST,
 * curl, mobile apps) is allowed — browsers always send an Origin header on
 * cross-site requests, so the security boundary here is browser-only.
 */
export function isAllowedOrigin(origin) {
    if (!origin) return true; // non-browser / same-origin — no Origin header
    return allowedOrigins.includes(origin.replace(/\/+$/, ""));
}
