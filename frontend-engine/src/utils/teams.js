/**
 * Shared team display helpers.
 *
 * Kept here (not duplicated per component) so the roster, the team cards and the
 * event-creation selector all label a role the same way.
 *
 * Role names mirror the backend `team_member_role` enum — see
 * `backend-engine/backend/src/utils/teamService.js` for what each one may do.
 * These labels are cosmetic: authorization is always enforced server-side.
 */

export const ROLE_LABEL = {
    captain: "Captain",
    co_captain: "Co-captain",
    member: "Member",
};

/** Roles allowed to recruit — used only to decide whether to SHOW invite controls. */
export const CAN_INVITE_ROLES = ["captain", "co_captain"];

/** "Gulshan United" -> "GU". Falls back to "?" so a crest never renders empty. */
export function teamInitials(name = "") {
    return (
        name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word[0])
            .join("")
            .toUpperCase() || "?"
    );
}

/** Full name of a user row, with a safe fallback. */
export const playerName = (user) =>
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Player";

/** "Touhid Rahman" -> "TR", for avatar fallbacks. */
export function playerInitials(name = "") {
    return (
        name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word[0])
            .join("")
            .toUpperCase() || "?"
    );
}
