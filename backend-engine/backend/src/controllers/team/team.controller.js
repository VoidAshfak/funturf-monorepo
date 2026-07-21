import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";
import { pgClient } from "../../prisma.js";
import { createNotification } from "../../utils/notificationService.js";
import { logger } from "../../../logs/logger.js";
import userCache from "../../utils/cache.js";
import { isUuid } from "../../middlewares/validateUuid.middleware.js";
import {
    TEAM_USER_SELECT,
    TEAM_MEMBER_INCLUDE,
    displayName,
    parsePaging,
    serializeMember,
    requireTeam,
    getActiveMembership,
    requireActiveMembership,
    requireCaptain,
    requireCaptainOrCoCaptain,
    notifyTeamLeadership,
} from "../../utils/teamService.js";

/**
 * Teams — persistent squads.
 *
 * Today a "squad" only exists as one match's approved roster. A team makes that
 * durable: a named group with roles and positions that can organize matches
 * (`events.team_id`) over and over. Teams are strictly ADDITIVE — ad-hoc,
 * teamless matches keep working exactly as they always did.
 *
 * Every route here is mounted behind `verifyJWT`, so `req.user.id` is always set.
 * Authorization (captain / co-captain / member) is enforced server-side on every
 * write via the helpers in `utils/teamService.js` — the frontend's captain-only
 * UI gating is a courtesy, never the boundary.
 *
 * Deletions are soft throughout: a team is deactivated, a membership flips to
 * `left`/`removed`. Past matches must stay readable.
 */

// Team fields a captain is allowed to edit in place. `captain_id` is excluded on
// purpose — it moves only through transfer-captaincy, which also has to fix up
// the two member rows. `sport_id` is handled separately (see updateTeam).
const EDITABLE_TEAM_FIELDS = ["name", "home_area", "crest_url", "description"];

// The team shape every endpoint returns, so a team looks the same everywhere.
const TEAM_INCLUDE = {
    sports: { select: { id: true, name: true, category: true, icon_url: true } },
    captain: { select: TEAM_USER_SELECT },
};

/** Trim a string body field; returns undefined when it wasn't supplied at all. */
const cleanString = (value) =>
    value === undefined ? undefined : typeof value === "string" ? value.trim() : value;

/**
 * Count the team's active roster and how many members hold a position. Used to
 * decide whether the sport can still be changed (it can't once anyone else has
 * joined — swapping sports would leave positions pointing at the wrong sport).
 */
async function getRosterFootprint(teamId) {
    const [activeCount, positionedCount] = await Promise.all([
        pgClient.team_members.count({ where: { team_id: teamId, status: "active" } }),
        pgClient.team_members.count({
            where: { team_id: teamId, status: "active", position_id: { not: null } },
        }),
    ]);
    return { activeCount, positionedCount };
}

// ---------------------------------------------------------------------------
// Sports catalogue
// ---------------------------------------------------------------------------

/**
 * GET /teams/sports
 *
 * `teams.sport_id` and `team_members.position_id` are UUID foreign keys, so the
 * create-team form and the position picker need the real rows — there is no
 * other endpoint that exposes them. Reference data that almost never changes, so
 * it's cached (see utils/cache.js) rather than re-queried on every form open.
 */
const getSportsCatalogue = asyncHandler(async (req, res) => {
    const CACHE_KEY = "teams:sports-catalogue";

    const cached = userCache.get(CACHE_KEY);
    if (cached) {
        return res.status(200).json(new ApiResponse(200, "Sports catalogue", cached));
    }

    const sports = await pgClient.sports.findMany({
        where: { is_active: true },
        select: {
            id: true,
            name: true,
            category: true,
            icon_url: true,
            team_size_min: true,
            team_size_max: true,
            sport_positions: {
                select: { id: true, position_name: true, position_code: true },
                orderBy: { position_name: "asc" },
            },
        },
        orderBy: { name: "asc" },
    });

    const data = { sports };
    userCache.set(CACHE_KEY, data);
    return res.status(200).json(new ApiResponse(200, "Sports catalogue", data));
});

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

/**
 * POST /teams — create a team. The creator becomes its captain.
 *
 * The team row and the captain's roster row are written in ONE transaction: a
 * team whose captain isn't on its own roster would break every membership check
 * downstream, so the two must land together or not at all.
 */
const createTeam = asyncHandler(async (req, res) => {
    const captainId = req.user.id;
    const name = cleanString(req.body?.name);
    const { sport_id } = req.body;
    const home_area = cleanString(req.body?.home_area);
    const crest_url = cleanString(req.body?.crest_url);
    const description = cleanString(req.body?.description);

    if (!name || !sport_id) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "name and sport_id are required",
        });
    }
    // Screen ids before Prisma sees them — a malformed uuid raises P2023, which
    // would surface as a 500 rather than the 400 this plainly is.
    if (!isUuid(sport_id)) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "sport_id must be a valid id" });
    }
    if (name.length > 100) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "Team name cannot be longer than 100 characters",
        });
    }

    // Fail before the transaction rather than surfacing a raw FK violation.
    const sport = await pgClient.sports.findUnique({ where: { id: sport_id }, select: { id: true } });
    if (!sport) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "Unknown sport_id" });
    }

    const team = await pgClient.$transaction(async (tx) => {
        const created = await tx.teams.create({
            data: {
                name,
                sport_id,
                captain_id: captainId,
                home_area: home_area ?? null,
                crest_url: crest_url ?? null,
                description: description ?? null,
            },
            include: TEAM_INCLUDE,
        });

        await tx.team_members.create({
            data: { team_id: created.id, user_id: captainId, role: "captain", status: "active" },
        });

        return created;
    });

    logger.info(`team created: ${team.id} captain=${captainId} sport=${sport_id}`);
    return res
        .status(201)
        .json(new ApiResponse(201, "Team created", { ...team, my_role: "captain" }));
});

/**
 * GET /teams/:teamId — team detail with its active roster.
 *
 * Readable by any signed-in user (teams are discoverable), but the payload
 * carries `my_role` so the client knows which controls to show. `my_role` is
 * null for a non-member — and the server still re-checks on every write.
 */
const getTeamById = asyncHandler(async (req, res) => {
    const { teamId } = req.params;

    const team = await pgClient.teams.findUnique({
        where: { id: teamId },
        include: {
            ...TEAM_INCLUDE,
            team_members: {
                where: { status: "active" },
                include: TEAM_MEMBER_INCLUDE,
                // Captain first, then co-captains, then the rest by seniority.
                orderBy: [{ role: "asc" }, { joined_at: "asc" }],
            },
        },
    });
    if (!team) throw ApiError.fromCode(ERROR_CODES.TEAM_NOT_FOUND);

    const { team_members, ...rest } = team;
    const myMembership = team_members.find((m) => m.user_id === req.user.id) ?? null;

    return res.status(200).json(
        new ApiResponse(200, "Team detail", {
            ...rest,
            members: team_members.map(serializeMember),
            member_count: team_members.length,
            my_role: myMembership?.role ?? null,
        })
    );
});

/**
 * PATCH /teams/:teamId — captain-only partial edit.
 *
 * `sport_id` is only changeable while the captain is still alone on the roster
 * and nobody holds a position: swapping sports afterwards would leave every
 * `position_id` pointing at another sport's positions.
 */
const updateTeam = asyncHandler(async (req, res) => {
    const { teamId } = req.params;
    const team = await requireTeam(teamId);
    requireCaptain(team, req.user.id);

    const data = {};
    for (const field of EDITABLE_TEAM_FIELDS) {
        const value = cleanString(req.body?.[field]);
        if (value !== undefined) data[field] = value === "" ? null : value;
    }

    if (data.name === null) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "Team name cannot be empty" });
    }
    if (typeof data.name === "string" && data.name.length > 100) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "Team name cannot be longer than 100 characters",
        });
    }

    if (req.body?.sport_id !== undefined && req.body.sport_id !== team.sport_id) {
        if (!isUuid(req.body.sport_id)) {
            throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
                message: "sport_id must be a valid id",
            });
        }
        const { activeCount, positionedCount } = await getRosterFootprint(teamId);
        if (activeCount > 1 || positionedCount > 0) {
            throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
                message:
                    "The sport can't be changed once the team has members — position assignments belong to the current sport",
            });
        }
        const sport = await pgClient.sports.findUnique({
            where: { id: req.body.sport_id },
            select: { id: true },
        });
        if (!sport) {
            throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "Unknown sport_id" });
        }
        data.sport_id = req.body.sport_id;
    }

    if (Object.keys(data).length === 0) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "Nothing to update" });
    }

    const updated = await pgClient.teams.update({
        where: { id: teamId },
        data: { ...data, updated_at: new Date() },
        include: TEAM_INCLUDE,
    });

    logger.info(`team updated: ${teamId} by=${req.user.id} fields=${Object.keys(data).join(",")}`);
    return res.status(200).json(new ApiResponse(200, "Team updated", updated));
});

/**
 * DELETE /teams/:teamId — captain-only SOFT delete.
 *
 * Hard-deleting would orphan (or, with a cascade, destroy) the matches this team
 * organized. Flipping `is_active` retires the team while its history survives.
 */
const deleteTeam = asyncHandler(async (req, res) => {
    const { teamId } = req.params;
    const team = await requireTeam(teamId);
    requireCaptain(team, req.user.id);

    await pgClient.teams.update({
        where: { id: teamId },
        data: { is_active: false, updated_at: new Date() },
    });

    logger.info(`team soft-deleted: ${teamId} by=${req.user.id}`);
    return res.status(200).json(new ApiResponse(200, "Team disbanded", { teamId }));
});

/** GET /teams/my-teams — paginated teams the caller is an active member of. */
const getMyTeams = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePaging(req.query);
    const where = { user_id: req.user.id, status: "active", teams: { is_active: true } };

    const [memberships, total] = await Promise.all([
        pgClient.team_members.findMany({
            where,
            include: {
                teams: {
                    include: {
                        ...TEAM_INCLUDE,
                        _count: { select: { team_members: { where: { status: "active" } } } },
                    },
                },
            },
            orderBy: { joined_at: "desc" },
            skip,
            take: limit,
        }),
        pgClient.team_members.count({ where }),
    ]);

    const teams = memberships.map((m) => {
        const { _count, ...team } = m.teams;
        return { ...team, member_count: _count.team_members, my_role: m.role };
    });

    return res.status(200).json(
        new ApiResponse(200, "My teams", {
            teams,
            pagination: { page, limit, total, hasMore: skip + memberships.length < total },
        })
    );
});

/**
 * GET /teams/:teamId/events — paginated matches organized under this team.
 * Same event shape as the rest of the API so the client can reuse its card.
 */
const getTeamEvents = asyncHandler(async (req, res) => {
    const { teamId } = req.params;
    await requireTeam(teamId, { includeInactive: true }); // 404 beats an empty list
    const { page, limit, skip } = parsePaging(req.query);
    const where = { team_id: teamId };

    const [events, total] = await Promise.all([
        pgClient.events.findMany({
            where,
            include: {
                users: { select: TEAM_USER_SELECT },
                grounds: { include: { turfs: { select: { name: true, city: true } } } },
            },
            orderBy: { event_date: "desc" },
            skip,
            take: limit,
        }),
        pgClient.events.count({ where }),
    ]);

    return res.status(200).json(
        new ApiResponse(200, "Team matches", {
            events,
            pagination: { page, limit, total, hasMore: skip + events.length < total },
        })
    );
});

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

/**
 * POST /teams/:teamId/invites — captain or co-captain invites a player.
 *
 * Creation is ATOMIC: we let the `unique(team_id, invited_user_id)` index decide
 * instead of a racy check-then-create. On a duplicate (P2002) we look at what the
 * existing row is:
 *   pending             -> 409, an invite is already out
 *   declined/cancelled  -> revive it to pending (a "no" last month must not lock
 *                          the player out forever)
 *   accepted            -> only reachable if they since left; revive it too
 * The revive is a status-scoped `updateMany`, so two concurrent invites can't
 * both "win" and double-notify.
 */
const sendTeamInvite = asyncHandler(async (req, res) => {
    const inviterId = req.user.id;
    const { teamId } = req.params;
    const { invitedUserId } = req.body;
    const message = cleanString(req.body?.message);

    if (!invitedUserId) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "invitedUserId is required" });
    }
    if (!isUuid(invitedUserId)) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "invitedUserId must be a valid id",
        });
    }
    if (invitedUserId === inviterId) {
        throw ApiError.fromCode(ERROR_CODES.CANNOT_INVITE_SELF);
    }

    const team = await requireTeam(teamId);
    await requireCaptainOrCoCaptain(team, inviterId);

    const invitee = await pgClient.users.findUnique({
        where: { id: invitedUserId },
        select: { id: true, first_name: true, last_name: true },
    });
    if (!invitee) {
        throw ApiError.fromCode(ERROR_CODES.USER_NOT_FOUND, { message: "That player does not exist" });
    }

    // Already on the roster — nothing to invite them to.
    if (await getActiveMembership(teamId, invitedUserId)) {
        throw ApiError.fromCode(ERROR_CODES.ALREADY_TEAM_MEMBER);
    }

    let invite;
    try {
        invite = await pgClient.team_invites.create({
            data: {
                team_id: teamId,
                invited_user_id: invitedUserId,
                invited_by: inviterId,
                status: "pending",
                message: message ?? null,
            },
        });
    } catch (err) {
        if (err?.code !== "P2002") throw err;

        // A row already exists for this (team, player). Re-open it unless it is
        // still pending — scoping the update to non-pending statuses keeps this
        // atomic: exactly one concurrent caller can flip it.
        const revived = await pgClient.team_invites.updateMany({
            where: {
                team_id: teamId,
                invited_user_id: invitedUserId,
                status: { in: ["declined", "cancelled", "accepted"] },
            },
            data: {
                status: "pending",
                invited_by: inviterId,
                message: message ?? null,
                created_at: new Date(),
                responded_at: null,
            },
        });
        if (revived.count === 0) {
            throw ApiError.fromCode(ERROR_CODES.TEAM_INVITE_ALREADY_EXISTS);
        }
        invite = await pgClient.team_invites.findFirst({
            where: { team_id: teamId, invited_user_id: invitedUserId },
        });
    }

    const inviter = await pgClient.users.findUnique({
        where: { id: inviterId },
        select: { first_name: true, last_name: true },
    });
    await createNotification({
        user_id: invitedUserId,
        type: "team_invite",
        title: "You're wanted on a team",
        message: `${displayName(inviter)} invited you to join "${team.name}" — take a look`,
        data: { teamId, inviteId: invite.id, invitedBy: inviterId },
        priority: "high",
        action_url: `/teams/${teamId}`,
    });

    logger.info(`team invite sent: team=${teamId} to=${invitedUserId} by=${inviterId}`);
    return res.status(201).json(new ApiResponse(201, "Invite sent", invite));
});

/** GET /teams/:teamId/invites — captain/co-captain: this team's pending invites. */
const getTeamInvites = asyncHandler(async (req, res) => {
    const { teamId } = req.params;
    const team = await requireTeam(teamId);
    await requireCaptainOrCoCaptain(team, req.user.id);

    const { page, limit, skip } = parsePaging(req.query);
    const where = { team_id: teamId, status: "pending" };

    const [invites, total] = await Promise.all([
        pgClient.team_invites.findMany({
            where,
            include: {
                users_team_invites_invited_user_id: { select: TEAM_USER_SELECT },
                users_team_invites_invited_by: { select: TEAM_USER_SELECT },
            },
            orderBy: { created_at: "desc" },
            skip,
            take: limit,
        }),
        pgClient.team_invites.count({ where }),
    ]);

    const data = invites.map((i) => ({
        inviteId: i.id,
        message: i.message,
        created_at: i.created_at,
        user: i.users_team_invites_invited_user_id,
        invited_by: i.users_team_invites_invited_by,
    }));

    return res.status(200).json(
        new ApiResponse(200, "Team invites", {
            invites: data,
            pagination: { page, limit, total, hasMore: skip + invites.length < total },
        })
    );
});

/** GET /teams/my-invites — the caller's own incoming pending invites, all teams. */
const getMyTeamInvites = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePaging(req.query);
    const where = { invited_user_id: req.user.id, status: "pending", teams: { is_active: true } };

    const [invites, total] = await Promise.all([
        pgClient.team_invites.findMany({
            where,
            include: {
                teams: { include: TEAM_INCLUDE },
                users_team_invites_invited_by: { select: TEAM_USER_SELECT },
            },
            orderBy: { created_at: "desc" },
            skip,
            take: limit,
        }),
        pgClient.team_invites.count({ where }),
    ]);

    const data = invites.map((i) => ({
        inviteId: i.id,
        message: i.message,
        created_at: i.created_at,
        team: i.teams,
        invited_by: i.users_team_invites_invited_by,
    }));

    return res.status(200).json(
        new ApiResponse(200, "My team invites", {
            invites: data,
            pagination: { page, limit, total, hasMore: skip + invites.length < total },
        })
    );
});

/**
 * POST /teams/invites/:inviteId/accept — invited player joins.
 *
 * Roster row + invite status move together in one transaction, so a crash can't
 * leave an "accepted" invite with nobody on the roster. `upsert` (not create)
 * because someone who left before still has a row — rejoining re-activates it as
 * a plain member, with no leftover position from their last stint.
 */
const acceptTeamInvite = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { inviteId } = req.params;

    const invite = await pgClient.team_invites.findFirst({
        where: { id: inviteId, invited_user_id: userId, status: "pending" },
        include: { teams: true },
    });
    if (!invite) throw ApiError.fromCode(ERROR_CODES.TEAM_INVITE_NOT_FOUND);
    if (invite.teams?.is_active === false) throw ApiError.fromCode(ERROR_CODES.TEAM_NOT_FOUND);

    const membership = await pgClient.$transaction(async (tx) => {
        const row = await tx.team_members.upsert({
            where: { team_id_user_id: { team_id: invite.team_id, user_id: userId } },
            create: {
                team_id: invite.team_id,
                user_id: userId,
                role: "member",
                status: "active",
            },
            update: {
                role: "member",
                status: "active",
                position_id: null,
                joined_at: new Date(),
                left_at: null,
            },
        });

        await tx.team_invites.update({
            where: { id: inviteId },
            data: { status: "accepted", responded_at: new Date() },
        });

        return row;
    });

    // Tell whoever runs the team that the squad grew — except the joiner, who
    // could be a co-captain rejoining and doesn't need to hear their own news.
    const joiner = await pgClient.users.findUnique({
        where: { id: userId },
        select: { first_name: true, last_name: true },
    });
    await notifyTeamLeadership(
        invite.teams,
        {
            type: "team_invite_accepted",
            title: "A player joined your team",
            message: `${displayName(joiner)} joined "${invite.teams.name}" — squad's growing`,
            data: { teamId: invite.team_id, userId },
            priority: "medium",
            action_url: `/teams/${invite.team_id}`,
        },
        { exceptUserId: userId }
    );

    logger.info(`team invite accepted: team=${invite.team_id} user=${userId}`);
    return res.status(200).json(new ApiResponse(200, "You joined the team", membership));
});

/** POST /teams/invites/:inviteId/decline — invited player says no. */
const declineTeamInvite = asyncHandler(async (req, res) => {
    const { inviteId } = req.params;

    const invite = await pgClient.team_invites.findFirst({
        where: { id: inviteId, invited_user_id: req.user.id, status: "pending" },
    });
    if (!invite) throw ApiError.fromCode(ERROR_CODES.TEAM_INVITE_NOT_FOUND);

    const declined = await pgClient.team_invites.update({
        where: { id: inviteId },
        data: { status: "declined", responded_at: new Date() },
    });

    return res.status(200).json(new ApiResponse(200, "Invite declined", declined));
});

/** POST /teams/invites/:inviteId/cancel — team withdraws an invite before a reply. */
const cancelTeamInvite = asyncHandler(async (req, res) => {
    const { inviteId } = req.params;

    const invite = await pgClient.team_invites.findFirst({
        where: { id: inviteId, status: "pending" },
    });
    if (!invite) throw ApiError.fromCode(ERROR_CODES.TEAM_INVITE_NOT_FOUND);

    // Authorization is on the invite's TEAM, not the invite row — a co-captain
    // may withdraw an invite the captain sent, and vice versa.
    const team = await requireTeam(invite.team_id);
    await requireCaptainOrCoCaptain(team, req.user.id);

    const cancelled = await pgClient.team_invites.update({
        where: { id: inviteId },
        data: { status: "cancelled", responded_at: new Date() },
    });

    logger.info(`team invite cancelled: invite=${inviteId} by=${req.user.id}`);
    return res.status(200).json(new ApiResponse(200, "Invite cancelled", cancelled));
});

// ---------------------------------------------------------------------------
// Roster management
// ---------------------------------------------------------------------------

/**
 * PATCH /teams/:teamId/members/:userId — captain-only role/position change.
 *
 * `role: "captain"` is rejected here: promoting someone to captain also has to
 * move `teams.captain_id` and demote the incumbent, which is exactly what
 * transfer-captaincy does transactionally.
 */
const updateTeamMember = asyncHandler(async (req, res) => {
    const { teamId, userId } = req.params;
    const team = await requireTeam(teamId);
    requireCaptain(team, req.user.id);

    const { role, position_id } = req.body ?? {};
    const data = {};

    if (role !== undefined) {
        if (role === "captain") {
            throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
                message: "Use transfer-captaincy to make someone captain",
            });
        }
        if (!["co_captain", "member"].includes(role)) {
            throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
                message: "role must be 'co_captain' or 'member'",
            });
        }
        if (userId === team.captain_id) {
            throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
                message: "The captain's own role can only change through transfer-captaincy",
            });
        }
        data.role = role;
    }

    if (position_id !== undefined) {
        if (position_id === null || position_id === "") {
            data.position_id = null;
        } else if (!isUuid(position_id)) {
            throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
                message: "position_id must be a valid id",
            });
        } else {
            // A position from another sport would render as nonsense on the roster.
            const position = await pgClient.sport_positions.findFirst({
                where: { id: position_id, sport_id: team.sport_id },
                select: { id: true },
            });
            if (!position) {
                throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
                    message: "That position does not belong to this team's sport",
                });
            }
            data.position_id = position_id;
        }
    }

    if (Object.keys(data).length === 0) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "Provide a role or a position_id to update",
        });
    }

    // Must be on the roster right now — you can't promote someone who left.
    await requireActiveMembership(teamId, userId);

    const updated = await pgClient.team_members.update({
        where: { team_id_user_id: { team_id: teamId, user_id: userId } },
        data,
        include: TEAM_MEMBER_INCLUDE,
    });

    logger.info(`team member updated: team=${teamId} user=${userId} by=${req.user.id}`);
    return res.status(200).json(new ApiResponse(200, "Member updated", serializeMember(updated)));
});

/**
 * POST /teams/:teamId/transfer-captaincy — hand the team over.
 *
 * Three writes that must agree: the pointer (`teams.captain_id`), the outgoing
 * captain's role, and the incoming captain's role. One transaction, so the team
 * can never end up with two captains or none.
 */
const transferCaptaincy = asyncHandler(async (req, res) => {
    const { teamId } = req.params;
    const { newCaptainId } = req.body ?? {};
    const oldCaptainId = req.user.id;

    if (!newCaptainId) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "newCaptainId is required" });
    }
    if (!isUuid(newCaptainId)) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "newCaptainId must be a valid id",
        });
    }

    const team = await requireTeam(teamId);
    requireCaptain(team, oldCaptainId);

    if (newCaptainId === oldCaptainId) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "You are already the captain" });
    }
    // You can only hand the team to someone who is actually on it.
    await requireActiveMembership(teamId, newCaptainId);

    await pgClient.$transaction([
        pgClient.teams.update({
            where: { id: teamId },
            data: { captain_id: newCaptainId, updated_at: new Date() },
        }),
        // updateMany (not update) so a missing legacy row can't abort the transfer.
        pgClient.team_members.updateMany({
            where: { team_id: teamId, user_id: oldCaptainId },
            data: { role: "member" },
        }),
        pgClient.team_members.updateMany({
            where: { team_id: teamId, user_id: newCaptainId },
            data: { role: "captain" },
        }),
    ]);

    const oldCaptain = await pgClient.users.findUnique({
        where: { id: oldCaptainId },
        select: { first_name: true, last_name: true },
    });

    // The new captain needs to act on this; the old one is just kept in the loop.
    await createNotification({
        user_id: newCaptainId,
        type: "team_captaincy_transferred",
        title: "You're the captain now",
        message: `${displayName(oldCaptain)} handed you the armband for "${team.name}"`,
        data: { teamId, previousCaptainId: oldCaptainId },
        priority: "high",
        action_url: `/teams/${teamId}`,
    });
    await createNotification({
        user_id: oldCaptainId,
        type: "team_captaincy_transferred",
        title: "Captaincy handed over",
        message: `You're no longer the captain of "${team.name}"`,
        data: { teamId, newCaptainId },
        priority: "medium",
        action_url: `/teams/${teamId}`,
    });

    logger.info(`team captaincy transferred: team=${teamId} ${oldCaptainId} -> ${newCaptainId}`);
    return res
        .status(200)
        .json(new ApiResponse(200, "Captaincy transferred", { teamId, captain_id: newCaptainId }));
});

/**
 * DELETE /teams/:teamId/members/:userId — remove a member, or leave yourself.
 *
 * Two authorized callers, distinguished explicitly:
 *   - the captain removing someone else  -> status `removed`, target notified
 *   - a member removing themself (leave) -> status `left`, nobody notified
 * The captain cannot remove themself: the team would be left with a dangling
 * `captain_id`. They transfer the captaincy or disband the team instead.
 *
 * The row is never deleted — past matches reference these people.
 */
const removeTeamMember = asyncHandler(async (req, res) => {
    const callerId = req.user.id;
    const { teamId, userId } = req.params;

    const team = await requireTeam(teamId);
    const isCaptain = team.captain_id === callerId;
    const isSelf = userId === callerId;

    if (userId === team.captain_id) {
        throw ApiError.fromCode(ERROR_CODES.CANNOT_REMOVE_CAPTAIN);
    }
    if (!isCaptain && !isSelf) {
        throw ApiError.fromCode(ERROR_CODES.NOT_TEAM_CAPTAIN, {
            message: "Only the captain can remove another member",
        });
    }

    await requireActiveMembership(teamId, userId);

    const updated = await pgClient.team_members.update({
        where: { team_id_user_id: { team_id: teamId, user_id: userId } },
        data: {
            status: isSelf ? "left" : "removed",
            role: "member", // drop any co-captaincy on the way out
            left_at: new Date(),
        },
    });

    if (!isSelf) {
        const captain = await pgClient.users.findUnique({
            where: { id: callerId },
            select: { first_name: true, last_name: true },
        });
        await createNotification({
            user_id: userId,
            type: "team_member_removed",
            title: "You were removed from a team",
            message: `${displayName(captain)} removed you from "${team.name}"`,
            data: { teamId },
            priority: "medium",
            action_url: `/teams/${teamId}`,
        });
    }

    logger.info(
        `team member ${isSelf ? "left" : "removed"}: team=${teamId} user=${userId} by=${callerId}`
    );
    return res
        .status(200)
        .json(new ApiResponse(200, isSelf ? "You left the team" : "Member removed", updated));
});

export {
    getSportsCatalogue,
    createTeam,
    getTeamById,
    updateTeam,
    deleteTeam,
    getMyTeams,
    getTeamEvents,
    sendTeamInvite,
    getTeamInvites,
    getMyTeamInvites,
    acceptTeamInvite,
    declineTeamInvite,
    cancelTeamInvite,
    updateTeamMember,
    transferCaptaincy,
    removeTeamMember,
};
