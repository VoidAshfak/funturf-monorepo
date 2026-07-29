import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

/**
 * Edge middleware — does two unrelated jobs on every page request:
 *
 *  1. Content-Security-Policy (below). Built per-request because it carries a
 *     fresh nonce. Applied to EVERY matched response, including redirects.
 *  2. Role-based route gating (further down).
 *
 * The static security headers (nosniff, X-Frame-Options, Referrer-Policy,
 * HSTS, Permissions-Policy) live in `next.config.mjs` — they never vary, and
 * putting them there also covers paths this middleware skips.
 */

/* ------------------------------------------------------------------ *
 *  1. Content-Security-Policy
 * ------------------------------------------------------------------ */

const isDev = process.env.NODE_ENV !== "production";

// Backend origin (REST + Socket.IO). NEXT_PUBLIC_* is inlined at build time, so
// this resolves inside the edge runtime. Falls back to the local dev API.
const API_ORIGIN = (() => {
    try {
        return new URL(
            process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api/v1"
        ).origin;
    } catch {
        return "http://localhost:8080";
    }
})();

// Socket.IO opens a WebSocket to the same origin — ws:// locally, wss:// in prod.
const API_WS_ORIGIN = API_ORIGIN.replace(/^http/, "ws");

/**
 * Every third-party origin the browser is allowed to talk to, derived from
 * actual usage in the codebase. Adding a new external service means adding it
 * here, or the browser will silently block it.
 */
const TILE_HOSTS = [
    "https://*.basemaps.cartocdn.com", // CityPulseMap + EventMap base layer
    "https://*.tile.openstreetmap.org", // MapPicker base layer
    "https://unpkg.com", // Leaflet default marker icon PNGs
];
const GEOCODE_HOSTS = ["https://nominatim.openstreetmap.org"]; // EventMap reverse geocode

/** Build the CSP string for one request, binding it to `nonce`. */
function buildCsp(nonce) {
    const directives = [
        `default-src 'self'`,

        // 'strict-dynamic' means: trust scripts loaded BY an already-trusted
        // (nonced) script, and ignore host allowlists. That is what makes Next's
        // chunk loading work under a nonce CSP without allowlisting anything.
        // 'unsafe-eval' is dev-only — Turbopack/react-refresh need it; shipping
        // it to production would hand an attacker eval() back.
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,

        // WHY script-src-elem is split out (and drops 'strict-dynamic'):
        // Next 15.5 emits ONE shared framework chunk per page — the next/link
        // internals bundle — as a <script src> WITHOUT the nonce it stamps on
        // every other tag. Under 'strict-dynamic' host allowlists are ignored,
        // so that chunk is blocked and next/link navigation degrades.
        // This directive governs script ELEMENTS only: same-origin `.js` files
        // load by host, while INLINE script still needs the nonce — which is the
        // property that actually stops injected-markup XSS. 'strict-dynamic'
        // stays on `script-src` above for every non-element script context.
        // Nothing user-uploaded is ever served from this origin (uploads go to
        // imgbb), so allowlisting 'self' scripts adds no practical gadget.
        // REMOVE this line once Next nonces that chunk — then re-test /venues
        // for CSP errors in the console.
        `script-src-elem 'self' 'nonce-${nonce}'`,

        // WHY 'unsafe-inline' here and nowhere else: this project animates with
        // GSAP + framer-motion and uses Radix and Leaflet, all of which write
        // inline `style="..."` attributes at runtime. A nonce cannot cover a
        // style ATTRIBUTE, and dropping 'unsafe-inline' would break every
        // animation and popover on the site. Inline CSS is a far weaker vector
        // than inline JS, which stays locked down above.
        `style-src 'self' 'unsafe-inline'`,
        `style-src-attr 'unsafe-inline'`,

        // Venue/event/profile images come from imgbb, Cloudinary and arbitrary
        // backend-supplied hosts, so the image source cannot be enumerated.
        // `blob:`/`data:` cover the crop-preview and QR flows.
        `img-src 'self' blob: data: https:${isDev ? " http:" : ""} ${TILE_HOSTS.join(" ")}`,

        `font-src 'self' data:`,

        // XHR/fetch/WebSocket targets: our own routes, the API, and geocoding.
        `connect-src 'self' ${API_ORIGIN} ${API_WS_ORIGIN} ${GEOCODE_HOSTS.join(" ")} ${TILE_HOSTS.join(" ")}${isDev ? " ws://localhost:* http://localhost:*" : ""}`,

        // html5-qrcode decodes in a worker created from a blob.
        `worker-src 'self' blob:`,

        `media-src 'self' blob: data:`,
        `manifest-src 'self'`,

        // No Flash/Java-style plugins, ever.
        `object-src 'none'`,

        // Nothing may be framed by us or frame us.
        `frame-src 'none'`,
        `frame-ancestors 'none'`,

        // Stops injected markup from repointing relative URLs (<base href>) or
        // posting the login form to an attacker's server.
        `base-uri 'self'`,
        `form-action 'self'`,
    ];

    // Rewrite any stray http:// subresource to https. Prod only — it would break
    // the local http backend during development.
    if (!isDev) directives.push("upgrade-insecure-requests");

    return directives.join("; ");
}

/* ------------------------------------------------------------------ *
 *  2. Role-based route gating
 * ------------------------------------------------------------------ */

/**
 *  - turf_admin : dashboard-only. Any feed/root path is redirected to /dashboard,
 *                 so a turf owner never sees the public feed. (The dashboard layout
 *                 additionally forces the turf-creation onboarding when they have
 *                 no venue yet.)
 *  - player     : cannot enter /dashboard or /onboarding -> sent back to the feed.
 *  - super_admin: platform moderator (approve turfs, ban players, restrict events) —
 *                 unrestricted; may use both the feed and the dashboard.
 *  - unauth     : /dashboard and /onboarding require login.
 *
 * Reads the NextAuth JWT directly (no API call). Requires NEXTAUTH_SECRET.
 */

const ADMIN_AREA_PREFIXES = ["/dashboard", "/onboarding"];

// Auth pages must stay reachable for every role during onboarding. They used to
// be excluded from the matcher entirely; they are matched now ONLY so they get a
// CSP, so gating is skipped for them explicitly to preserve the old behaviour.
const GATING_EXEMPT_PREFIXES = ["/login", "/signup"];

const hasPrefix = (pathname, prefixes) =>
    prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** Decide the redirect (if any) for this request. Returns null to let it pass. */
function gate(req, token, pathname) {
    const role = token?.user_type;
    const inAdminArea = hasPrefix(pathname, ADMIN_AREA_PREFIXES);

    // Not logged in — protect the admin area only.
    if (!token) return inAdminArea ? "/login" : null;

    // Turf owner: locked to the dashboard/onboarding area.
    if (role === "turf_admin") return inAdminArea ? null : "/dashboard";

    // Player: no access to the admin area.
    if (role === "player") return inAdminArea ? "/" : null;

    // super_admin (and any other authenticated role): unrestricted.
    return null;
}

export async function middleware(req) {
    const { pathname } = req.nextUrl;

    // One nonce per request. Reused by Next for its own <script> tags — it picks
    // it up from the Content-Security-Policy header we set on the REQUEST below.
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const csp = buildCsp(nonce);

    /** Attach the CSP to any outgoing response so redirects are covered too. */
    const withCsp = (res) => {
        res.headers.set("Content-Security-Policy", csp);
        return res;
    };

    if (!hasPrefix(pathname, GATING_EXEMPT_PREFIXES)) {
        const token = await getToken({
            req,
            secret: process.env.NEXTAUTH_SECRET,
        });
        const redirectPath = gate(req, token, pathname);

        if (redirectPath) {
            const url = req.nextUrl.clone();
            url.pathname = redirectPath;
            return withCsp(NextResponse.redirect(url));
        }
    }

    // Forward the nonce to the app: `x-nonce` for any component that needs to
    // nonce its own inline script, and the CSP header itself, which is how Next
    // discovers the nonce for the scripts it injects.
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);

    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
}

export const config = {
    // Everything except API routes, Next internals and static assets. Auth pages
    // ARE matched (they need a CSP) but are exempt from gating — see above.
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|assets).*)",
    ],
};
