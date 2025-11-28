import { pgClient } from '../../prisma.js';
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";


// const getVenues = asyncHandler(async (req, res) => {
//     const rawLimit = Number(req.query.limit ?? 10);
//     const limit = isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 10;



//     const cursorStr = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

//     // cursorStr format: "<isoDate>_<id>"
//     let cursor = undefined;
//     const where = {};

//     if (cursorStr) {
//         const splitAt = cursorStr.lastIndexOf("_");
//         if (splitAt === -1) {
//             return res.status(400).json({
//                 success: false,
//                 error: "BAD_CURSOR",
//                 message: "Invalid cursor format"
//             });
//         }

//         const creationDateStr = cursorStr.slice(0, splitAt);
//         const id = cursorStr.slice(splitAt + 1);
//         const createdDate = new Date(creationDateStr);

//         if (!id || Number.isNaN(createdDate.getTime())) {
//             return res.status(400).json({
//                 success: false,
//                 error: "BAD_CURSOR",
//                 message: "Invalid cursor value"
//             });
//         }
//         cursor = { createdDate, id };
//     }


//     if (cursor) {
//         where.OR = [
//             { created_at: { gt: cursor.createdDate } },
//             {
//                 AND: [
//                     { created_at: cursor.createdDate },
//                     { id: { gt: cursor.id } }
//                 ]
//             }
//         ];
//     }

//     if (req.query.venue_name) {
//         where.OR = [
//             { name: { contains: req.query.venue_name, mode: "insensitive" } },
//             { address_line_1: { contains: req.query.venue_name, mode: "insensitive" } },
//             { address_line_2: { contains: req.query.venue_name, mode: "insensitive" } }
//         ];
//     }

//     if (req.query.sports_available) {
//         where.sports_available = {
//             has: req.query.sports_available
//         }
//     }

//     if (req.query.rating) {
//         where.rating = {
//             gte: req.query.rating
//         }
//     }

//     if (req.query.city) {
//         where.city = { contains: req.query.venue_name, mode: "insensitive" }
//     }


//     where.NOT = [
//         { status: 'pending_approval' }
//     ]

//     // console.log(cursor);
//     console.log(where);


//     try {
//         const venues = await pgClient.turfs.findMany({
//             where,
//             orderBy: [
//                 { created_at: "asc" },
//                 {id: 'asc'},
//                 { rating: "desc" }
//             ],
//             take: limit + 1,
//             skip: cursor ? 1 : 0
//         });

//         console.log(venues);

//         const hasMore = venues.length > limit;
//         console.log("Has more", hasMore);

//         const items = hasMore ? venues.slice(0, limit) : venues;
//         console.log("This is the items array:", items);


//         const last = items.at(-1);
//         const nextCursor = last ? `${last.created_at.toISOString()}_${last.id}` : null;


//         return res.status(200).json(
//             new ApiResponse(
//                 200,
//                 "Turfs fetched successfully",
//                 {
//                     venues: items,
//                     pagination: {
//                         limit,
//                         hasMore,
//                         nextCursor,
//                         total: hasMore ? null : items.length
//                     },
//                     filters: {
//                         applied: Object.keys(where).length > 0,
//                         ...req.query
//                     }
//                 }
//             )
//         );
//     } catch (error) {
//         console.error("Error fetching venues:", error);
//         throw new ApiError(
//             500,
//             "Error occurred when getting the venues",
//             error
//         );
//     }

// })

const getVenueList = asyncHandler(async (req, res) => {
    const venues = await pgClient.turfs.findMany({
        select: {
            id: true,
            name: true,
            grounds: {
                select: {
                    id: true,
                    name: true,
                    sport_type: true
                }
            }
        }
    })

    if (!venues) throw new ApiError(404, "Not found");

    return res.json(new ApiResponse(200, `Found ${venues.length} turfs`, venues));
})

const getVenues = asyncHandler(async (req, res) => {

    const venues = await pgClient.turfs.findMany({
        omit: {
            advance_booking_days: true,
            holiday_dates: true,
        }
    })

    if (!venues) throw new ApiError(404, "Not found");

    return res.json(new ApiResponse(200, `Found ${venues.length} turfs`, venues));
})

const getVenueById = asyncHandler(async (req, res) => {
    const { venue_id } = req.params;
    try {
        const venue = await pgClient.turfs.findUnique({
            where: {
                id: venue_id
            }
        });

        if (!venue) {
            res.status(404).json({ error: "Venue not found" });
        }

        return res
            .status(200)
            .json(new ApiResponse(
                200,
                "Venue found",
                venue
            ));
    } catch (error) {
        throw new ApiError(500, "Error getting the venue");
    }
});

const createVenue = asyncHandler(async (req, res) => {
    const {
        name,
        description,
        address_line_1,
        address_line_2,
        phone,
        email,
        website_url,
        establishment_year,
        rules_and_regulations,
        cancellation_policy,
        advance_booking_days,
        sports_available,
        facilities,
        rating,
        operating_hours,
        images,
        grounds,
    } = req.body;

    // if (
    //     !name
    //     || !description
    //     || !address_line_1
    //     || !address_line_2
    //     || !phone
    //     || !email
    //     || !website_url
    //     || !establishment_year
    //     || !rules_and_regulations
    //     || !cancellation_policy
    //     || !advance_booking_days
    //     || !sports_available
    //     || !facilities
    //     || !rating
    //     || !operating_hours
    //     || !images
    //     || !grounds
    // ) {
    //     throw new ApiError(400, "A required field is missing");
    // }

    const isArray = Array.isArray(grounds);
    const isGroundsValid = Array.isArray(grounds) && grounds.every(ground => (
        ground &&
        typeof ground === "object" &&
        ground.hasOwnProperty("name") &&
        ground.hasOwnProperty("ground_type") &&
        ground.hasOwnProperty("sport_type") &&
        ground.hasOwnProperty("surface_type") &&
        ground.hasOwnProperty("dimensions_length_m") &&
        ground.hasOwnProperty("dimensions_width_m") &&
        ground.hasOwnProperty("capacity_players") &&
        ground.hasOwnProperty("hourly_rate") &&
        ground.hasOwnProperty("weekend_hourly_rate") &&
        ground.hasOwnProperty("peak_hour_rate") &&
        ground.hasOwnProperty("off_peak_hour_rate") &&
        ground.hasOwnProperty("currency") &&
        ground.hasOwnProperty("minimum_booking_hours") &&
        ground.hasOwnProperty("maximum_booking_hours") &&
        ground.hasOwnProperty("amenities") &&
        ground.hasOwnProperty("images") &&
        ground.hasOwnProperty("notes")
    ));

    if (!isArray || !isGroundsValid) {
        throw new ApiError(400, "Invalid ground data");
    }

    const venue = {
        admin_user_id: req.user?.id || "8806583a-1630-4ab3-a93b-94f5f432cc14",
        name,
        slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
        description,
        address_line_1: `${address_line_1.city}, ${address_line_1.state}`,
        address_line_2,
        city: address_line_1.city,
        state: address_line_1.state,
        country: address_line_1.country,
        postal_code: address_line_1.postal_code,
        latitude: Number(address_line_1.latitude),
        longitude: Number(address_line_1.longitude),
        phone,
        email,
        website_url,
        establishment_year: Number(establishment_year),
        total_grounds: grounds.length,
        facilities,
        sports_available,
        rules_and_regulations,
        cancellation_policy,
        status: "pending_approval",
        verified: false,
        rating: Number(rating),
        total_bookings: 0,
        operating_hours: {
            open: operating_hours.opening_time,
            close: operating_hours.closing_time
        },
        images
    }

    const venueCreated = await pgClient.turfs.create({
        data: venue
    })

    if (!venueCreated) {
        throw new ApiError(500, "Error creating new venue");
    }

    const numericFields = [
        "capacity_players",
        "hourly_rate",
        "weekend_hourly_rate",
        "peak_hour_rate",
        "off_peak_hour_rate",
        "minimum_booking_hours",
        "maximum_booking_hours",
        "dimensions_length_m",
        "dimensions_width_m"
    ];

    function castGroundNumbers(ground) {
        const result = { ...ground };

        numericFields.forEach((field) => {
            if (result[field] === "" || result[field] === null || result[field] === undefined) {
                result[field] = null;
            } else {
                const num = Number(result[field]);
                result[field] = Number.isNaN(num) ? null : num; // or throw error if you want strict
            }
        });

        return result;
    }

    await pgClient.grounds.createMany({
        data: grounds.map((ground) => ({
            ...castGroundNumbers(ground),
            turf_id: venueCreated.id
        })),
        skipDuplicates: true
    });


    return res.status(201).json(new ApiResponse(201, "New venue created successfully", venueCreated));

})


const createGround = asyncHandler(async (req, res) => {
    const {
        name,
        ground_type,
        sport_type,
        surface_type,
        dimensions_length_m,
        dimensions_width_m,
        capacity_players,
        hourly_rate,
        weekend_hourly_rate,
        peak_hour_rate,
        off_peak_hour_rate,
        currency,
        minimum_booking_hours,
        maximum_booking_hours,
        amenities,
        images,
        notes
    } = req.body

    if (
        !name
        || !ground_type
        || !sport_type
        || !surface_type
        || !dimensions_length_m
        || !dimensions_width_m
        || !capacity_players
        || !hourly_rate
        || !weekend_hourly_rate
        || !peak_hour_rate
        || !off_peak_hour_rate
        || !currency
        || !minimum_booking_hours
        || !maximum_booking_hours
        || !amenities
        || !images
        || !notes
    ) {
        throw new ApiError(400, "A required field for ground is missing.");
    }

    const groundCreated = await pgClient.grounds.create({
        data: {
            name,
            ground_type,
            sport_type,
            surface_type,
            dimensions_length_m,
            dimensions_width_m,
            capacity_players,
            hourly_rate,
            weekend_hourly_rate,
            peak_hour_rate,
            off_peak_hour_rate,
            currency,
            minimum_booking_hours,
            maximum_booking_hours,
            status: "available",
            amenities,
            images,
            notes
        }
    })

    if (!groundCreated) {
        throw new ApiError(500, "Error creating new ground");
    }

    return res.status(201).json(
        new ApiResponse(201, "New ground created successfully", groundCreated)
    )
})

export {
    getVenues,
    getVenueList,
    getVenueById,
    createVenue,
    createGround
}