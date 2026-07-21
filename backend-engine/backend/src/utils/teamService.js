import { pgClient } from "../prisma.js";
import { createNotification } from "./notificationService.js";
import { ApiError } from "./apiError.js";
import { ERROR_CODES } from "./errorCodes.js";

/**
 * Team helpers.
 *
 * A "team" is a PERSISTENT squad — the durable counterpart to a single match's
 * roster. Authority inside it is three-tiered:
 *
 *   captain     — one per team, mirrored on `teams.captain_id`. Can do everything:
 *                 edit, delete, promote, assign positions, remove members, and
 *                 hand the captaincy over. Cannot remove themself (see below).
 *   co_captain  — recruitment only: send and cancel invites.
 *   member      — on the roster; may leave, nothing more.
 *
 * Every authorization check for teams lives HERE rather than being re-derived in
 * each controller, so "who may do what" can never drift between endpoints (DRY).
 * Controllers stay thin: they call a `require*` helper and let it throw.
 *
 * Note on membership: only `status: "active"` counts. `left`/`removed` rows are
 * kept for history and must never satisfy an authorization check.
 */

/** Public-safe subset of a user we return inside a roster. */
export const TEAM_USER_SELECT = {
    id: true,
    first_name: true,
    last_name: true,
    profile_picture_url: true,
    division: true,
    district: true,
    bio: true,
};

/**
 * A roster row with everything the UI needs in ONE query: the player, their
 * position, and their form (rating / reliability). Joining `player_profiles`
 * here is deliberate — the frontend must not N+1 a profile fetch per member.
 *
 * `player_profiles` is a to-many relation on `users`, but a user has at most one
 * profile row in practice, so we take the first.
 */
export const TEAM_MEMBER_INCLUDE = {
    users: {
        select: {
            ...TEAM_USER_SELECT,
            player_profiles: {
                select: {
                    rating: true,
                    reliability_score: true,
                    skill_level: true,
                    preferred_foot: true,
                    jersey_number: true,
                },
                take: 1,
            },
        },
    },
    sport_positions: {
        select: { id: true, position_name: true, position_code: true },
    },
};

/** Build a display name from a user row, with a safe fallback. */
export const displayName = (user, fallback = "A player") =>
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") || fallback;

/** Parse `page`/`limit` query with the same clamps every list endpoint uses. */
export const parsePaging = (query) => {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 50);
    return { page, limit, skip: (page - 1) * limit };
};

/**
 * Flatten a `team_members` row into the DTO the frontend renders. Lifts the
 * single player profile out of its array so clients never index into it.
 */
export function serializeMember(row) {
    const { player_profiles, ...user } = row.users ?? {};
    return {
        membershipId: row.id,
        role: row.role,
        status: row.status,
        joined_at: row.joined_at,
        left_at: row.left_at,
        position: row.sport_positions ?? null,
        user: { ...user, profile: player_profiles?.[0] ?? null },
    };
}

/**
 * Load a team or throw. Soft-deleted teams (`is_active: false`) are treated as
 * gone for every write path; pass `{ includeInactive: true }` only where reading
 * history legitimately needs them.
 *
 * @param {string} teamId
 * @param {{ includeInactive?: boolean }} [opts]
 * @returns {Promise<Object>} the team row
 * @throws {ApiError} TEAM_NOT_FOUND
 */
export async function requireTeam(teamId, { includeInactive = false } = {}) {
    const team = await pgClient.teams.findUnique({ where: { id: teamId } });
    if (!team || (!includeInactive && team.is_active === false)) {
        throw ApiError.fromCode(ERROR_CODES.TEAM_NOT_FOUND);
    }
    return team;
}

/**
 * This user's ACTIVE membership row, or null. The single source of truth for
 * "is this person on the team right now".
 */
export async function getActiveMembership(teamId, userId) {
    if (!teamId || !userId) return null;
    return pgClient.team_members.findFirst({
        where: { team_id: teamId, user_id: userId, status: "active" },
    });
}

/**
 * Assert the caller is on the roster (any role). Used for reads that are private
 * to the squad and for tagging an event with a team.
 *
 * @throws {ApiError} NOT_TEAM_MEMBER
 */
export async function requireActiveMembership(teamId, userId) {
    const membership = await getActiveMembership(teamId, userId);
    if (!membership) throw ApiError.fromCode(ERROR_CODES.NOT_TEAM_MEMBER);
    return membership;
}

/**
 * Assert the caller is THE captain of an already-loaded team.
 * Checked against `teams.captain_id` (not the member row) because that column is
 * what transfer-captaincy moves — it is the authoritative pointer.
 *
 * @throws {ApiError} NOT_TEAM_CAPTAIN
 */
export function requireCaptain(team, userId) {
    if (team.captain_id !== userId) throw ApiError.fromCode(ERROR_CODES.NOT_TEAM_CAPTAIN);
}

/**
 * Assert the caller may recruit — captain or co-captain. Recruitment is the one
 * power delegated below the captain, so invite endpoints use this instead of
 * `requireCaptain`.
 *
 * @throws {ApiError} NOT_TEAM_CAPTAIN
 */
export async function requireCaptainOrCoCaptain(team, userId) {
    if (team.captain_id === userId) return null;
    const membership = await getActiveMembership(team.id, userId);
    if (!membership || membership.role !== "co_captain") {
        throw ApiError.fromCode(ERROR_CODES.NOT_TEAM_CAPTAIN, {
            message: "Only the captain or a co-captain can do this",
        });
    }
    return membership;
}

/**
 * User ids of everyone who runs the team: the captain plus active co-captains.
 * De-duped, so a captain who also holds a `captain` member row is counted once.
 */
export async function getTeamLeadershipIds(team) {
    const coCaptains = await pgClient.team_members.findMany({
        where: { team_id: team.id, role: "co_captain", status: "active" },
        select: { user_id: true },
    });
    return [...new Set([team.captain_id, ...coCaptains.map((m) => m.user_id)])];
}

/**
 * Notify the team's leadership (captain + co-captains), optionally skipping one
 * user — normally the person who triggered the event, who doesn't need telling.
 *
 * Best-effort by construction: `createNotification` never throws, so a delivery
 * problem can't roll back the business action that caused it.
 */
export async function notifyTeamLeadership(team, payload, { exceptUserId } = {}) {
    const recipients = (await getTeamLeadershipIds(team)).filter((id) => id !== exceptUserId);
    await Promise.all(recipients.map((user_id) => createNotification({ ...payload, user_id })));
}
