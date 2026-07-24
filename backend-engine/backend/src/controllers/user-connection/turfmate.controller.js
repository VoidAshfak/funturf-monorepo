import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";
import { pgClient } from "../../prisma.js";
import { createNotification } from "../../utils/notificationService.js";
import {
    getAcceptedTurfmateIds,
    getConnectedOrSelfIds,
    getUserActivityAreas,
    computeMutualCounts,
} from "../../utils/turfmateService.js";
import {
    PUBLIC_PLAYER_PROFILE_SELECT,
    completionBoost,
} from "../../utils/profileService.js";

/**
 * "Turfmates" = accepted user-to-user connections. Backed by the PostgreSQL
 * `connections` model (requester_id -> recipient_id, status: pending | accepted
 * | rejected | blocked). All routes here are mounted behind verifyJWT, so
 * `req.user.id` is always set.
 */

// The public-safe subset of a user we ever return for a connection.
const PROFILE_SELECT = {
    id: true,
    first_name: true,
    last_name: true,
    profile_picture_url: true,
    division: true,
    district: true,
    bio: true,
};

/** Build a display name from a user row, with a safe fallback. */
const displayName = (user) =>
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Someone";

/** Given a connection row and the current user, return the OTHER party's id. */
const otherPartyId = (connection, myId) =>
    connection.requester_id === myId ? connection.recipient_id : connection.requester_id;

/** Parse `page`/`limit` query with sane clamps. */
const parsePaging = (query) => {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 50);
    return { page, limit, skip: (page - 1) * limit };
};

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

const sendTurfmateRequest = asyncHandler(async (req, res) => {
    const requesterId = req.user.id;
    const { receiverId, message } = req.body;

    if (!receiverId) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "receiverId is required" });
    }
    if (requesterId === receiverId) {
        throw ApiError.fromCode(ERROR_CODES.CANNOT_CONNECT_SELF);
    }

    // Receiver must exist (sender is guaranteed by the auth middleware).
    const receiver = await pgClient.users.findUnique({
        where: { id: receiverId },
        select: { id: true },
    });
    if (!receiver) {
        throw ApiError.fromCode(ERROR_CODES.USER_NOT_FOUND, { message: "Receiver does not exist" });
    }

    // Reverse-direction guard (the DB unique index only covers requester->recipient,
    // so a recipient->requester row must be caught here).
    const reverse = await pgClient.connections.findFirst({
        where: { requester_id: receiverId, recipient_id: requesterId },
    });
    if (reverse) {
        throw ApiError.fromCode(ERROR_CODES.CONNECTION_ALREADY_EXISTS, {
            message:
                reverse.status === "pending"
                    ? "This user has already sent you a turfmate request"
                    : undefined,
        });
    }

    // Same-direction create is guarded by the unique index; we catch the race
    // (P2002) instead of a non-atomic check-then-create.
    let created;
    try {
        created = await pgClient.connections.create({
            data: {
                requester_id: requesterId,
                recipient_id: receiverId,
                status: "pending",
                connection_type: "friend",
                message: message ?? null,
            },
        });
    } catch (err) {
        if (err?.code === "P2002") {
            throw ApiError.fromCode(ERROR_CODES.CONNECTION_ALREADY_EXISTS);
        }
        throw err;
    }

    // Notify the receiver (best-effort — never fails the request).
    const requester = await pgClient.users.findUnique({
        where: { id: requesterId },
        select: { first_name: true, last_name: true },
    });
    await createNotification({
        user_id: receiverId,
        type: "connection_request",
        title: "New turfmate request",
        message: `${displayName(requester)} sent you a turfmate request`,
        data: { connectionId: created.id, requesterId },
        priority: "high",
        action_url: `/profile/${requesterId}`,
    });

    return res.status(201).json(new ApiResponse(201, "Turfmate request sent", created));
});

// Incoming requests awaiting THIS user's response (paginated, with requester profile).
const getPendingRequests = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePaging(req.query);
    const where = { recipient_id: req.user.id, status: "pending" };

    const [requests, total] = await Promise.all([
        pgClient.connections.findMany({
            where,
            include: { users_connections_requester_idTousers: { select: PROFILE_SELECT } },
            orderBy: { created_at: "desc" },
            skip,
            take: limit,
        }),
        pgClient.connections.count({ where }),
    ]);

    const data = requests.map((r) => ({
        connectionId: r.id,
        message: r.message,
        created_at: r.created_at,
        user: r.users_connections_requester_idTousers,
    }));

    return res.status(200).json(
        new ApiResponse(200, "Pending turfmate requests", {
            requests: data,
            pagination: { page, limit, total, hasMore: skip + requests.length < total },
        })
    );
});

// Outgoing requests THIS user has sent that are still pending.
const getOutgoingRequests = asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePaging(req.query);
    const where = { requester_id: req.user.id, status: "pending" };

    const [requests, total] = await Promise.all([
        pgClient.connections.findMany({
            where,
            include: { users_connections_recipient_idTousers: { select: PROFILE_SELECT } },
            orderBy: { created_at: "desc" },
            skip,
            take: limit,
        }),
        pgClient.connections.count({ where }),
    ]);

    const data = requests.map((r) => ({
        connectionId: r.id,
        created_at: r.created_at,
        user: r.users_connections_recipient_idTousers,
    }));

    return res.status(200).json(
        new ApiResponse(200, "Outgoing turfmate requests", {
            requests: data,
            pagination: { page, limit, total, hasMore: skip + requests.length < total },
        })
    );
});

const acceptTurfmateRequest = asyncHandler(async (req, res) => {
    const { requestId } = req.body;
    if (!requestId) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "requestId is required" });
    }

    // Only the recipient of a still-pending request may accept it.
    const connection = await pgClient.connections.findFirst({
        where: { id: requestId, recipient_id: req.user.id, status: "pending" },
    });
    if (!connection) {
        throw ApiError.fromCode(ERROR_CODES.CONNECTION_NOT_FOUND);
    }

    const accepted = await pgClient.connections.update({
        where: { id: connection.id },
        data: { status: "accepted", responded_at: new Date() },
    });

    // Let the original requester know their request was accepted.
    const accepter = await pgClient.users.findUnique({
        where: { id: req.user.id },
        select: { first_name: true, last_name: true },
    });
    await createNotification({
        user_id: connection.requester_id,
        type: "connection_accepted",
        title: "Turfmate request accepted",
        message: `${displayName(accepter)} accepted your turfmate request`,
        data: { connectionId: connection.id, userId: req.user.id },
        priority: "high",
        action_url: `/profile/${req.user.id}`,
    });

    return res.status(200).json(new ApiResponse(200, "Turfmate request accepted", accepted));
});

// Recipient declines a pending request.
const rejectTurfmateRequest = asyncHandler(async (req, res) => {
    const { requestId } = req.body;
    if (!requestId) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "requestId is required" });
    }

    const connection = await pgClient.connections.findFirst({
        where: { id: requestId, recipient_id: req.user.id, status: "pending" },
    });
    if (!connection) {
        throw ApiError.fromCode(ERROR_CODES.CONNECTION_NOT_FOUND);
    }

    const rejected = await pgClient.connections.update({
        where: { id: connection.id },
        data: { status: "rejected", responded_at: new Date() },
    });

    return res.status(200).json(new ApiResponse(200, "Turfmate request rejected", rejected));
});

// Requester cancels a pending request they sent (hard delete so it can be re-sent).
const cancelTurfmateRequest = asyncHandler(async (req, res) => {
    const { requestId } = req.body;
    if (!requestId) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "requestId is required" });
    }

    const connection = await pgClient.connections.findFirst({
        where: { id: requestId, requester_id: req.user.id, status: "pending" },
    });
    if (!connection) {
        throw ApiError.fromCode(ERROR_CODES.CONNECTION_NOT_FOUND);
    }

    await pgClient.connections.delete({ where: { id: connection.id } });
    return res.status(200).json(new ApiResponse(200, "Turfmate request cancelled", { connectionId: requestId }));
});

// Remove an existing turfmate (either party can unfriend). Hard delete.
const removeTurfmate = asyncHandler(async (req, res) => {
    const myId = req.user.id;
    const { userId } = req.body;
    if (!userId) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "userId is required" });
    }

    const connection = await pgClient.connections.findFirst({
        where: {
            status: "accepted",
            OR: [
                { requester_id: myId, recipient_id: userId },
                { requester_id: userId, recipient_id: myId },
            ],
        },
    });
    if (!connection) {
        throw ApiError.fromCode(ERROR_CODES.CONNECTION_NOT_FOUND, { message: "You are not turfmates" });
    }

    await pgClient.connections.delete({ where: { id: connection.id } });
    return res.status(200).json(new ApiResponse(200, "Turfmate removed", { userId }));
});

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

// Accepted turfmates as full profiles (paginated) — no more client-side N+1.
const getTurfmates = asyncHandler(async (req, res) => {
    const myId = req.user.id;
    const { page, limit, skip } = parsePaging(req.query);
    const where = {
        status: "accepted",
        OR: [{ requester_id: myId }, { recipient_id: myId }],
    };

    const [connections, total] = await Promise.all([
        pgClient.connections.findMany({
            where,
            include: {
                users_connections_requester_idTousers: { select: PROFILE_SELECT },
                users_connections_recipient_idTousers: { select: PROFILE_SELECT },
            },
            orderBy: { responded_at: "desc" },
            skip,
            take: limit,
        }),
        pgClient.connections.count({ where }),
    ]);

    const turfmates = connections.map((c) => {
        const profile =
            c.requester_id === myId
                ? c.users_connections_recipient_idTousers
                : c.users_connections_requester_idTousers;
        return { ...profile, connected_since: c.responded_at ?? c.created_at };
    });

    return res.status(200).json(
        new ApiResponse(200, "Turfmates", {
            turfmates,
            pagination: { page, limit, total, hasMore: skip + connections.length < total },
        })
    );
});

// Relationship between me and another user — drives the profile button state.
const getConnectionStatus = asyncHandler(async (req, res) => {
    const myId = req.user.id;
    const { userId } = req.params;

    if (userId === myId) {
        return res.status(200).json(new ApiResponse(200, "Connection status", { status: "self" }));
    }

    const connection = await pgClient.connections.findFirst({
        where: {
            OR: [
                { requester_id: myId, recipient_id: userId },
                { requester_id: userId, recipient_id: myId },
            ],
        },
    });

    if (!connection) {
        return res.status(200).json(new ApiResponse(200, "Connection status", { status: "none" }));
    }

    // direction is meaningful only while pending (who needs to act).
    const direction =
        connection.status === "pending"
            ? connection.requester_id === myId
                ? "outgoing"
                : "incoming"
            : null;

    return res.status(200).json(
        new ApiResponse(200, "Connection status", {
            status: connection.status,
            direction,
            connectionId: connection.id,
        })
    );
});

const getMutualTurfmates = asyncHandler(async (req, res) => {
    const myId = req.user.id;
    // GET route -> other user's id comes from the query string.
    const { userTwo } = req.query;
    if (!userTwo) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "userTwo query parameter is required" });
    }

    const [mine, theirs] = await Promise.all([
        getAcceptedTurfmateIds(myId),
        getAcceptedTurfmateIds(userTwo),
    ]);
    const mySet = new Set(mine);
    const mutualIds = theirs.filter((id) => mySet.has(id) && id !== myId && id !== userTwo);

    // Resolve to profiles so the client can render avatars directly.
    const profiles = mutualIds.length
        ? await pgClient.users.findMany({ where: { id: { in: mutualIds } }, select: PROFILE_SELECT })
        : [];

    return res.status(200).json(new ApiResponse(200, "Mutual turfmates", profiles));
});

// ---------------------------------------------------------------------------
// Recommendations (location-based, with turfmate highlighting)
// ---------------------------------------------------------------------------

const getRecommendations = asyncHandler(async (req, res) => {
    const myId = req.user.id;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 30);

    const [me, excluded, myTurfmateIds, activity] = await Promise.all([
        pgClient.users.findUnique({ where: { id: myId }, select: { division: true, district: true } }),
        getConnectedOrSelfIds(myId), // everyone I already have any connection with (+ me)
        getAcceptedTurfmateIds(myId),
        getUserActivityAreas(myId),
    ]);

    const myTurfmateSet = new Set(myTurfmateIds);
    const excludedIds = [...excluded];
    const cityList = [...activity.cities];

    // Candidate pool from two location signals:
    //   1) users whose HOME area (division/district) matches mine
    //   2) users ACTIVE in the same cities as me (event history)
    const locOr = [];
    if (me?.district) locOr.push({ district: me.district });
    if (me?.division) locOr.push({ division: me.division });

    const [locUsers, activityRows] = await Promise.all([
        locOr.length
            ? pgClient.users.findMany({
                  where: { status: "active", id: { notIn: excludedIds }, OR: locOr },
                  select: { id: true },
                  take: 200,
              })
            : Promise.resolve([]),
        cityList.length
            ? pgClient.event_participants.findMany({
                  where: {
                      user_id: { notIn: excludedIds },
                      events: { grounds: { turfs: { city: { in: cityList } } } },
                  },
                  select: { user_id: true },
                  distinct: ["user_id"],
                  take: 200,
              })
            : Promise.resolve([]),
    ]);

    const activitySet = new Set(activityRows.map((r) => r.user_id));
    const candidateIds = [...new Set([...locUsers.map((u) => u.id), ...activitySet])].filter(
        (id) => !excluded.has(id)
    );

    if (candidateIds.length === 0) {
        return res.status(200).json(new ApiResponse(200, "Turfmate recommendations", { recommendations: [] }));
    }

    const [profiles, mutualCounts] = await Promise.all([
        pgClient.users.findMany({
            where: { id: { in: candidateIds }, status: "active" },
            select: {
                ...PROFILE_SELECT,
                // Extra columns feed the completeness score only — they are
                // stripped before the payload goes out (see the map below), so the
                // recommendation DTO keeps the same public shape it always had.
                cover_photo_url: true,
                date_of_birth: true,
                gender: true,
                phone: true,
                player_profiles: { select: PUBLIC_PLAYER_PROFILE_SELECT, take: 1 },
            },
        }),
        computeMutualCounts(candidateIds, myTurfmateSet),
    ]);

    const recommendations = profiles
        .map((row) => {
            // Split the scoring-only columns off the public DTO. `phone` in
            // particular must never reach a recommendation card — it's read here
            // solely because it's one of the scored checklist fields.
            const { player_profiles, phone, date_of_birth, gender, ...p } = row;
            const playerProfile = player_profiles?.[0] ?? null;

            const mutual = mutualCounts.get(p.id) || 0;
            const sameDistrict = me?.district && p.district === me.district;
            const sameDivision = me?.division && p.division === me.division;
            const activeNearby = activitySet.has(p.id);

            // Area score: precise district match > shared activity city > same division.
            const areaScore = sameDistrict ? 3 : activeNearby ? 2 : sameDivision ? 1 : 0;
            // A complete profile ranks higher: someone you can actually size up
            // before reaching out is a better suggestion than a blank one. Capped
            // at 3 here (not the default 10) so it TIE-BREAKS rather than
            // overrides — mutual turfmates remain the strongest signal for a
            // social recommendation. See completionBoost in profileService.js.
            const completeness = completionBoost(
                { ...p, phone, date_of_birth, gender },
                playerProfile,
                3
            );
            // Mutual turfmates dominate ranking (strong social signal).
            const score = mutual * 10 + areaScore + completeness;

            const reason = sameDistrict
                ? `Plays in ${p.district}`
                : activeNearby
                  ? "Active in your area"
                  : mutual > 0
                    ? `${mutual} mutual turfmate${mutual > 1 ? "s" : ""}`
                    : sameDivision
                      ? `From ${p.division}`
                      : "Suggested for you";

            return {
                ...p,
                mutual_turfmates: mutual,
                has_mutual: mutual > 0, // highlight flag: a turfmate is involved
                reason,
                _score: score,
            };
        })
        .sort((a, b) => b._score - a._score)
        .slice(0, limit)
        .map(({ _score, ...rest }) => rest); // drop internal score from the payload

    return res.status(200).json(new ApiResponse(200, "Turfmate recommendations", { recommendations }));
});

export {
    sendTurfmateRequest,
    getPendingRequests,
    getOutgoingRequests,
    acceptTurfmateRequest,
    rejectTurfmateRequest,
    cancelTurfmateRequest,
    removeTurfmate,
    getTurfmates,
    getConnectionStatus,
    getMutualTurfmates,
    getRecommendations,
};
