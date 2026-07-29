import helmet from "helmet";

/**
 * Security response headers for the API.
 *
 * Two separate helmet configurations live here because the service serves two
 * very different kinds of response:
 *
 *  - `apiSecurityHeaders`  — the REST API and `public/` static files. These are
 *    JSON and images; nothing is ever an HTML document, so the CSP can be
 *    maximally strict ("this response may load nothing at all").
 *  - `docsSecurityHeaders` — Swagger UI, which IS an HTML document and ships
 *    inline styles/scripts. It gets its own, relaxed policy scoped to the docs
 *    route only, so relaxing it never leaks onto the API surface.
 *
 * The frontend has its own headers (see `frontend-engine/next.config.mjs` and
 * `frontend-engine/src/middleware.js`) — these ones protect the API's own
 * responses, which an attacker can also navigate a victim's browser to.
 */

// HSTS is production-only ON PURPOSE. On http://localhost it would pin the
// developer's browser to https for that host:port for two years and break every
// other local project served there. Render terminates TLS in front of us in prod.
const isProd = process.env.NODE_ENV === "production";

const hstsOptions = {
    maxAge: 63072000, // 2 years — the value required for preload-list eligibility
    includeSubDomains: true,
    preload: true,
};

/**
 * Headers for every API response.
 *
 * Mount this FIRST in `app.js`, before CORS and routes, so error responses and
 * 404s carry the headers too.
 */
export const apiSecurityHeaders = helmet({
    // The API never returns HTML, so nothing legitimately loads a subresource
    // from one of its responses. Locking everything to 'none' means that if a
    // JSON response is ever rendered as a document (content sniffing, a browser
    // navigating straight to an endpoint, a reflected payload), it can neither
    // execute script nor phone home.
    contentSecurityPolicy: {
        useDefaults: false,
        directives: {
            "default-src": ["'none'"],
            "script-src": ["'none'"],
            "style-src": ["'none'"],
            "img-src": ["'none'"],
            "connect-src": ["'none'"],
            "base-uri": ["'none'"],
            "form-action": ["'none'"],
            "frame-ancestors": ["'none'"], // modern clickjacking defence
            "sandbox": [],
        },
    },

    // Stops MIME sniffing: an uploaded file echoed back cannot be re-typed by
    // the browser into an executable script.
    noSniff: true,

    // Legacy clickjacking header for browsers that ignore frame-ancestors.
    // DENY, not SAMEORIGIN — no API response is ever meant to be framed.
    frameguard: { action: "deny" },

    // Never leak an API URL (which can carry ids) in the Referer of an outbound
    // request. The API has no UI, so there is nothing to lose by sending none.
    referrerPolicy: { policy: "no-referrer" },

    strictTransportSecurity: isProd ? hstsOptions : false,

    // `public/` assets are fetched by the frontend, which is a DIFFERENT origin
    // (Vercel vs Render). helmet's default `same-origin` would block them.
    // Cross-origin READS of public images are the intended behaviour; anything
    // sensitive is behind `verifyJWT`, never in `public/`.
    crossOriginResourcePolicy: { policy: "cross-origin" },

    // Also relaxed for the same cross-origin reason: `same-origin` here would
    // sever the window relationship the OAuth-style popup flows may rely on.
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },

    // Hide the "Express" fingerprint. Cheap, and one less version to match
    // against a CVE list.
    hidePoweredBy: true,
});

/**
 * Relaxed headers for Swagger UI only.
 *
 * swagger-ui-express injects inline <style> and an inline bootstrap <script>,
 * neither of which is nonce-able through that package — so this policy allows
 * inline script/style but ONLY on the docs route, and still forbids framing,
 * plugins and any outbound connection beyond our own origin.
 *
 * Remember the docs are off in production unless `DOCS_ENABLED=true`
 * (see `utils/swagger.js`), so in a default prod deploy this never applies.
 */
export const docsSecurityHeaders = helmet({
    contentSecurityPolicy: {
        useDefaults: false,
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "img-src": ["'self'", "data:", "https:"],
            "font-src": ["'self'", "data:"],
            "connect-src": ["'self'"], // "Try it out" calls this same origin
            "object-src": ["'none'"],
            "base-uri": ["'self'"],
            "form-action": ["'self'"],
            "frame-ancestors": ["'none'"],
        },
    },
    noSniff: true,
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "no-referrer" },
    strictTransportSecurity: isProd ? hstsOptions : false,
    crossOriginResourcePolicy: { policy: "same-origin" },
    hidePoweredBy: true,
});
