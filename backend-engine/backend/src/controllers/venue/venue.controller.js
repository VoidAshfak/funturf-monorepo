import { pgClient } from '../../prisma.js';
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";
import { VenueSerializer } from "../../utils/dataSerializer.js"
import { logger } from "../../../logs/logger.js";


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
        select: {
            id: true,
            name: true,
            images: true,
            operating_hours: true,
            rating: true,
            city: true,
            state: true,
            postal_code: true,
            country: true,
            latitude: true,
            longitude: true,
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

    const response = venues.map((venue) => VenueSerializer.toVenueListDto(venue));
    
    return res.json(new ApiResponse(200, `Found ${venues.length} turfs`, response));
})

// Optionally authenticated (attachUserIfPresent): when a token is present the DTO
// also carries `my_rating` so the client can pre-fill the caller's own star rating.
const getVenueById = asyncHandler(async (req, res) => {
    const { venue_id } = req.params;
    const venue = await pgClient.turfs.findUnique({
        where: {
            id: venue_id
        },
        include: {
            grounds: true
        }
    });

    if (!venue) {
        throw new ApiError(404, "Venue not found");
    }

    // Live rating aggregate from approved TURF reviews (source of truth), plus the
    // caller's own rating when signed in — both feed the interactive star widget.
    const [agg, mine] = await Promise.all([
        pgClient.reviews.aggregate({
            where: { turf_id: venue_id, review_type: "turf", status: "approved" },
            _avg: { rating: true },
            _count: { _all: true },
        }),
        req.user?.id
            ? pgClient.reviews.findFirst({
                  where: { turf_id: venue_id, reviewer_id: req.user.id, review_type: "turf" },
                  select: { rating: true },
              })
            : null,
    ]);

    const dto = VenueSerializer.toDto(venue);
    // Prefer the live average; fall back to the stored turfs.rating.
    dto.rating = agg._avg.rating != null
        ? Math.round(Number(agg._avg.rating) * 10) / 10
        : dto.rating;
    dto.rating_count = agg._count._all;
    dto.my_rating = mine?.rating ?? null;

    return res
        .status(200)
        .json(new ApiResponse(200, "Venue found", dto));
}
);

// Rate a turf (1–5 stars). ONE rating per user per turf — enforced as an upsert on
// (reviewer_id, turf_id, review_type='turf'): the first call creates it, later calls
// UPDATE the same row, so a user can raise or lower their score but never stack
// multiple. After writing, the turf's stored `rating` is recomputed as the average
// of all approved turf reviews. Auth required (reviewer identity from the token).
const rateTurf = asyncHandler(async (req, res) => {
    const { venue_id } = req.params;
    const reviewerId = req.user.id;
    const { comment, title } = req.body;

    // Validate the score: integer 1..5.
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "Rating must be a whole number from 1 to 5",
        });
    }

    // The turf must exist before we attach a review to it.
    const turf = await pgClient.turfs.findUnique({
        where: { id: venue_id },
        select: { id: true },
    });
    if (!turf) throw new ApiError(404, "Venue not found");

    // Upsert the caller's single turf review.
    const existing = await pgClient.reviews.findFirst({
        where: { turf_id: venue_id, reviewer_id: reviewerId, review_type: "turf" },
        select: { id: true },
    });

    if (existing) {
        await pgClient.reviews.update({
            where: { id: existing.id },
            data: {
                rating,
                comment: comment ?? undefined,
                title: title ?? undefined,
                updated_at: new Date(),
            },
        });
    } else {
        await pgClient.reviews.create({
            data: {
                reviewer_id: reviewerId,
                turf_id: venue_id,
                review_type: "turf",
                rating,
                comment: comment ?? null,
                title: title ?? null,
                status: "approved",
            },
        });
    }

    // Recompute the turf's headline rating from all approved turf reviews.
    const agg = await pgClient.reviews.aggregate({
        where: { turf_id: venue_id, review_type: "turf", status: "approved" },
        _avg: { rating: true },
        _count: { _all: true },
    });
    const avg = agg._avg.rating != null ? Math.round(Number(agg._avg.rating) * 100) / 100 : 0;
    await pgClient.turfs.update({
        where: { id: venue_id },
        data: { rating: avg },
    });

    logger.info(
        `turf ${venue_id} rated ${rating} by ${reviewerId} (${existing ? "updated" : "created"}); avg=${avg} n=${agg._count._all}`
    );

    return res.status(200).json(
        new ApiResponse(200, existing ? "Rating updated" : "Thanks for rating!", {
            venue_id,
            my_rating: rating,
            rating: Math.round(avg * 10) / 10,
            rating_count: agg._count._all,
        })
    );
});

const createVenue = asyncHandler(async (req, res) => {
    // One turf per turf_admin. A turf_admin owns exactly one turf and adds
    // GROUNDS to it (see createGround) rather than multiple turfs. super_admin is
    // a platform moderator, not a turf owner, so it isn't capped here.
    if (req.user.user_type === "turf_admin") {
        const existing = await pgClient.turfs.findFirst({
            where: { admin_user_id: req.user.id },
            select: { id: true },
        });
        if (existing) throw ApiError.fromCode(ERROR_CODES.TURF_ALREADY_EXISTS);
    }

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

    // ---- validation stays OUTSIDE the transaction ----
    // Required set mirrors the DB NOT NULL columns only (everything else is
    // nullable): turf name + address (area/district/division) + >=1 ground.
    if (!name || !Array.isArray(grounds) || grounds.length === 0) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "Turf name and at least one ground are required",
        });
    }

    if (!address_line_1 || !address_line_1.area || !address_line_1.city || !address_line_1.state) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "Area/street, district and division are required",
        });
    }

    // Geolocation is REQUIRED: the events feed ranks matches by how near their
    // turf is to the user (utils/eventRanking.js), so a turf with no coordinates
    // can never surface as "nearby". Enforce a valid lat/lng at creation time.
    const turfLat = Number(address_line_1.latitude);
    const turfLng = Number(address_line_1.longitude);
    if (
        !Number.isFinite(turfLat) || !Number.isFinite(turfLng) ||
        turfLat < -90 || turfLat > 90 || turfLng < -180 || turfLng > 180
    ) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "A valid map location (latitude & longitude) is required — pick the turf on the map",
        });
    }

    // Per ground the DB only enforces name + hourly_rate; we also require a
    // sport_type so the ground is discoverable/bookable.
    const hasRate = (g) =>
        g.hourly_rate !== undefined && g.hourly_rate !== null && g.hourly_rate !== "";
    const hasSport = (g) =>
        Array.isArray(g.sport_type) ? g.sport_type.length > 0 : Boolean(g.sport_type);

    const isGroundsValid = grounds.every(
        (g) => g && typeof g === "object" && g.name && hasSport(g) && hasRate(g)
    );

    if (!isGroundsValid) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "Each ground needs a name, at least one sport, and an hourly rate",
        });
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

    function castNumericStringValues(ground) {
        const result = { ...ground };

        numericFields.forEach((field) => {
            if (result[field] === "" || result[field] === null || result[field] === undefined) {
                result[field] = null;
            } else {
                const num = Number(result[field]);
                result[field] = Number.isNaN(num) ? null : num;
            }
        });

        // Optional enum/text columns (ground_type, surface_type, status, notes…)
        // arrive as "" when the owner leaves them blank. An empty string is an
        // INVALID Prisma enum value and would abort grounds.createMany — and with
        // it the whole venue+ground transaction. Coerce blanks to null so the
        // column falls back to its default / stays null and the ground is created.
        Object.keys(result).forEach((key) => {
            if (result[key] === "") {
                result[key] = null;
            }
        });

        return result;
    }

    // ------------- TRANSACTION STARTS HERE -------------
    const venueCreated = await pgClient.$transaction(async (tx) => {
        const venueData = {
            // Owner is the authenticated admin — guaranteed by verifyJWT +
            // authorizeRoles on the route (no anonymous/hardcoded fallback).
            admin_user_id: req.user.id,
            name,
            slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
            description,
            // BD address maps onto existing columns: area -> address_line_1,
            // district -> city, division -> state. Fall back to the old
            // "city, state" string if a legacy payload has no `area`.
            address_line_1: address_line_1.area || `${address_line_1.city}, ${address_line_1.state}`,
            address_line_2,
            city: address_line_1.city,
            state: address_line_1.state,
            country: address_line_1.country || "Bangladesh",
            postal_code: address_line_1.postal_code,
            // Number("") is 0 and Number(undefined) is NaN, so `?? null` wouldn't
            // catch a bad value — guard explicitly with isFinite.
            latitude: Number.isFinite(Number(address_line_1.latitude)) ? Number(address_line_1.latitude) : null,
            longitude: Number.isFinite(Number(address_line_1.longitude)) ? Number(address_line_1.longitude) : null,
            phone,
            email,
            website_url,
            establishment_year: Number.isFinite(Number(establishment_year)) && establishment_year
                ? Number(establishment_year)
                : null,
            total_grounds: grounds.length,
            facilities,
            sports_available,
            rules_and_regulations,
            cancellation_policy,
            status: "pending_approval",
            verified: false,
            rating: Number.isFinite(Number(rating)) ? Number(rating) : 0,
            total_bookings: 0,
            // operating_hours is optional now — only build the JSON when provided.
            operating_hours: operating_hours
                ? {
                    open: operating_hours.opening_time,
                    close: operating_hours.closing_time,
                }
                : null,
            images,
        };

        const createdVenue = await tx.turfs.create({
            data: venueData,
        });

        if (!createdVenue) {
            throw new ApiError(500, "Error creating new venue");
        }

        const groundData = grounds.map((ground) => ({
            ...castNumericStringValues(ground),
            turf_id: createdVenue.id,
        }));

        const groundCreated = await tx.grounds.createMany({
            data: groundData,
            skipDuplicates: true,
        });


        if (!groundCreated || groundCreated.count === 0) {
            throw new ApiError(500, "Error creating new ground");
        }

        const venueGrounds = await tx.grounds.findMany({
            where: {
                turf_id: createdVenue.id
            }
        })

        if (!venueGrounds) {
            throw new ApiError(500, "Error finding grounds");
        }

        return VenueSerializer.toDto(createdVenue, venueGrounds);


        // {
        //     name: createdVenue.name,
        //     slug: createdVenue.slug,
        //     description: createdVenue.description,
        //     address_line_1: {
        //         city: createdVenue.city,
        //         state: createdVenue.state,
        //         postal_code: createdVenue.postal_code,
        //         country: createdVenue.country,
        //         latitude: createdVenue.latitude,
        //         longitude: createdVenue.longitude
        //     },
        //     address_line_2: createdVenue.address_line_2,
        //     phone: createdVenue.phone,
        //     email: createdVenue.email,
        //     website_url: createdVenue.website_url,
        //     establishment_year: createdVenue.establishment_year,
        //     rules_and_regulations: createdVenue.rules_and_regulations,
        //     cancellation_policy: createdVenue.cancellation_policy,
        //     advance_booking_days: createdVenue.advance_booking_days,
        //     sports_available: createdVenue.sports_available,
        //     facilities: createdVenue.facilities,
        //     rating: createdVenue.rating,
        //     operating_hours: {
        //         opening_time: createdVenue.operating_hours.open,
        //         closing_time: createdVenue.operating_hours.close
        //     },
        //     images: createdVenue.images,
        //     grounds: venueGrounds
        // }


    });

    return res
        .status(201)
        .json(new ApiResponse(201, "New venue created successfully", venueCreated));
});


// Numeric columns on a ground; clients send them as strings from the form.
const GROUND_NUMERIC_FIELDS = [
    "capacity_players", "hourly_rate", "weekend_hourly_rate", "peak_hour_rate",
    "off_peak_hour_rate", "minimum_booking_hours", "maximum_booking_hours",
    "dimensions_length_m", "dimensions_width_m",
];

// Cast numeric strings -> Number|null, and blank strings -> null. An empty
// string is an INVALID Prisma enum value (ground_type/surface_type/status) and
// would abort the insert, so blanks must become null to fall back to defaults.
function normalizeGround(raw) {
    const g = { ...raw };
    for (const f of GROUND_NUMERIC_FIELDS) {
        if (g[f] === "" || g[f] === null || g[f] === undefined) g[f] = null;
        else {
            const n = Number(g[f]);
            g[f] = Number.isNaN(n) ? null : n;
        }
    }
    for (const k of Object.keys(g)) {
        if (g[k] === "") g[k] = null;
    }
    return g;
}

// Add a GROUND to the caller's turf. A turf_admin owns exactly one turf (see the
// one-turf gate in createVenue), so "create turf" in the admin panel becomes
// "add ground" once that turf exists. super_admin may target any turf via
// `turf_id` in the body.
const createGround = asyncHandler(async (req, res) => {
    const isSuper = req.user.user_type === "super_admin";

    const turf = isSuper && req.body.turf_id
        ? await pgClient.turfs.findUnique({
              where: { id: req.body.turf_id },
              select: { id: true, sports_available: true },
          })
        : await pgClient.turfs.findFirst({
              where: { admin_user_id: req.user.id },
              select: { id: true, sports_available: true },
          });

    // No turf yet -> they must create the turf first (onboarding wizard).
    if (!turf) throw ApiError.fromCode(ERROR_CODES.NO_TURF_FOR_ADMIN);

    // Minimal required set mirrors createVenue's per-ground rule: name + at least
    // one sport + an hourly rate > 0. Everything else is optional.
    const { name, sport_type, hourly_rate } = req.body;
    const hasSport = Array.isArray(sport_type) ? sport_type.length > 0 : Boolean(sport_type);
    const hasRate =
        hourly_rate !== undefined && hourly_rate !== null && hourly_rate !== "" && Number(hourly_rate) > 0;
    if (!name || !hasSport || !hasRate) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "A ground needs a name, at least one sport, and an hourly rate greater than 0",
        });
    }

    // Whitelist client-settable columns — turf_id and status are set by us, never
    // taken from the body (a client can't attach a ground to someone else's turf).
    const allowed = [
        "name", "ground_type", "sport_type", "surface_type", "dimensions_length_m",
        "dimensions_width_m", "capacity_players", "hourly_rate", "weekend_hourly_rate",
        "peak_hour_rate", "off_peak_hour_rate", "currency", "minimum_booking_hours",
        "maximum_booking_hours", "amenities", "images", "notes",
    ];
    const payload = normalizeGround(Object.fromEntries(allowed.map((k) => [k, req.body[k]])));
    payload.currency = payload.currency || "BDT";

    const created = await pgClient.$transaction(async (tx) => {
        const ground = await tx.grounds.create({
            data: { ...payload, turf_id: turf.id, status: "available" },
        });

        // Keep the turf rollups in sync: ground count + the union of sports so the
        // venue stays discoverable by every sport its grounds host.
        const incomingSports = Array.isArray(sport_type) ? sport_type : [sport_type];
        const mergedSports = Array.from(
            new Set([...(turf.sports_available ?? []), ...incomingSports].filter(Boolean))
        );
        await tx.turfs.update({
            where: { id: turf.id },
            data: { total_grounds: { increment: 1 }, sports_available: mergedSports },
        });

        return ground;
    });

    return res
        .status(201)
        .json(new ApiResponse(201, "New ground created successfully", created));
})

// Edit a ground's info. Scoped to the ground's OWNING turf admin (super_admin
// global) — a turf_admin can only edit grounds on the turf they own. Partial
// update: only the columns present in the body are touched.
const updateGround = asyncHandler(async (req, res) => {
    const { ground_id } = req.params;
    const isSuper = req.user.user_type === "super_admin";

    const ground = await pgClient.grounds.findUnique({
        where: { id: ground_id },
        select: { id: true, turfs: { select: { admin_user_id: true } } },
    });
    if (!ground) throw ApiError.fromCode(ERROR_CODES.GROUND_NOT_FOUND);
    if (!isSuper && ground.turfs?.admin_user_id !== req.user.id) {
        throw ApiError.fromCode(ERROR_CODES.NOT_TURF_ADMIN);
    }

    // Client-settable columns only (never turf_id). `status` is editable here so
    // the owner can flip a ground to maintenance/unavailable.
    const allowed = [
        "name", "ground_type", "sport_type", "surface_type", "dimensions_length_m",
        "dimensions_width_m", "capacity_players", "hourly_rate", "weekend_hourly_rate",
        "peak_hour_rate", "off_peak_hour_rate", "currency", "minimum_booking_hours",
        "maximum_booking_hours", "amenities", "images", "notes", "status",
    ];
    const raw = {};
    for (const k of allowed) if (k in req.body) raw[k] = req.body[k];

    // If these are being changed, they must stay valid (can't blank them out).
    if ("name" in raw && !String(raw.name).trim()) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "Ground name can't be empty" });
    }
    if ("sport_type" in raw) {
        const ok = Array.isArray(raw.sport_type) ? raw.sport_type.length > 0 : Boolean(raw.sport_type);
        if (!ok) throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "Pick at least one sport" });
    }
    if ("hourly_rate" in raw && !(Number(raw.hourly_rate) > 0)) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "Hourly rate must be greater than 0" });
    }

    const updated = await pgClient.grounds.update({
        where: { id: ground_id },
        data: normalizeGround(raw),
    });

    logger.info(`ground ${ground_id} updated by admin=${req.user.id}`);
    return res.status(200).json(new ApiResponse(200, "Ground updated", updated));
})

const getVenueByAdminId = asyncHandler(async (req, res) => {
    const { admin_id } = req.params;
    const venues = await pgClient.turfs.findMany({
        where: {
            admin_user_id: admin_id
        },
        include: {
            grounds: true
        }
    });

    if (!venues) {
        throw new ApiError(404, "No venues found for this admin");
    }

    const response = venues.map((venue) => VenueSerializer.toDto(venue));

    return res.status(200).json(new ApiResponse(200, "Venues found successfully", response));
});

export {
    getVenues,
    getVenueList,
    getVenueById,
    rateTurf,
    createVenue,
    createGround,
    updateGround,
    getVenueByAdminId
}