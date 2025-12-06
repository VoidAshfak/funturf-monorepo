import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { pgClient } from "../../prisma.js";


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
        throw new ApiError(400, "A required field is missing");
    }

    const createdEvents = await pgClient.$queryRaw
        `
    SELECT * FROM fn_create_event(
        ${organizer_id || req.user?.id || "8806583a-1630-4ab3-a93b-94f5f432cc14"}::uuid,
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

const getEvents = asyncHandler(async (req, res) => {
    const events = await pgClient.events.findMany({
        select: {
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
                            address_line_1: true
                        }
                    }
                }
            },
            organizer_id: true,
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
                    status: true
                }
            },
            
        }
    })

    if (!events) {
        throw new ApiError(404, "No events found");
    }

    return res.status(200).json(new ApiResponse(200, `${events.length} events found`, events));
})

const getEventById = asyncHandler(async (req, res) => {
    const { event_id } = req.params;

    if (!event_id) {
        throw new ApiError(400, "Bad request. You need to provide a event id.")
    }

    const event = await pgClient.events.findUnique({
        where: {
            id: event_id
        }
    })

    if (!event) {
        throw new ApiError(404, "Event not found.")
    }

    const palyers_joined = await pgClient.event_participants.findMany({
        where: {
            event_id: event.id
        }
    })

    console.log(palyers_joined);


    if (!palyers_joined) {
        throw new ApiError(404, "Error getting event players")
    }

    const response = {
        ...event,
        palyers_joined
    }

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
        throw new ApiError(400, "The event doesn't exiss.")
    }

    if (existingEvent.organizer_id !== user_id) {
        throw new ApiError(400, "You are not authorized to delete this event.")
    }

    const deletedEventResponse = await pgClient.events.delete({
        where: {
            id: event_id,
            // organizerId: user_id
        }
    })

    if (!deletedEventResponse) {
        throw new ApiError(400, "There was an error deleting  the event");
    }

    return res.status(200).json(new ApiResponse(200, "Event deleted successfully", deletedEventResponse));
});

const getUserEvents = asyncHandler(async (req, res) => {

    const userId = req.user.id;
    const { role, status } = req.query;

    const where = {
        user_id: userId
    };

    if (role) where.role = role;
    if (status) where.status = status;

    try {
        const participations = await pgClient.event_participants.findMany({
            where,
            include: {
                event: {
                    include: {
                        organizer: {
                            select: {
                                id: true,
                                first_name: true,
                                last_name: true,
                                profile_picture_url: true
                            }
                        },
                        ground: {
                            include: {
                                turf: {
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
                event: {
                    event_date: 'asc'
                }
            }
        });

        const events = participations.map(p => ({
            ...p.event,
            my_participation: {
                status: p.status,
                role: p.role,
                team: p.team,
                joined_at: p.joined_at
            }
        }));

        return res.status(200).json(
            new ApiResponse(200, "User events fetched successfully", { events })
        );

    } catch (error) {
        throw new ApiError(500, "Error fetching user events");
    }
});

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
        throw new ApiError(400, "Bad request. You need to provide a event id.")
    }

    const event = await pgClient.events.findUnique({
        where: {
            id: event_id
        }
    })

    if (!event) {
        throw new ApiError(404, "Event not found.")
    }

    const editableFields = [
        "organizer_id",
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

    if(!updatedEvent) {
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