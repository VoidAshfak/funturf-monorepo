import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";
import { pgClient } from "../../prisma.js";

/**
 * "Turfmates" = accepted user-to-user connections. Backed by the PostgreSQL
 * `connections` model (migrated off the deprecated mongoClient):
 *   requester_id -> recipient_id, status: pending | accepted | rejected | blocked.
 *
 * All routes here are mounted behind verifyJWT, so `req.user.id` is always set.
 */

/** Given a connection row and the current user, return the OTHER party's id. */
const otherPartyId = (connection, myId) =>
    connection.requester_id === myId ? connection.recipient_id : connection.requester_id;

const sendTurfmateRequest = asyncHandler(async (req, res) => {
    const requesterId = req.user.id;
    const { receiverId } = req.body;

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

    // A connection may already exist in EITHER direction.
    const existing = await pgClient.connections.findFirst({
        where: {
            OR: [
                { requester_id: requesterId, recipient_id: receiverId },
                { requester_id: receiverId, recipient_id: requesterId },
            ],
        },
    });

    if (existing) {
        const messageByStatus = {
            accepted: "You are already turfmates",
            pending: "A turfmate request is already pending between you two",
            rejected: "A previous turfmate request between you two was rejected",
            blocked: "This connection is blocked",
        };
        throw ApiError.fromCode(ERROR_CODES.CONNECTION_ALREADY_EXISTS, {
            message: messageByStatus[existing.status] ?? undefined,
        });
    }

    const created = await pgClient.connections.create({
        data: {
            requester_id: requesterId,
            recipient_id: receiverId,
            status: "pending",
            connection_type: "friend",
        },
    });

    return res
        .status(201)
        .json(new ApiResponse(201, "Turfmate request sent", created));
});

const getPendingRequests = asyncHandler(async (req, res) => {
    // Incoming requests awaiting THIS user's response.
    const pendingRequests = await pgClient.connections.findMany({
        where: {
            recipient_id: req.user.id,
            status: "pending",
        },
        include: {
            users_connections_requester_idTousers: {
                select: { id: true, first_name: true, last_name: true, profile_picture_url: true },
            },
        },
        orderBy: { created_at: "desc" },
    });

    return res
        .status(200)
        .json(new ApiResponse(200, "Pending turfmate requests", pendingRequests));
});

const acceptTurfmateRequest = asyncHandler(async (req, res) => {
    const { requestId } = req.body;

    if (!requestId) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "requestId is required" });
    }

    // Only the recipient of a still-pending request may accept it.
    const connection = await pgClient.connections.findFirst({
        where: {
            id: requestId,
            recipient_id: req.user.id,
            status: "pending",
        },
    });

    if (!connection) {
        throw ApiError.fromCode(ERROR_CODES.CONNECTION_NOT_FOUND);
    }

    const accepted = await pgClient.connections.update({
        where: { id: connection.id },
        data: { status: "accepted", responded_at: new Date() },
    });

    return res
        .status(200)
        .json(new ApiResponse(200, "Turfmate request accepted", accepted));
});

const getTurfmates = asyncHandler(async (req, res) => {
    const myId = req.user.id;

    // Accepted connections in either direction.
    const connections = await pgClient.connections.findMany({
        where: {
            status: "accepted",
            OR: [{ requester_id: myId }, { recipient_id: myId }],
        },
    });

    const turfmateIds = connections.map((c) => otherPartyId(c, myId));

    return res
        .status(200)
        .json(new ApiResponse(200, "Turfmates", turfmateIds));
});

const getMutualTurfmates = asyncHandler(async (req, res) => {
    const myId = req.user.id;
    // This is a GET route, so read the other user's id from the query string
    // (a GET request carries no body).
    const { userTwo } = req.query;

    if (!userTwo) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "userTwo query parameter is required" });
    }

    // Fetch accepted connections for both users, reduce to the "other party"
    // id sets, then intersect.
    const [myConnections, theirConnections] = await Promise.all([
        pgClient.connections.findMany({
            where: { status: "accepted", OR: [{ requester_id: myId }, { recipient_id: myId }] },
        }),
        pgClient.connections.findMany({
            where: { status: "accepted", OR: [{ requester_id: userTwo }, { recipient_id: userTwo }] },
        }),
    ]);

    const myTurfmates = new Set(myConnections.map((c) => otherPartyId(c, myId)));
    const theirTurfmates = theirConnections.map((c) => otherPartyId(c, userTwo));

    const mutual = theirTurfmates.filter((id) => myTurfmates.has(id) && id !== myId && id !== userTwo);

    return res
        .status(200)
        .json(new ApiResponse(200, "Mutual turfmates", mutual));
});

export {
    sendTurfmateRequest,
    getPendingRequests,
    acceptTurfmateRequest,
    getTurfmates,
    getMutualTurfmates,
};
