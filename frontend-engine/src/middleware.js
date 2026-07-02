import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

/**
 * Role-based route gating.
 *
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

const isAdminArea = (pathname) =>
    ADMIN_AREA_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`)
    );

export async function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const role = token?.user_type;
    const inAdminArea = isAdminArea(pathname);

    const redirectTo = (path) => {
        const url = req.nextUrl.clone();
        url.pathname = path;
        return NextResponse.redirect(url);
    };

    // Not logged in — protect the admin area only.
    if (!token) {
        return inAdminArea ? redirectTo("/login") : NextResponse.next();
    }

    // Turf owner: locked to the dashboard/onboarding area.
    if (role === "turf_admin") {
        return inAdminArea ? NextResponse.next() : redirectTo("/dashboard");
    }

    // Player: no access to the admin area.
    if (role === "player") {
        return inAdminArea ? redirectTo("/") : NextResponse.next();
    }

    // super_admin (and any other authenticated role): unrestricted.
    return NextResponse.next();
}

export const config = {
    // Run on everything except API routes, Next internals, static assets, and
    // the auth pages (login/signup must stay reachable during onboarding).
    matcher: [
        "/((?!api|_next/static|_next/image|favicon.ico|assets|login|signup).*)",
    ],
};
