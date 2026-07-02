import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";
import { pgClient } from "../../prisma.js";
import { EventSerializer } from "../../utils/dataSerializer.js";


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

    const eventParticipantData = current_players.map((player) => ({
        event_id: createdEvent.id,
        user_id: player.value,
        payment_status: 'pending',
        joined_at: createdEvent.created_at,
        approved_at: null
    }))

    const insertEventParticipants = await pgClient.event_participants.createMany({
        data: eventParticipantData,
        skipDuplicates: true
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

    return res.status(200).json(
        new ApiResponse(200, `${events.length} events found`, {
            events,
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

    const players_joined = await pgClient.event_participants.findMany({
        where: {
            event_id: event.id
        }
    })



    if (!players_joined) {
        throw new ApiError(404, "Error getting event players")
    }

    const response = EventSerializer.toDto({
        ...event,
        event_participants: players_joined
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


export {
    createEvent,
    getEvents,
    deleteEvent,
    getUserEvents,
    getNearbyEvents,
    getEventById,
    editEvent
}