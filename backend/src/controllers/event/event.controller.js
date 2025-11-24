import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { mongoClient, pgClient } from "../../prisma.js";


const createEvent = asyncHandler(async (req, res) => {
    const {
        organizer_id,
        booking_id,
        title,
        description,
        sport_type,
        event_type,
        event_date,
        start_time,
        end_time,
        ground_id,
        venue_id,
        max_palyers,
        min_Players,
        skill_level_required,
        age_group,
        gender_preference,
        entry_fee,
        total_cost,
        cost_split_type,
        visibility,
        join_approval_required,
        ruels
    } = req.body

    // if (!title || !sport || !date || !venueId || !playersRequired) {
    //     throw new ApiError(400, "A required field is missing");
    // }

    const createdEvent = await mongoClient.event.create({
        data: {
            title,
            description,
            organizerId: req.user.id,
            sport,
            date,
            playersRequired,
            playersJoined,
        }
    })

    if (!createdEvent) {
        throw new ApiError(200, "Event creation failed!")
    }

    return res.status(200).json(new ApiResponse(200, "Event created successfully", createdEvent));

})

const getEvents = asyncHandler(async (req, res) => {
    // 1. Input validation and sanitization
    const rawLimit = Number(req.query.limit ?? 10);
    const limit = isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 10;

    // const rawOffset = Number(req.query.offset ?? 0);
    // const offset = isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

    // 2. Parse cursor properly
    const cursorStr = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    let cursor = undefined;

    if (cursorStr) {
        const splitAt = cursorStr.lastIndexOf("_");
        if (splitAt === -1) {
            return res.status(400).json({
                success: false,
                error: "BAD_CURSOR",
                message: "Invalid cursor format"
            });
        }

        const eventDateStr = cursorStr.slice(0, splitAt);
        const id = cursorStr.slice(splitAt + 1);
        const eventDate = new Date(eventDateStr);

        if (!id || Number.isNaN(eventDate.getTime())) {
            return res.status(400).json({
                success: false,
                error: "BAD_CURSOR",
                message: "Invalid cursor value"
            });
        }
        cursor = { eventDate, id };
    }

    // 3. Build where clause with proper validation
    const where = {};

    // Date range filter with validation
    if (req.query.from || req.query.to) {
        const fromDate = req.query.from ? new Date(req.query.from) : null;
        const toDate = req.query.to ? new Date(req.query.to) : null;

        // Validate dates
        if (fromDate && Number.isNaN(fromDate.getTime())) {
            return res.status(400).json({
                success: false,
                error: "INVALID_DATE",
                message: "Invalid 'from' date format"
            });
        }
        if (toDate && Number.isNaN(toDate.getTime())) {
            return res.status(400).json({
                success: false,
                error: "INVALID_DATE",
                message: "Invalid 'to' date format"
            });
        }

        where.event_date = {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
        };
    }

    // Enum validations
    const validEventTypes = ['friendly', 'tournament', 'practice', 'league', 'pickup'];
    const validVisibility = ['public', 'private', 'friends_only'];
    const validStatus = ['draft', 'upcoming', 'ongoing', 'completed', 'cancelled'];
    const validGenderPrefs = ['any', 'male', 'female', 'mixed'];
    const validSkillLevels = ['any', 'beginner', 'intermediate', 'advanced', 'professional'];

    if (req.query.sport_type) {
        where.sport_type = req.query.sport_type;
    }

    if (req.query.event_type) {
        if (!validEventTypes.includes(req.query.event_type)) {
            return res.status(400).json({
                success: false,
                error: "INVALID_EVENT_TYPE",
                message: `Event type must be one of: ${validEventTypes.join(', ')}`
            });
        }
        where.event_type = req.query.event_type;
    }

    if (req.query.visibility) {
        if (!validVisibility.includes(req.query.visibility)) {
            return res.status(400).json({
                success: false,
                error: "INVALID_VISIBILITY",
                message: `Visibility must be one of: ${validVisibility.join(', ')}`
            });
        }
        where.visibility = req.query.visibility;
    }

    if (req.query.organizer_id) {
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(req.query.organizer_id)) {
            return res.status(400).json({
                success: false,
                error: "INVALID_ORGANIZER_ID",
                message: "Organizer ID must be a valid UUID"
            });
        }
        where.organizer_id = req.query.organizer_id;
    }

    if (req.query.status) {
        if (!validStatus.includes(req.query.status)) {
            return res.status(400).json({
                success: false,
                error: "INVALID_STATUS",
                message: `Status must be one of: ${validStatus.join(', ')}`
            });
        }
        where.status = req.query.status;
    }

    if (req.query.gender_preference) {
        if (!validGenderPrefs.includes(req.query.gender_preference)) {
            return res.status(400).json({
                success: false,
                error: "INVALID_GENDER_PREFERENCE",
                message: `Gender preference must be one of: ${validGenderPrefs.join(', ')}`
            });
        }
        where.gender_preference = req.query.gender_preference;
    }

    if (req.query.skill_level_required) {
        if (!validSkillLevels.includes(req.query.skill_level_required)) {
            return res.status(400).json({
                success: false,
                error: "INVALID_SKILL_LEVEL",
                message: `Skill level must be one of: ${validSkillLevels.join(', ')}`
            });
        }
        where.skill_level_required = req.query.skill_level_required;
    }

    // Search filters
    if (req.query.venue_name) {
        where.OR = [
            { venue_name: { contains: req.query.venue_name, mode: "insensitive" } },
            { venue_address: { contains: req.query.venue_name, mode: "insensitive" } }
        ];
    }

    // Location-based filter (if latitude/longitude provided)
    if (req.query.lat && req.query.lng && req.query.radius) {
        const lat = parseFloat(req.query.lat);
        const lng = parseFloat(req.query.lng);
        const radius = parseFloat(req.query.radius); // in km

        if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
            return res.status(400).json({
                success: false,
                error: "INVALID_LOCATION",
                message: "Invalid location parameters"
            });
        }

        // This would require a raw query or PostGIS extension
        // Adding as a comment for future implementation
        // where._raw_location = { lat, lng, radius };
    }

    // 4. Add cursor-based pagination
    if (cursor) {
        where.OR = [
            { event_date: { gt: cursor.eventDate } },
            {
                AND: [
                    { event_date: cursor.eventDate },
                    { id: { gt: cursor.id } }
                ]
            }
        ];
    }

    // 5. Default to show only upcoming/ongoing events unless status specified
    if (!req.query.status && !req.query.include_past) {
        where.status = { in: ['upcoming', 'ongoing'] };
        // Also filter by date if not showing past events
        if (!where.event_date) {
            where.event_date = { gte: new Date() };
        }
    }
    
    console.log(where);
    console.log(cursor);


    try {
        // 6. Fetch events with related data
        const events = await pgClient.events.findMany({
            where,
            // include: {
            //     organizer: {
            //         select: {
            //             id: true,
            //             first_name: true,
            //             last_name: true,
            //             profile_picture_url: true
            //         }
            //     },
            //     ground: {
            //         include: {
            //             turf: {
            //                 select: {
            //                     id: true,
            //                     name: true,
            //                     city: true,
            //                     latitude: true,
            //                     longitude: true
            //                 }
            //             }
            //         }
            //     },
            //     event_participants: {
            //         where: {
            //             status: 'approved'
            //         },
            //         select: {
            //             user_id: true,
            //             role: true,
            //             team: true
            //         }
            //     },
            //     _count: {
            //         select: {
            //             event_participants: {
            //                 where: {
            //                     status: 'approved'
            //                 }
            //             },
            //             event_comments: true
            //         }
            //     }
            // },
            orderBy: [
                { event_date: "asc" },
                { start_time: "asc" },
                { id: "asc" } // Add ID for stable sorting
            ],
            take: limit + 1, // Fetch one extra to check hasMore
            skip: cursor ? 1 : 0, // Skip the cursor item if using cursor
        });

        // 7. Process results
        const hasMore = events.length > limit;
        const items = hasMore ? events.slice(0, limit) : events;

        // 8. Transform data for response
        const transformedEvents = items.map(event => ({
            ...event,
            slots_available: event.max_players - event.current_players,
            is_full: event.current_players >= event.max_players,
            // Remove _count from response
            _count: undefined
        }));

        // 9. Generate next cursor
        const last = items.at(-1);
        const nextCursor = last ? `${last.event_date.toISOString()}_${last.id}` : null;

        // 10. Return proper response
        return res.status(200).json(
            new ApiResponse(
                200,
                "Events fetched successfully",
                {
                    events: transformedEvents,
                    pagination: {
                        limit,
                        hasMore,
                        nextCursor,
                        total: hasMore ? null : items.length // Don't expose total count for performance
                    },
                    filters: {
                        applied: Object.keys(where).length > 0,
                        ...req.query
                    }
                }
            )
        );

    } catch (error) {
        console.error("Error fetching events:", error);

        // 11. Proper error handling - throw the error to be caught by asyncHandler
        throw new ApiError(
            500,
            "Error occurred when getting the events",
        );
    }
});


const getUserEvents = asyncHandler(async (req, res) => {
    const userId = req.user.id; // Assuming user is attached to req by auth middleware
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

const getEventById = asyncHandler(async (req, res) => {
    const { event_id } = req.params;
    try {
        const event = await pgClient.events.findUnique({
            where: {
                id: event_id
            }
        });

        if (!event) {
            res.status(404).json({ error: "Event not found" });
        }

        return res
            .status(200)
            .json(new ApiResponse(
                200,
                "Event found",
                event
            ));
    } catch (error) {
        throw new ApiError(500, "Error getting the event");
    }
})


const deleteEvent = asyncHandler(async (req, res) => {
    const eventId = req.body.eventId;
    const userId = req.user.id;

    const eventExists = await mongoClient.event.findFirst({
        where: {
            id: eventId,
            organizerId: userId
        }
    })
    if (eventExists) {
        throw new ApiError(400, "The event doesn't exiss.")
    }
    const deletedEventResponse = await mongoClient.event.delete({
        where: {
            id: eventId,
            organizerId: userId
        }
    })

    if (!deletedEventResponse) {
        throw new ApiError(400, "There was an error deleting  the event");
    }
    return res.status(200).json(new ApiResponse(200, "Event deleted successfully"));
});



export {
    createEvent,
    getEvents,
    deleteEvent,
    getUserEvents,
    getNearbyEvents,
    getEventById
}