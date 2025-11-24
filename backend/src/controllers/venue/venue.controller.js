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

const getVenues = asyncHandler(async (req, res) => {


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


export {
    getVenues,
    getVenueById
}