import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";
import { pgClient } from "../../prisma.js";
import { EventSerializer } from "../../utils/dataSerializer.js";
import { createNotification } from "../../utils/notificationService.js";
import { broadcastToTurfmates, getAcceptedTurfmateIds } from "../../utils/turfmateService.js";
import { isEventAdmin, notifyEventAdmins } from "../../utils/eventService.js";
import { logger } from "../../../logs/logger.js";
import { emitToEvent } from "../../socket.js";

// Tell everyone viewing a match page that its roster / request queue changed, so
// their squad list and admin panel refresh live (no manual reload). Non-sensitive
// — just a nudge to refetch; carries no private data.
const broadcastRoster = (eventId) => emitToEvent(eventId, "event:roster", { eventId });

// Build a display name from a user row, with a safe fallback.
const displayName = (u, fallback = "A player") =>
    [u?.first_name, u?.last_name].filter(Boolean).join(" ") || fallback;

// Priority for turfmate broadcasts scales with how soon the match is:
// today -> urgent, within 3 days -> high, else medium. Helps the notification
// box surface the matches that need players *now*.
const eventPriorityByDate = (eventDate) => {
    if (!eventDate) return "medium";
    const MS_DAY = 86400000;
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((startOfDay(new Date(eventDate)) - startOfDay(new Date())) / MS_DAY);
    if (diffDays <= 0) return "urgent";
    if (diffDays <= 3) return "high";
    return "medium";
};


const createEvent = asyncHandler(async (req, res) => {

    const {
        organizer_id,
        title,
        description,
        sport_type,
        event_type,
        event_date,
        start_time,
        end_time,
        ground_id,
        venue_id,
        max_players,
        min_Players,
        current_players,
        skill_level_required,
        total_cost,
        cost_split_type,
        // Optional: an existing booking (the ground reservation) the organizer
        // wants this match tied to. Linked bidirectionally after the event exists.
        booking_id,
    } = req.body

    if (!title
        || !sport_type
        || !event_type
        || !event_date
        || !start_time
        || !end_time
        || !venue_id
        || !ground_id
        || !max_players
        || !min_Players
        || !current_players
        || !skill_level_required
        || !total_cost
        || !cost_split_type) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "A required event field is missing",
        });
    }

    // If the organizer is attaching a booking, validate it BEFORE creating the
    // event so we never leave an orphan event when the booking is bad. It must be
    // the caller's own booking and not already tied to another match.
    if (booking_id) {
        const booking = await pgClient.bookings.findUnique({
            where: { id: booking_id },
            select: { id: true, user_id: true, event_id: true },
        });
        if (!booking) throw ApiError.fromCode(ERROR_CODES.BOOKING_NOT_FOUND);
        if (booking.user_id !== req.user.id) {
            throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
                message: "You can only attach a booking you made",
            });
        }
        if (booking.event_id) throw ApiError.fromCode(ERROR_CODES.BOOKING_ALREADY_ATTACHED);
    }

    const createdEvents = await pgClient.$queryRaw
        `
    SELECT * FROM fn_create_event(
        ${req.user.id}::uuid,
        ${title}::varchar, 
        ${description || ""}::text, 
        ${sport_type}::varchar, 
        ${event_type}::event_type, 
        ${event_date}::date, 
        ${start_time}::time, 
        ${end_time}::time, 
        ${venue_id}::uuid, 
        ${ground_id}::uuid, 
        ${Number(max_players)}::int, 
        ${Number(min_Players)}::int,
        ${Number(current_players.length)}::int,
        ${skill_level_required}::skill_level_type, 
        ${total_cost}::numeric, 
        ${cost_split_type}::cost_split_type 
    )`

    const createdEvent = createdEvents[0];


    if (!createdEvent) {
        throw new ApiError(500, "Event creation failed!")
    }

    // Initial roster the organizer hand-picked at creation are approved outright
    // (not pending requests), so they never surface in the admin request queue.
    const eventParticipantData = current_players.map((player) => ({
        event_id: createdEvent.id,
        user_id: player.value,
        status: 'approved',
        role: 'player',
        payment_status: 'pending',
        joined_at: createdEvent.created_at,
        approved_at: createdEvent.created_at
    }))

    const insertEventParticipants = await pgClient.event_participants.createMany({
        data: eventParticipantData,
        skipDuplicates: true
    });

    // Tie the booking to the match on BOTH sides, atomically:
    //   events.booking_id  -> the reservation this match runs on
    //   bookings.event_id  -> the match this reservation is for
    // Re-guarding event_id inside the transaction closes the race where two
    // events grab the same booking at once. Best-effort re-check kept simple; a
    // lost race just means the second event links nothing (booking already taken).
    if (booking_id) {
        await pgClient.$transaction([
            pgClient.events.update({
                where: { id: createdEvent.id },
                data: { booking_id },
            }),
            pgClient.bookings.updateMany({
                where: { id: booking_id, user_id: req.user.id, event_id: null },
                data: { event_id: createdEvent.id },
            }),
        ]);
        logger.info(`event ${createdEvent.id} linked to booking ${booking_id}`);
    }

    // Align turfmates: tell the organizer's turfmates a new match is up for grabs,
    // prioritised by how soon it is. Best-effort; never blocks event creation.
    const organizer = await pgClient.users.findUnique({
        where: { id: req.user.id },
        select: { first_name: true, last_name: true },
    });
    const organizerName =
        [organizer?.first_name, organizer?.last_name].filter(Boolean).join(" ") || "A turfmate";
    await broadcastToTurfmates(req.user.id, {
        type: "event_invitation",
        title: "A turfmate organized a match",
        message: `${organizerName} is organizing "${title}" — join if you're in`,
        data: { eventId: createdEvent.id },
        priority: eventPriorityByDate(createdEvent.event_date ?? event_date),
        action_url: `/events/${createdEvent.id}`,
    });

    return res.status(200).json(new ApiResponse(200, "Event created successfully", createdEvent));

})

// Paginated + filtered events feed (powers the infinite-scroll /events page).
//
// Query params (all optional):
//   page      1-based page number            (default 1)
//   limit     page size, clamped 1..50        (default 12)
//   sport     exact sport_type, "all" = any
//   timeframe all | today | week | month      (filters event_date forward)
//   q         search term (title or turf name, case-insensitive)
//   openOnly  "true" -> only events still needing players
//
// Response data: { events, pagination, stats }.
// `stats` (global, unfiltered) is only computed on page 1 to save queries — the
// client keeps it from the first load to render the hero + sport chips.
const getEvents = asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);
    const skip = (page - 1) * limit;

    const { sport, timeframe, q, openOnly } = req.query;

    // Build the Prisma `where` from the active filters.
    const where = {};

    if (sport && sport !== "all") {
        where.sport_type = sport;
    }

    // timeframe -> event_date window (from the start of today, forward).
    if (timeframe && timeframe !== "all") {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let end;
        if (timeframe === "today") {
            end = new Date(start);
            end.setDate(end.getDate() + 1);
        } else if (timeframe === "week") {
            end = new Date(start);
            end.setDate(end.getDate() + 7);
        } else if (timeframe === "month") {
            end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        }
        where.event_date = { gte: start, ...(end ? { lt: end } : {}) };
    }

    if (q && q.trim()) {
        const term = q.trim();
        where.OR = [
            { title: { contains: term, mode: "insensitive" } },
            { grounds: { turfs: { name: { contains: term, mode: "insensitive" } } } },
        ];
    }

    // "Open" = still short of the minimum squad size. This compares two columns,
    // which Prisma supports via field references (needs Prisma 5.x+; we're on 6.x).
    if (openOnly === "true") {
        where.min_players = { gt: pgClient.events.fields.current_players };
    }

    const select = {
        id: true,
        title: true,
        description: true,
        grounds: {
            select: {
                id: true,
                name: true,
                turfs: {
                    select: {
                        id: true,
                        name: true,
                        address_line_1: true,
                    },
                },
            },
        },
        organizer_id: true,
        // Organizer profile — powers the "Organized by" line on the feed card.
        users: {
            select: {
                id: true,
                first_name: true,
                last_name: true,
                profile_picture_url: true,
            },
        },
        sport_type: true,
        event_date: true,
        start_time: true,
        end_time: true,
        min_players: true,
        max_players: true,
        current_players: true,
        event_participants: {
            select: {
                user_id: true,
                status: true,
                // participant avatars for the card
                users: {
                    select: {
                        id: true,
                        first_name: true,
                        profile_picture_url: true,
                    },
                },
            },
        },
    };

    // Soonest matches first; id as a stable tie-breaker for deterministic paging.
    const [events, total] = await Promise.all([
        pgClient.events.findMany({
            where,
            select,
            orderBy: [{ event_date: "asc" }, { id: "asc" }],
            skip,
            take: limit,
        }),
        pgClient.events.count({ where }),
    ]);

    const hasMore = skip + events.length < total;

    // Global stats for the hero + sport chips — computed once (page 1) only.
    let stats;
    if (page === 1) {
        const [globalTotal, openTotal, sportGroups] = await Promise.all([
            pgClient.events.count(),
            pgClient.events.count({
                where: { min_players: { gt: pgClient.events.fields.current_players } },
            }),
            pgClient.events.groupBy({
                by: ["sport_type"],
                _count: { _all: true },
            }),
        ]);

        const sports = sportGroups
            .filter((g) => g.sport_type)
            .map((g) => ({ name: g.sport_type, count: g._count._all }))
            .sort((a, b) => b.count - a.count);

        stats = { total: globalTotal, open: openTotal, sports };
    }

    // Turfmate highlight: if the request is authenticated (optional auth), tag each
    // event with which of the caller's turfmates are involved (organizer or player).
    let eventsOut = events;
    if (req.user?.id) {
        const myTurfmates = new Set(await getAcceptedTurfmateIds(req.user.id));
        if (myTurfmates.size > 0) {
            eventsOut = events.map((e) => {
                const involved = [];
                const seen = new Set();
                const consider = (u) => {
                    if (u && myTurfmates.has(u.id) && !seen.has(u.id)) {
                        seen.add(u.id);
                        involved.push({
                            id: u.id,
                            first_name: u.first_name,
                            profile_picture_url: u.profile_picture_url,
                        });
                    }
                };
                consider(e.users); // organizer
                e.event_participants?.forEach((p) => consider(p.users));
                return { ...e, turfmates_involved: involved };
            });
        }
    }

    return res.status(200).json(
        new ApiResponse(200, `${eventsOut.length} events found`, {
            events: eventsOut,
            pagination: { page, limit, total, hasMore },
            ...(stats ? { stats } : {}),
        })
    );
});

const getEventById = asyncHandler(async (req, res) => {
    const { event_id } = req.params;

    if (!event_id) {
        throw ApiError.fromCode(ERROR_CODES.BAD_REQUEST, {
            message: "An event id is required",
        });
    }

    const event = await pgClient.events.findUnique({
        where: {
            id: event_id
        },
        select: {
            id: true,
            title: true,
            users: {
                select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    profile_picture_url: true
                }
            },
            description: true,
            grounds: {
                select: {
                    id: true,
                    name: true,
                    turfs: {
                        select: {
                            id: true,
                            name: true,
                            city: true,
                            state: true,
                            postal_code: true,
                            country: true,
                            latitude: true,
                            longitude: true,
                        }
                    }
                }
            },
            sport_type: true,
            event_date: true,
            start_time: true,
            end_time: true,
            min_players: true,
            max_players: true,
            current_players: true,
            // The attached booking (the ground reservation this match runs on),
            // if the organizer tied one. Drives the booking card on the detail page.
            bookings_events_booking_idTobookings: {
                select: {
                    id: true,
                    booking_date: true,
                    slot: true,
                    ground_id: true,
                    user_id: true,
                    total_amount: true,
                    discount_amount: true,
                    final_amount: true,
                    payment_status: true,
                    booking_status: true,
                },
            },
            event_participants: {
                select: {
                    user_id: true,
                    status: true,
                }
            },
            event_comments: true,
        }
    })

    if (!event) {
        throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_FOUND);
    }

    // Full roster with profiles + role/status so the client can render the squad,
    // read the caller's own participation, and drive the admin panel.
    const players_joined = await pgClient.event_participants.findMany({
        where: {
            event_id: event.id
        },
        select: {
            id: true,
            user_id: true,
            status: true,
            role: true,
            joined_at: true,
            users: {
                select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    profile_picture_url: true,
                },
            },
        },
        orderBy: { joined_at: "asc" },
    })



    if (!players_joined) {
        throw new ApiError(404, "Error getting event players")
    }

    // Attach the live hold countdown to the booking. An unpaid booking is a soft
    // 2-hour hold; its expiry lives on the slot_locks row (source of truth). Only
    // meaningful while still pending+unpaid — a paid/confirmed booking has no timer.
    const attachedBooking = event.bookings_events_booking_idTobookings;
    let bookingWithHold = attachedBooking;
    if (
        attachedBooking &&
        attachedBooking.booking_status === "pending" &&
        attachedBooking.payment_status === "pending"
    ) {
        const lock = await pgClient.slot_locks.findFirst({
            where: {
                ground_id: attachedBooking.ground_id,
                date: attachedBooking.booking_date,
                slot_code: attachedBooking.slot?.code,
                locked_by_user_id: attachedBooking.user_id,
                locked_until: { gt: new Date() },
            },
            select: { locked_until: true },
        });
        bookingWithHold = { ...attachedBooking, hold_expires_at: lock?.locked_until ?? null };
    }

    const response = EventSerializer.toDto({
        ...event,
        event_participants: players_joined,
        booking: bookingWithHold,
    })

    return res.status(200).json(new ApiResponse(200, "Event found", response));
});

const deleteEvent = asyncHandler(async (req, res) => {
    const event_id = req.body.event_id;
    const user_id = req.user.id;

    const existingEvent = await pgClient.events.findUnique({
        where: {
            id: event_id,
        }
    })

    if (!existingEvent) {
        throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_FOUND);
    }

    if (existingEvent.organizer_id !== user_id) {
        throw ApiError.fromCode(ERROR_CODES.NOT_EVENT_ORGANIZER);
    }

    const deletedEventResponse = await pgClient.events.delete({
        where: {
            id: event_id,
        }
    })

    return res.status(200).json(new ApiResponse(200, "Event deleted successfully", deletedEventResponse));
});

const getUserEvents = asyncHandler(async (req, res) => {

    const userId = req.user.id;
    const { status } = req.query;

    // Relation/column names must match the Prisma schema:
    //   event_participants -> events (relation "events")
    //   events -> users (organizer, relation "users")
    //   events -> grounds -> turfs
    // (event_participants has no role/team columns, so we don't filter/return them.)
    const where = { user_id: userId };
    if (status) where.status = status;

    const participations = await pgClient.event_participants.findMany({
        where,
        include: {
            events: {
                include: {
                    users: {
                        select: {
                            id: true,
                            first_name: true,
                            last_name: true,
                            profile_picture_url: true
                        }
                    },
                    grounds: {
                        include: {
                            turfs: {
                                select: {
                                    name: true,
                                    city: true
                                }
                            }
                        }
                    }
                }
            }
        },
        orderBy: {
            events: {
                event_date: 'asc'
            }
        }
    });

    const events = participations.map((p) => ({
        ...p.events,
        my_participation: {
            status: p.status,
            payment_status: p.payment_status,
            joined_at: p.joined_at
        }
    }));

    return res.status(200).json(
        new ApiResponse(200, "User events fetched successfully", { events })
    );
});

// NOT ROUTED YET (see routes/event/event.route.js): depends on the PostGIS
// ST_Distance_Sphere function and on event status/visibility enum values that
// haven't been verified against this database. Kept for when geo-search lands.
const getNearbyEvents = asyncHandler(async (req, res) => {
    const { lat, lng, radius = 10 } = req.query; // radius in km

    if (!lat || !lng) {
        return res.status(400).json({
            success: false,
            error: "MISSING_LOCATION",
            message: "Latitude and longitude are required"
        });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusKm = parseFloat(radius);

    if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusKm)) {
        return res.status(400).json({
            success: false,
            error: "INVALID_LOCATION",
            message: "Invalid location parameters"
        });
    }

    try {
        // Using raw SQL for geographic queries
        const events = await pgClient.$queryRaw`
            SELECT 
                e.*,
                t.name as turf_name,
                t.city,
                ST_Distance_Sphere(
                    ST_MakePoint(t.longitude, t.latitude),
                    ST_MakePoint(${longitude}, ${latitude})
                ) / 1000 as distance_km
            FROM events e
            JOIN grounds g ON e.ground_id = g.id
            JOIN turfs t ON g.turf_id = t.id
            WHERE e.status IN ('upcoming', 'ongoing')
                AND e.visibility = 'public'
                AND e.event_date >= CURRENT_DATE
                AND ST_Distance_Sphere(
                    ST_MakePoint(t.longitude, t.latitude),
                    ST_MakePoint(${longitude}, ${latitude})
                ) <= ${radiusKm * 1000}
            ORDER BY distance_km ASC, e.event_date ASC, e.start_time ASC
            LIMIT 50
        `;

        return res.status(200).json(
            new ApiResponse(200, "Nearby events fetched successfully", {
                events,
                search_radius_km: radiusKm,
                center: { lat: latitude, lng: longitude }
            })
        );

    } catch (error) {
        throw new ApiError(500, "Error fetching nearby events");
    }
});

const editEvent = asyncHandler(async (req, res) => {

    const { event_id } = req.params;

    if (!event_id) {
        throw ApiError.fromCode(ERROR_CODES.BAD_REQUEST, {
            message: "An event id is required",
        });
    }

    const event = await pgClient.events.findUnique({
        where: {
            id: event_id
        }
    })

    if (!event) {
        throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_FOUND);
    }

    // Only the organizer may edit the event.
    if (event.organizer_id !== req.user.id) {
        throw ApiError.fromCode(ERROR_CODES.NOT_EVENT_ORGANIZER);
    }

    // NOTE: organizer_id is intentionally NOT editable — ownership can't be
    // transferred through this endpoint.
    const editableFields = [
        "title",
        "description",
        "sport_type",
        "event_type",
        "event_date",
        "start_time",
        "end_time",
        "ground_id",
        "venue_id",
        "max_players",
        "min_players",
        "current_players",
        "skill_level_required",
        "total_cost",
        "cost_split_type",
    ];

    const data = {};

    editableFields.forEach((field) => {
        if (req.body[field] !== undefined) {
            data[field] = req.body[field];
        }
    });

    console.log(data);


    const updatedEvent = await pgClient.events.update({
        where: {
            id: event_id
        },
        data
    })

    if (!updatedEvent) {
        throw new ApiError(500, "Error updating event")
    }

    return res.status(200).json(
        new ApiResponse(200, "Event updated successfully", updatedEvent)
    );

})


// Request to join a match. Every join is a PENDING request that an event admin
// must approve — it does NOT consume a slot or bump current_players yet. Notifies
// all admins (there can be several) plus a confirmation to the requester.
const joinEvent = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { event_id } = req.params;
    if (!event_id) {
        throw ApiError.fromCode(ERROR_CODES.BAD_REQUEST, { message: "An event id is required" });
    }

    const event = await pgClient.events.findUnique({
        where: { id: event_id },
        select: { id: true, title: true, event_date: true, organizer_id: true, max_players: true },
    });
    if (!event) throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_FOUND);
    if (event.organizer_id === userId) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "You are the organizer of this match",
        });
    }

    // Any existing row (pending request OR already approved) blocks a new request.
    const already = await pgClient.event_participants.findFirst({
        where: { event_id, user_id: userId },
        select: { id: true },
    });
    if (already) throw ApiError.fromCode(ERROR_CODES.ALREADY_JOINED);

    // Soft capacity guard: block requests once the approved roster is full.
    // (Hard enforcement is at approval time in acceptJoinRequest.)
    const event_full = await pgClient.events.findUnique({
        where: { id: event_id },
        select: { current_players: true, max_players: true },
    });
    if (event_full.max_players && (event_full.current_players ?? 0) >= event_full.max_players) {
        throw ApiError.fromCode(ERROR_CODES.EVENT_FULL);
    }

    const participant = await pgClient.event_participants.create({
        data: {
            event_id,
            user_id: userId,
            status: "requested",
            role: "player",
            payment_status: "pending",
            joined_at: new Date(),
            approved_at: null,
        },
    });

    const joiner = await pgClient.users.findUnique({
        where: { id: userId },
        select: { first_name: true, last_name: true },
    });
    const joinerName = displayName(joiner);

    // Notify every admin there is a request to review.
    //
    // The REQUESTER gets no notification: sending the request was their own
    // action, so the client toasts it. Persisting "you did the thing you just
    // did" to their bell is noise — see the notification policy in
    // docs/api-guideline.md. They'll get a HIGH-priority one when it's decided.
    await notifyEventAdmins(event_id, {
        type: "event_join_request",
        title: "New join request",
        message: `${joinerName} wants to join "${event.title}"`,
        data: { eventId: event_id, userId },
        priority: "medium",
        action_url: `/events/${event_id}`,
    });

    // Live: the admin panel's request queue updates without a refresh.
    broadcastRoster(event_id);

    return res.status(201).json(new ApiResponse(201, "Join request sent", participant));
});

// List pending join requests for an event (admins only) — powers the approval UI.
const getJoinRequests = asyncHandler(async (req, res) => {
    const adminId = req.user.id;
    const { event_id } = req.params;

    const event = await pgClient.events.findUnique({
        where: { id: event_id },
        select: { id: true },
    });
    if (!event) throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_FOUND);
    if (!(await isEventAdmin(event_id, adminId))) throw ApiError.fromCode(ERROR_CODES.NOT_EVENT_ADMIN);

    const requests = await pgClient.event_participants.findMany({
        where: { event_id, status: "requested" },
        select: {
            id: true,
            user_id: true,
            joined_at: true,
            users: {
                select: { id: true, first_name: true, last_name: true, profile_picture_url: true },
            },
        },
        orderBy: { joined_at: "asc" },
    });

    return res
        .status(200)
        .json(new ApiResponse(200, `${requests.length} pending requests`, { requests }));
});

// Approve a pending join request (admins only). Consumes a slot: flips the row
// to approved and bumps current_players. Notifies the requester, the other
// admins, and aligns the new player's turfmates.
const acceptJoinRequest = asyncHandler(async (req, res) => {
    const adminId = req.user.id;
    const { event_id, user_id } = req.params;

    const event = await pgClient.events.findUnique({
        where: { id: event_id },
        select: { id: true, title: true, event_date: true, max_players: true, current_players: true },
    });
    if (!event) throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_FOUND);
    if (!(await isEventAdmin(event_id, adminId))) throw ApiError.fromCode(ERROR_CODES.NOT_EVENT_ADMIN);

    const request = await pgClient.event_participants.findFirst({
        where: { event_id, user_id, status: "requested" },
        select: { id: true },
    });
    if (!request) throw ApiError.fromCode(ERROR_CODES.JOIN_REQUEST_NOT_FOUND);

    // Hard capacity enforcement at approval time (current_players tracks the
    // approved roster incl. organizer).
    if (event.max_players && (event.current_players ?? 0) >= event.max_players) {
        throw ApiError.fromCode(ERROR_CODES.EVENT_FULL);
    }

    await pgClient.event_participants.update({
        where: { id: request.id },
        data: { status: "approved", approved_at: new Date() },
    });
    await pgClient.events.update({
        where: { id: event_id },
        data: { current_players: { increment: 1 } },
    });

    const requester = await pgClient.users.findUnique({
        where: { id: user_id },
        select: { first_name: true, last_name: true },
    });
    const requesterName = displayName(requester);

    // Tell the requester they're in, notify the other admins, align turfmates.
    await createNotification({
        user_id,
        type: "event_invitation",
        title: "You're in!",
        message: `Your request to join "${event.title}" was approved`,
        data: { eventId: event_id },
        priority: "high",
        action_url: `/events/${event_id}`,
    });
    await notifyEventAdmins(
        event_id,
        {
            type: "event_join_request",
            title: "Join request approved",
            message: `${requesterName} was approved for "${event.title}"`,
            data: { eventId: event_id, userId: user_id },
            priority: "low",
            action_url: `/events/${event_id}`,
        },
        [adminId] // don't notify the admin who took the action
    );
    await broadcastToTurfmates(user_id, {
        type: "event_invitation",
        title: "A turfmate joined a match",
        message: `${requesterName} joined "${event.title}" — jump in with them`,
        data: { eventId: event_id },
        priority: eventPriorityByDate(event.event_date),
        action_url: `/events/${event_id}`,
    });

    // Live: requester drops out of the queue and into the squad for all viewers.
    broadcastRoster(event_id);

    return res.status(200).json(new ApiResponse(200, "Join request approved", { event_id, user_id }));
});

// Reject a pending join request (admins only). Marks it rejected and notifies
// the requester + the other admins.
const rejectJoinRequest = asyncHandler(async (req, res) => {
    const adminId = req.user.id;
    const { event_id, user_id } = req.params;

    const event = await pgClient.events.findUnique({
        where: { id: event_id },
        select: { id: true, title: true },
    });
    if (!event) throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_FOUND);
    if (!(await isEventAdmin(event_id, adminId))) throw ApiError.fromCode(ERROR_CODES.NOT_EVENT_ADMIN);

    const request = await pgClient.event_participants.findFirst({
        where: { event_id, user_id, status: "requested" },
        select: { id: true },
    });
    if (!request) throw ApiError.fromCode(ERROR_CODES.JOIN_REQUEST_NOT_FOUND);

    await pgClient.event_participants.update({
        where: { id: request.id },
        data: { status: "rejected" },
    });

    // High, like the approval: this is the decision the requester has been waiting
    // on, so it earns a toast as well as a bell entry. (Their own "request sent"
    // action does NOT — the client toasts that locally.)
    await createNotification({
        user_id,
        type: "event_join_request",
        title: "Request declined",
        message: `Your request to join "${event.title}" was declined`,
        data: { eventId: event_id },
        priority: "high",
        action_url: `/events/${event_id}`,
    });
    await notifyEventAdmins(
        event_id,
        {
            type: "event_join_request",
            title: "Join request declined",
            message: `A request for "${event.title}" was declined`,
            data: { eventId: event_id, userId: user_id },
            priority: "low",
            action_url: `/events/${event_id}`,
        },
        [adminId]
    );

    broadcastRoster(event_id);

    return res.status(200).json(new ApiResponse(200, "Join request rejected", { event_id, user_id }));
});

// Withdraw your OWN pending join request (requester only). A pending request
// never consumed a slot, so there's nothing to decrement — just delete it and
// let the admins know so their queue stays clean.
const cancelJoinRequest = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { event_id } = req.params;
    if (!event_id) {
        throw ApiError.fromCode(ERROR_CODES.BAD_REQUEST, { message: "An event id is required" });
    }

    const request = await pgClient.event_participants.findFirst({
        where: { event_id, user_id: userId, status: "requested" },
        select: { id: true },
    });
    if (!request) throw ApiError.fromCode(ERROR_CODES.JOIN_REQUEST_NOT_FOUND);

    await pgClient.event_participants.delete({ where: { id: request.id } });

    const event = await pgClient.events.findUnique({
        where: { id: event_id },
        select: { title: true },
    });
    await notifyEventAdmins(
        event_id,
        {
            type: "event_join_request",
            title: "Join request withdrawn",
            message: `A player withdrew their request${event ? ` for "${event.title}"` : ""}`,
            data: { eventId: event_id, userId },
            priority: "low",
            action_url: `/events/${event_id}`,
        },
        [userId]
    );

    broadcastRoster(event_id);

    return res.status(200).json(new ApiResponse(200, "Join request cancelled", { event_id }));
});

// Grant event-admin (co_organizer) to an approved participant. ORGANIZER ONLY —
// only the creator can mint admins. Notifies the new admin + existing admins.
const grantEventAdmin = asyncHandler(async (req, res) => {
    const organizerId = req.user.id;
    const { event_id } = req.params;
    const { user_id } = req.body;
    if (!user_id) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "user_id is required" });
    }

    const event = await pgClient.events.findUnique({
        where: { id: event_id },
        select: { id: true, title: true, organizer_id: true },
    });
    if (!event) throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_FOUND);
    if (event.organizer_id !== organizerId) throw ApiError.fromCode(ERROR_CODES.NOT_EVENT_ORGANIZER);
    if (user_id === organizerId) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "You are already the organizer",
        });
    }

    // Only an APPROVED participant can be promoted.
    const participant = await pgClient.event_participants.findFirst({
        where: { event_id, user_id, status: "approved" },
        select: { id: true, role: true },
    });
    if (!participant) throw ApiError.fromCode(ERROR_CODES.NOT_EVENT_PARTICIPANT);
    if (participant.role === "co_organizer") throw ApiError.fromCode(ERROR_CODES.ALREADY_ADMIN);

    await pgClient.event_participants.update({
        where: { id: participant.id },
        data: { role: "co_organizer" },
    });

    await createNotification({
        user_id,
        type: "event_invitation",
        title: "You're now a match admin",
        message: `You can review join requests for "${event.title}"`,
        data: { eventId: event_id },
        priority: "high",
        action_url: `/events/${event_id}`,
    });
    // Notify the other admins (exclude organizer + the newly promoted user).
    await notifyEventAdmins(
        event_id,
        {
            type: "event_invitation",
            title: "New match admin",
            message: `A new admin was added to "${event.title}"`,
            data: { eventId: event_id, userId: user_id },
            priority: "low",
            action_url: `/events/${event_id}`,
        },
        [organizerId, user_id]
    );

    return res.status(200).json(new ApiResponse(200, "Admin granted", { event_id, user_id }));
});

// Revoke event-admin, demoting a co_organizer back to player. ORGANIZER ONLY.
const revokeEventAdmin = asyncHandler(async (req, res) => {
    const organizerId = req.user.id;
    const { event_id, user_id } = req.params;

    const event = await pgClient.events.findUnique({
        where: { id: event_id },
        select: { id: true, title: true, organizer_id: true },
    });
    if (!event) throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_FOUND);
    if (event.organizer_id !== organizerId) throw ApiError.fromCode(ERROR_CODES.NOT_EVENT_ORGANIZER);

    const participant = await pgClient.event_participants.findFirst({
        where: { event_id, user_id, role: "co_organizer" },
        select: { id: true },
    });
    if (!participant) throw ApiError.fromCode(ERROR_CODES.NOT_EVENT_ADMIN);

    await pgClient.event_participants.update({
        where: { id: participant.id },
        data: { role: "player" },
    });

    await createNotification({
        user_id,
        type: "event_invitation",
        title: "Admin access removed",
        message: `You are no longer an admin for "${event.title}"`,
        data: { eventId: event_id },
        priority: "low",
        action_url: `/events/${event_id}`,
    });

    return res.status(200).json(new ApiResponse(200, "Admin revoked", { event_id, user_id }));
});

// Leave a match the caller previously joined (an APPROVED participant).
const leaveEvent = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { event_id } = req.params;
    if (!event_id) {
        throw ApiError.fromCode(ERROR_CODES.BAD_REQUEST, { message: "An event id is required" });
    }

    const participant = await pgClient.event_participants.findFirst({
        where: { event_id, user_id: userId },
        select: { id: true, status: true },
    });
    if (!participant) throw ApiError.fromCode(ERROR_CODES.NOT_EVENT_PARTICIPANT);

    await pgClient.event_participants.delete({ where: { id: participant.id } });

    // Only an APPROVED participant occupied a slot; a still-pending request never
    // bumped the counter, so don't decrement for those. Clamp at 0 (GREATEST) so
    // the counter can't go negative if data ever drifts out of sync.
    if (participant.status === "approved") {
        await pgClient.$executeRaw`
            UPDATE events SET current_players = GREATEST(current_players - 1, 0) WHERE id = ${event_id}::uuid
        `;
    }

    broadcastRoster(event_id);

    return res.status(200).json(new ApiResponse(200, "Left match", { event_id }));
});

export {
    createEvent,
    getEvents,
    deleteEvent,
    getUserEvents,
    getNearbyEvents,
    getEventById,
    editEvent,
    joinEvent,
    leaveEvent,
    getJoinRequests,
    acceptJoinRequest,
    rejectJoinRequest,
    cancelJoinRequest,
    grantEventAdmin,
    revokeEventAdmin
}