import {
    CalendarPlus,
    LayoutDashboard,
    LandPlot,
    Ticket,
    User,
    Users,
    ClipboardList,
    Shield,
} from "lucide-react";

// Single source of truth for the signed-in user's account menu.
//
// Both the desktop dropdown (ProfileMenu) and the mobile drawer
// (NavLinksForSmallScreen) render from this, so the two can never drift apart.
//
// RULE: every entry here MUST point at a route that actually exists in
// src/app. No "#" placeholders — a menu item that goes nowhere is a bug.

// Roles allowed into /dashboard. `dashboard/layout.js` redirects everyone else,
// so showing these links to a player would just bounce them back to "/".
const ADMIN_ROLES = ["turf_admin", "super_admin"];

const ROLE_LABELS = {
    player: "Player",
    turf_admin: "Turf owner",
    super_admin: "Admin",
};

export const roleLabel = (userType) => ROLE_LABELS[userType] ?? "Player";

export const isAdminRole = (userType) => ADMIN_ROLES.includes(userType);

// "Touhid Rahman" -> "TR". Falls back to the username, then "?" — never throws
// on a user whose name fields the backend left null.
export function userInitials(user) {
    const first = user?.first_name?.trim?.() ?? "";
    const last = user?.last_name?.trim?.() ?? "";
    const initials = `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
    if (initials) return initials;
    return (user?.username?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();
}

export function displayName(user) {
    const full = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
    return full || user?.username || user?.email || "Player";
}

/**
 * Menu sections for a session user, filtered by role.
 * @returns {Array<{ id: string, label?: string, items: Array<{ href, label, icon }> }>}
 */
export function getProfileMenuSections(user) {
    const sections = [
        {
            id: "account",
            items: [
                { href: `/profile/${user?.id}`, label: "My profile", icon: User },
                { href: "/bookings", label: "My bookings", icon: Ticket },
                { href: "/turfmates", label: "Turfmates", icon: Users },
                { href: "/teams", label: "My teams", icon: Shield },
            ],
        },
        {
            id: "play",
            items: [
                { href: "/events/create", label: "Host a match", icon: CalendarPlus },
            ],
        },
    ];

    if (isAdminRole(user?.user_type)) {
        sections.push({
            id: "manage",
            label: "Manage",
            items: [
                { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
                { href: "/dashboard/turfs", label: "My turfs", icon: LandPlot },
                { href: "/dashboard/bookings", label: "Turf bookings", icon: ClipboardList },
            ],
        });
    }

    return sections;
}
