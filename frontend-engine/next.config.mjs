/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === "production";

/**
 * Static security response headers.
 *
 * These are the headers whose value never changes per-request, so they belong
 * here rather than in middleware (next.config headers are applied by the Next
 * server itself and also cover paths middleware skips, e.g. `_next/static`).
 *
 * The one header NOT here is Content-Security-Policy — it carries a per-request
 * nonce and is therefore built in `src/middleware.js`.
 */
const securityHeaders = [
    // Stops the browser guessing a response's type from its bytes. Without it a
    // user-uploaded file served as text/plain can be sniffed into script and
    // executed (MIME confusion -> stored XSS).
    { key: "X-Content-Type-Options", value: "nosniff" },

    // Clickjacking. Legacy header for browsers that ignore CSP frame-ancestors;
    // keep BOTH — frame-ancestors 'none' in the CSP is the modern equivalent.
    // DENY (not SAMEORIGIN): nothing in FunTurf frames its own pages.
    { key: "X-Frame-Options", value: "DENY" },

    // Send the full URL only to ourselves; cross-origin gets the bare origin,
    // and http downgrades get nothing. Keeps venue/event/profile IDs and any
    // query params out of third-party Referer logs (imgbb, carto, nominatim).
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

    // Drop powerful browser APIs the app never uses, so injected code can't
    // reach them either. NOTE: `geolocation=(self)` is kept — the map/turf
    // discovery flows use it.
    {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=(), geolocation=(self), browsing-topics=()",
    },

    // Cross-origin isolation of our own resources: another site cannot embed or
    // read them directly.
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    { key: "X-DNS-Prefetch-Control", value: "on" },
];

// HSTS is production-only ON PURPOSE. Sent on localhost it would pin
// http://localhost to https for two years in the developer's browser and break
// every other local project on that port.
if (isProd) {
    securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
    });
}

const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
            {
                protocol: 'http',
                hostname: '**',
            },
        ],
    },

    async headers() {
        return [
            {
                // Every route, including static assets and API routes.
                source: "/:path*",
                headers: securityHeaders,
            },
        ];
    },
};

export default nextConfig;
