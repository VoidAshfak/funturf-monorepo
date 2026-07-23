import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";
import { pgClient, Prisma } from "../../prisma.js";
import { EventSerializer } from "../../utils/dataSerializer.js";
import { createNotification } from "../../utils/notificationService.js";
import { broadcastToTurfmates, getAcceptedTurfmateIds } from "../../utils/turfmateService.js";
import { isEventAdmin, notifyEventAdmins, notifyEventParticipants, resolveBookingAttachment } from "../../utils/eventService.js";
import { getRankedEventPage } from "../../utils/eventRanking.js";
import { requireActiveMembership } from "../../utils/teamService.js";
import { isUuid } from "../../middlewares/validateUuid.middleware.js";
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
        // Optional: organize this match under one of the caller's teams. Purely an
        // organizing tag — a teamless match simply omits it and behaves as before.
        team_id,
    } = req.body

    // Always-required fields, independent of whether a booking is attached.
    if (!title
        || !sport_type
        || !event_type
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

    // Schedule + venue/ground come from ONE of two sources — same rule the edit
    // path enforces (booking = source of truth for the match time):
    //   - WITH a booking    -> derived from the booking; any time/venue in the body
    //     is ignored so the two can never disagree.
    //   - WITHOUT a booking -> the body supplies a PROBABLE time + chosen venue/ground.
    let effDate = event_date;
    let effStart = start_time;
    let effEnd = end_time;
    let effVenue = venue_id;
    let effGround = ground_id;

    if (booking_id) {
        // Validates ownership + not-already-attached, and resolves the slot/venue.
        // Done BEFORE creating the event so a bad booking never orphans an event.
        const attach = await resolveBookingAttachment(booking_id, req.user.id, null);
        effDate = attach.date;
        effStart = attach.startTime;
        effEnd = attach.endTime;
        effVenue = attach.venueId;
        effGround = attach.groundId;
    } else if (!event_date || !start_time || !end_time || !venue_id || !ground_id) {
        // No booking -> the organizer must give a probable time + venue/ground.
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "Pick a venue, ground and a probable time, or attach a booking",
        });
    }

    // Organizing under a team? Only someone actually ON that team may fly its
    // name. Checked BEFORE the event exists so a rejected tag never leaves a
    // half-created match behind.
    if (team_id) {
        // Screen the id first — a malformed uuid raises Prisma P2023, which would
        // surface as a 500 instead of the 400 this is.
        if (!isUuid(team_id)) {
            throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
                message: "team_id must be a valid id",
            });
        }
        await requireActiveMembership(team_id, req.user.id);
    }

    // current_players counts the ORGANIZER (they play too) + any hand-picked
    // initial squad. Later approved joins increment on top of this base.
    const createdEvents = await pgClient.$queryRaw
        `
    SELECT * FROM fn_create_event(
        ${req.user.id}::uuid,
        ${title}::varchar,
        ${description || ""}::text,
        ${sport_type}::varchar,
        ${event_type}::event_type,
        ${effDate}::date,
        ${effStart}::time,
        ${effEnd}::time,
        ${effVenue}::uuid,
        ${effGround}::uuid,
        ${Number(max_players)}::int,
        ${Number(min_Players)}::int,
        ${Number(current_players.length) + 1}::int,
        ${skill_level_required}::skill_level_type,
        ${total_cost}::numeric,
        ${cost_split_type}::cost_split_type
    )`

    const createdEvent = createdEvents[0];


    if (!createdEvent) {
        throw new ApiError(500, "Event creation failed!")
    }

    // Tag the match with its organizing team. Done as a follow-up update because
    // the create path goes through the `fn_create_event` stored procedure, which
    // has no team parameter.
    //
    // TODO (fast-follow, deliberately out of scope): auto-invite the team's
    // roster to a team-organized match. Today the join/invite flow for the event
    // is untouched — a team is only an organizing tag on it.
    if (team_id) {
        await pgClient.events.update({
            where: { id: createdEvent.id },
            data: { team_id },
        });
        createdEvent.team_id = team_id;
        logger.info(`event ${createdEvent.id} organized under team ${team_id}`);
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
//   joinedOnly "true" -> only events the caller is already involved in
//              (organiser or any participant row). Needs an authenticated caller;
//              a no-op otherwise. Pairs with the per-event `my_role` flag below.
//
// Response data: { events, pagination, stats }.
// When authenticated, each event also carries `my_role`
// ("organizer" | "co_organizer" | "player" | null) so the feed can highlight the
// matches the caller runs or plays in.
// `stats` (global, unfiltered) is only computed on page 1 to save queries — the
// client keeps it from the first load to render the hero + sport chips.
const getEvents = asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);
    const skip = (page - 1) * limit;

    const { sport, timeframe, q, openOnly, joinedOnly } = req.query;

    // Ranking + filtering + pagination now live in the SQL scorer
    // (utils/eventRanking.js) — it returns the ordered ids for this page. We then
    // hydrate those ids with the rich select below and re-apply the ranked order.
    // The feed is personalised when the caller is known (optional auth):
    //   nearby (their home location) + turfmate-involved signals switch on, and
    //   the `joinedOnly` filter can narrow to matches they're already in.
    const { orderedIds, total } = await getRankedEventPage({
        userId: req.user?.id,
        filters: { sport, timeframe, q, openOnly, joinedOnly },
        skip,
        limit,
    });

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
        // Feed cards label the time "Probable" when no booking backs it.
        booking_id: true,
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

    // Hydrate the ranked ids. `where: { id: in }` loses the ranking order, so we
    // re-sort the rows back into the exact order the scorer returned.
    const rows = orderedIds.length
        ? await pgClient.events.findMany({
              where: { id: { in: orderedIds } },
              select,
          })
        : [];

    const byId = new Map(rows.map((r) => [r.id, r]));
    const events = orderedIds.map((id) => byId.get(id)).filter(Boolean);

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

    // Per-caller personalisation (optional auth). Two independent tags, both only
    // meaningful when we know who's asking:
    //   1. turfmates_involved — which of the caller's turfmates organise/play here.
    //   2. my_role            — the caller's own relationship to the match, so the
    //      feed can highlight the ones they organise or play in.
    let eventsOut = events;
    if (req.user?.id) {
        const myId = req.user.id;

        // 1. Turfmate highlight.
        const myTurfmates = new Set(await getAcceptedTurfmateIds(myId));
        if (myTurfmates.size > 0) {
            eventsOut = eventsOut.map((e) => {
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

        // 2. My role in each event on this page. One query for the caller's
        // participant rows across the page, then organiser wins over any row.
        const myRows = orderedIds.length
            ? await pgClient.event_participants.findMany({
                  where: { event_id: { in: orderedIds }, user_id: myId },
                  select: { event_id: true, role: true },
              })
            : [];
        const roleByEvent = new Map(myRows.map((r) => [r.event_id, r.role]));
        eventsOut = eventsOut.map((e) => {
            let my_role = null;
            if (e.organizer_id === myId) {
                my_role = "organizer";
            } else if (roleByEvent.has(e.id)) {
                // co_organizer is the admin role; anything else counts as a player.
                my_role = roleByEvent.get(e.id) === "co_organizer" ? "co_organizer" : "player";
            }
            return { ...e, my_role };
        });
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
                    profile_picture_url: true,
                    // Same public profile extras as the roster, so the organizer's
                    // squad entry shows a home area + player stats too.
                    district: true,
                    division: true,
                    player_profiles: {
                        select: {
                            skill_level: true,
                            total_games_played: true,
                            rating: true,
                        },
                        take: 1,
                    },
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
            // Extra fields the organizer edit form prefills from.
            event_type: true,
            skill_level_required: true,
            entry_fee: true,
            total_cost: true,
            cost_split_type: true,
            visibility: true,
            ground_id: true,
            venue_id: true,
            status: true,
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
    // read the caller's own participation, and drive the admin panel. The user
    // select carries a bit of public profile data (home area + player stats) so
    // the squad list can show a role badge, join date and at-a-glance skill/games.
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
                    // Public-safe profile extras for the squad card.
                    district: true,
                    division: true,
                    // One player_profiles row holds the sport stats we surface.
                    player_profiles: {
                        select: {
                            skill_level: true,
                            total_games_played: true,
                            rating: true,
                        },
                        take: 1,
                    },
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

// "Delete" a match — implemented as a SOFT CANCEL (status -> `cancelled`), never a
// physical row delete. WHY: a match accretes history the platform depends on —
// chat, comments, payments, reviews and organiser reputation. Hard-deleting would
// destroy that (and is blocked at the DB anyway: bookings/messages/payments/reviews
// reference events with ON DELETE NO ACTION). Cancelling keeps every record, drops
// the match out of the active feeds (which filter to open/ready/booked), frees the
// reserved slot, and stays reversible. ORGANIZER (creator) only.
const deleteEvent = asyncHandler(async (req, res) => {
    const event_id = req.body.event_id;
    const user_id = req.user.id;

    if (!event_id) {
        throw ApiError.fromCode(ERROR_CODES.BAD_REQUEST, { message: "An event id is required" });
    }

    const existingEvent = await pgClient.events.findUnique({ where: { id: event_id } });
    if (!existingEvent) {
        throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_FOUND);
    }
    if (existingEvent.organizer_id !== user_id) {
        throw ApiError.fromCode(ERROR_CODES.NOT_EVENT_ORGANIZER);
    }
    // Terminal states can't be cancelled again — a finished game is a permanent
    // record and an already-cancelled one is a no-op.
    if (existingEvent.status === "cancelled" || existingEvent.status === "completed") {
        throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_EDITABLE, {
            message: `This match is already ${existingEvent.status} and cannot be cancelled`,
        });
    }

    // Atomically: free any attached booking (keep the reservation itself — the
    // organizer may still have paid for it) and flip the match to `cancelled`.
    const ops = [
        pgClient.events.update({
            where: { id: event_id },
            data: { status: "cancelled", booking_id: null },
        }),
    ];
    if (existingEvent.booking_id) {
        ops.push(
            pgClient.bookings.updateMany({
                where: { id: existingEvent.booking_id },
                data: { event_id: null },
            })
        );
    }
    const [cancelledEvent] = await pgClient.$transaction(ops);

    // Tell the confirmed squad the match is off so they can re-plan. Excludes the
    // organizer (this was their own action — the client toasts it).
    await notifyEventParticipants(
        event_id,
        {
            type: "event_cancelled",
            title: "Match cancelled",
            message: `"${existingEvent.title}" was cancelled by the organizer`,
            data: { event_id },
            priority: eventPriorityByDate(existingEvent.event_date),
            action_url: `/events/${event_id}`,
        },
        [user_id]
    );

    // Nudge any open match page / feed to refetch and drop the cancelled match.
    broadcastRoster(event_id);

    logger.info(`event ${event_id} cancelled by organizer ${user_id}`);

    return res.status(200).json(new ApiResponse(200, "Match cancelled", cancelledEvent));
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

// GET /events/nearby?lat=&lng=&radius= — upcoming public matches within `radius`
// km of a point, nearest first. Distance is a plain haversine on turf lat/lng (no
// PostGIS dependency — same math as the feed ranking in utils/eventRanking.js), so
// it works on any Postgres. Turfs are required to have coordinates (enforced at
// turf creation), and status/visibility use the real enum values.
const getNearbyEvents = asyncHandler(async (req, res) => {
    const { lat, lng, radius = 10 } = req.query; // radius in km

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    // Clamp the radius to a sane window (1..100 km); default 10.
    const radiusKm = Math.min(Math.max(parseFloat(radius) || 10, 1), 100);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "Valid lat and lng query parameters are required",
        });
    }

    // Haversine distance (km) between the user and each turf. Only upcoming, live,
    // public matches on turfs that have coordinates, within the radius, nearest first.
    const events = await pgClient.$queryRaw`
        SELECT
            e.id,
            e.title,
            e.sport_type,
            e.event_date,
            e.start_time,
            e.end_time,
            e.min_players,
            e.max_players,
            e.current_players,
            t.id   AS turf_id,
            t.name AS turf_name,
            t.city AS turf_city,
            g.name AS ground_name,
            (2 * 6371 * asin(sqrt(
                power(sin(radians(t.latitude::double precision - ${latitude}) / 2), 2)
                + cos(radians(${latitude})) * cos(radians(t.latitude::double precision))
                * power(sin(radians(t.longitude::double precision - ${longitude}) / 2), 2)
            ))) AS distance_km
        FROM events e
        JOIN grounds g ON g.id = e.ground_id
        JOIN turfs t ON t.id = g.turf_id
        WHERE e.status IN ('open', 'ready', 'booked')
            AND e.visibility = 'public'
            AND e.event_date >= CURRENT_DATE
            AND t.latitude IS NOT NULL
            AND t.longitude IS NOT NULL
            AND (2 * 6371 * asin(sqrt(
                    power(sin(radians(t.latitude::double precision - ${latitude}) / 2), 2)
                    + cos(radians(${latitude})) * cos(radians(t.latitude::double precision))
                    * power(sin(radians(t.longitude::double precision - ${longitude}) / 2), 2)
                ))) <= ${radiusKm}
        ORDER BY distance_km ASC, e.event_date ASC, e.start_time ASC
        LIMIT 50
    `;

    // distance_km comes back as a numeric string via the pg driver — round it for
    // the client so cards can show "2.4 km" without extra work.
    const shaped = events.map((e) => ({
        ...e,
        distance_km: e.distance_km != null ? Math.round(Number(e.distance_km) * 10) / 10 : null,
    }));

    return res.status(200).json(
        new ApiResponse(200, `${shaped.length} nearby matches found`, {
            events: shaped,
            search_radius_km: radiusKm,
            center: { lat: latitude, lng: longitude },
        })
    );
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

    // A finished or cancelled match is a historical record — locking it keeps its
    // chat / comments / ratings tied to what actually happened (see the reuse
    // design: reuse via "Rematch", never by mutating a settled event).
    if (event.status === "completed" || event.status === "cancelled") {
        throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_EDITABLE);
    }

    // ---- scalar edits ----
    // organizer_id is intentionally NOT editable (ownership can't be transferred).
    // current_players is NOT editable either — it's derived from the approved
    // roster (join/leave/accept keep it correct); a hand-set value would desync
    // capacity and the "open spots" ranking signal.
    // event_date / start_time / end_time are handled separately (raw SQL) because
    // Prisma's typed update won't accept "HH:MM" strings for @db.Time columns.
    const editableFields = [
        "title", "description", "sport_type", "event_type",
        "ground_id", "venue_id", "max_players", "min_players", "skill_level_required",
        "age_group", "gender_preference", "visibility", "join_approval_required",
        "entry_fee", "total_cost", "cost_split_type", "rules", "what_to_bring",
    ];

    const data = {};
    editableFields.forEach((field) => {
        if (req.body[field] !== undefined) data[field] = req.body[field];
    });

    // Coerce integer columns so a string body ("10") can't break the Prisma write.
    for (const intField of ["max_players", "min_players"]) {
        if (data[intField] !== undefined) data[intField] = Number(data[intField]);
    }

    // ---- player-limit validation ----
    // Effective values after this edit (fall back to the stored ones). max can't
    // drop below the confirmed squad, and min can't exceed max.
    const newMax = data.max_players !== undefined ? Number(data.max_players) : event.max_players;
    const newMin = data.min_players !== undefined ? Number(data.min_players) : event.min_players;
    const squad = event.current_players ?? 0;
    if (
        !Number.isFinite(newMax) || !Number.isFinite(newMin) ||
        newMin < 1 || newMin > newMax || newMax < squad
    ) {
        throw ApiError.fromCode(ERROR_CODES.INVALID_PLAYER_LIMITS);
    }

    // Non-negative money.
    for (const money of ["entry_fee", "total_cost"]) {
        if (data[money] !== undefined && Number(data[money]) < 0) {
            throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
                message: `${money} cannot be negative`,
            });
        }
    }

    // ---- booking (re)attachment intent ----
    // `booking_id` present in the body signals intent:
    //   - a uuid   -> attach that booking (and sync the match time TO its slot)
    //   - null/""  -> detach whatever booking is currently attached
    const hasBookingField = Object.prototype.hasOwnProperty.call(req.body, "booking_id");
    const newBookingId = hasBookingField ? (req.body.booking_id || null) : undefined;
    const attachingNew = hasBookingField && newBookingId && newBookingId !== event.booking_id;
    // Will the match still have a booking once this edit lands?
    const willHaveBooking = hasBookingField ? Boolean(newBookingId) : Boolean(event.booking_id);

    // ---- schedule rule ----
    // A match's time is EITHER driven by its attached booking, OR set by hand as a
    // PROBABLE range when there's no booking. So hand-set schedule fields are only
    // accepted when the match will have NO booking. Attaching a booking syncs the
    // time FROM that booking (below); trying to hand-set the time on a match that
    // stays booked is rejected so the two can never disagree.
    const scheduleInBody = ["event_date", "start_time", "end_time"].some(
        (f) => req.body[f] !== undefined
    );
    if (scheduleInBody && willHaveBooking && !attachingNew) {
        throw ApiError.fromCode(ERROR_CODES.EVENT_SCHEDULE_LOCKED);
    }

    // Desired new schedule: the body's probable range UNLESS a booking dictates it
    // (booking-driven values are filled in on attach below).
    let schedule = willHaveBooking
        ? { date: null, start: null, end: null }
        : { date: req.body.event_date ?? null, start: req.body.start_time ?? null, end: req.body.end_time ?? null };

    const txOps = []; // booking link/unlink ops to run in the update transaction

    if (attachingNew) {
        // Attach a NEW booking. Validate ownership + resolve the slot it dictates.
        const attach = await resolveBookingAttachment(newBookingId, req.user.id, event.id);
        // A match runs ON its reservation — mirror the booking's ground/venue/slot.
        if (attach.groundId) data.ground_id = attach.groundId;
        if (attach.venueId) data.venue_id = attach.venueId;
        data.booking_id = newBookingId;
        schedule = { date: attach.date, start: attach.startTime, end: attach.endTime };

        // Free the previously attached booking, if any.
        if (event.booking_id) {
            txOps.push(pgClient.bookings.updateMany({
                where: { id: event.booking_id },
                data: { event_id: null },
            }));
        }
        // Claim the new booking (event_id null guard closes the attach race).
        txOps.push(pgClient.bookings.updateMany({
            where: { id: newBookingId, user_id: req.user.id, event_id: null },
            data: { event_id: event.id },
        }));
    } else if (hasBookingField && !newBookingId && event.booking_id) {
        // Detach: unlink both sides. The time stays as it was, now a probable range
        // the organizer can edit again.
        data.booking_id = null;
        txOps.push(pgClient.bookings.updateMany({
            where: { id: event.booking_id },
            data: { event_id: null },
        }));
    }

    // ---- build the schedule raw-SQL SET list (typed casts) ----
    const scheduleSets = [];
    if (schedule.date) scheduleSets.push(Prisma.sql`event_date = ${schedule.date}::date`);
    if (schedule.start) scheduleSets.push(Prisma.sql`start_time = ${schedule.start}::time`);
    if (schedule.end) scheduleSets.push(Prisma.sql`end_time = ${schedule.end}::time`);

    // ---- material-change detection (drives participant notification) ----
    // Schedule touched, or a core detail (venue/ground/sport) changed.
    const coreFields = ["ground_id", "venue_id", "sport_type"];
    const isMaterialChange =
        scheduleSets.length > 0 ||
        coreFields.some((f) => data[f] !== undefined && String(data[f]) !== String(event[f]));

    // ---- persist atomically: scalar update + booking links + schedule ----
    const ops = [pgClient.events.update({ where: { id: event.id }, data }), ...txOps];
    if (scheduleSets.length > 0) {
        ops.push(pgClient.$executeRaw`
            UPDATE events SET ${Prisma.join(scheduleSets, ", ")} WHERE id = ${event.id}::uuid
        `);
    }
    await pgClient.$transaction(ops);

    const updatedEvent = await pgClient.events.findUnique({ where: { id: event.id } });

    // Tell the confirmed squad when the match's core details changed — that's what
    // they actually need to re-plan around. (Cosmetic edits stay silent.)
    if (isMaterialChange) {
        await notifyEventParticipants(event.id, {
            type: "event_reminder",
            title: "Match details updated",
            message: `"${updatedEvent.title}" was updated by the organizer — check the new details`,
            data: { event_id: event.id },
            priority: eventPriorityByDate(updatedEvent.event_date),
            action_url: `/events/${event.id}`,
        }, [req.user.id]);
    }

    // Nudge any open match page to refetch the fresh details/roster live.
    broadcastRoster(event.id);

    logger.info(`event ${event.id} edited by organizer ${req.user.id} (material=${isMaterialChange})`);

    return res.status(200).json(
        new ApiResponse(200, "Event updated successfully", updatedEvent)
    );
})


// Rematch: spin up a NEW match from an existing one, carrying the same squad.
//
// WHY a new event (not editing the old one): a finished match is a permanent
// record — its chat, comments and ratings must stay attached to what actually
// happened, and the discovery ranking rewards distinct completed games. So reuse
// is a *clone*, not a mutation. The organizer picks a fresh date/slot; the prior
// squad is re-invited as PENDING so everyone opts in (people can be busy) and the
// join/leave flow stays honest. This is the low-friction "play again next week"
// path — no full form, no unnecessary duplicate events.
const rematchEvent = asyncHandler(async (req, res) => {
    const { event_id } = req.params;
    const { event_date, start_time, end_time } = req.body;

    if (!event_id) {
        throw ApiError.fromCode(ERROR_CODES.BAD_REQUEST, { message: "An event id is required" });
    }
    if (!event_date || !start_time || !end_time) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "A new date, start time and end time are required for the rematch",
        });
    }

    // New match can't be scheduled in the past.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (new Date(event_date) < startOfToday) {
        throw ApiError.fromCode(ERROR_CODES.BOOKING_DATE_IN_PAST, {
            message: "The rematch date cannot be in the past",
        });
    }

    const source = await pgClient.events.findUnique({ where: { id: event_id } });
    if (!source) throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_FOUND);

    // Only a match admin (organizer or co-organizer) may rematch it.
    if (!(await isEventAdmin(event_id, req.user.id))) {
        throw ApiError.fromCode(ERROR_CODES.NOT_EVENT_ADMIN);
    }

    // Core fields go through the same fn_create_event path as a fresh event, so
    // roster/capacity bookkeeping stays identical. current_players = 1: the caller
    // (new organizer) is the only confirmed player — invitees are pending and add
    // on top as they accept.
    const created = await pgClient.$queryRaw`
        SELECT * FROM fn_create_event(
            ${req.user.id}::uuid,
            ${source.title}::varchar,
            ${source.description || ""}::text,
            ${source.sport_type}::varchar,
            ${source.event_type}::event_type,
            ${event_date}::date,
            ${start_time}::time,
            ${end_time}::time,
            ${source.venue_id}::uuid,
            ${source.ground_id}::uuid,
            ${source.max_players}::int,
            ${source.min_players}::int,
            ${1}::int,
            ${source.skill_level_required}::skill_level_type,
            ${source.total_cost}::numeric,
            ${source.cost_split_type}::cost_split_type
        )`;
    const newEvent = created[0];
    if (!newEvent) throw new ApiError(500, "Rematch creation failed");

    // Copy the extra preferences fn_create_event doesn't take (kept identical so
    // the clone truly mirrors the original's rules). booking_id is intentionally
    // NOT copied — a new session needs its own reservation.
    await pgClient.events.update({
        where: { id: newEvent.id },
        data: {
            entry_fee: source.entry_fee,
            age_group: source.age_group,
            gender_preference: source.gender_preference,
            visibility: source.visibility,
            join_approval_required: source.join_approval_required,
            rules: source.rules,
            what_to_bring: source.what_to_bring,
            images: source.images ?? undefined,
        },
    });

    // Carry the squad: everyone who was approved in the source match, plus the
    // source organizer, minus the caller (already the new organizer). They come in
    // as INVITED (not requested) — the organizer pulled them in, so the ball is in
    // THEIR court to accept/decline. `invited` rows are invisible to the admin
    // request queue (getJoinRequests filters `requested`) and don't consume a slot
    // until the invitee accepts.
    const approved = await pgClient.event_participants.findMany({
        where: { event_id, status: "approved" },
        select: { user_id: true },
    });
    const inviteeIds = [
        ...new Set([source.organizer_id, ...approved.map((p) => p.user_id)]),
    ].filter((id) => id !== req.user.id);

    if (inviteeIds.length > 0) {
        await pgClient.event_participants.createMany({
            data: inviteeIds.map((uid) => ({
                event_id: newEvent.id,
                user_id: uid,
                status: "invited",
                role: "player",
                payment_status: "pending",
                joined_at: newEvent.created_at,
            })),
            skipDuplicates: true,
        });

        // Invite each carried player to confirm for the new date.
        await Promise.all(
            inviteeIds.map((uid) =>
                createNotification({
                    user_id: uid,
                    type: "event_invitation",
                    title: "Rematch scheduled",
                    message: `"${source.title}" is back on — tap to confirm you're in for the new date`,
                    data: { event_id: newEvent.id },
                    priority: eventPriorityByDate(newEvent.event_date ?? event_date),
                    action_url: `/events/${newEvent.id}`,
                })
            )
        );
    }

    logger.info(
        `rematch: source=${event_id} -> new=${newEvent.id} by ${req.user.id}, invited ${inviteeIds.length}`
    );

    return res.status(201).json(
        new ApiResponse(201, "Rematch created — your squad has been invited", newEvent)
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
        select: { id: true, title: true, event_date: true, organizer_id: true, max_players: true, status: true },
    });
    if (!event) throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_FOUND);
    // A cancelled or finished match can't take new players.
    if (event.status === "cancelled" || event.status === "completed") {
        throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_EDITABLE, {
            message: `This match is ${event.status} and no longer accepting players`,
        });
    }
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

// ---------------------------------------------------------------------------
// Invitation flow (INVITEE side)
//
// An `invited` row means an organizer pulled this user into a match (today: a
// rematch carry-over). The direction is the OPPOSITE of a join request — the
// invitee decides, not an admin. Two outcomes:
//   accept  -> becomes an approved squad member (consumes a slot)
//   decline -> the invite row is DELETED, freeing the user to later request a
//              spot through the normal join flow (joinEvent blocks while ANY
//              participant row exists, so we must remove it, not just flag it).
// ---------------------------------------------------------------------------

// Accept an invitation to a match (invitee only). Flips the caller's own
// `invited` row to `approved` and consumes a slot.
const acceptEventInvitation = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { event_id } = req.params;
    if (!event_id) {
        throw ApiError.fromCode(ERROR_CODES.BAD_REQUEST, { message: "An event id is required" });
    }

    const event = await pgClient.events.findUnique({
        where: { id: event_id },
        select: { id: true, title: true, event_date: true, max_players: true, current_players: true },
    });
    if (!event) throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_FOUND);

    // The caller must actually hold a pending invitation.
    const invite = await pgClient.event_participants.findFirst({
        where: { event_id, user_id: userId, status: "invited" },
        select: { id: true },
    });
    if (!invite) throw ApiError.fromCode(ERROR_CODES.INVITATION_NOT_FOUND);

    // Hard capacity guard at accept time (current_players tracks the approved
    // roster incl. organizer) — an invite doesn't reserve a slot in advance.
    if (event.max_players && (event.current_players ?? 0) >= event.max_players) {
        throw ApiError.fromCode(ERROR_CODES.EVENT_FULL);
    }

    await pgClient.event_participants.update({
        where: { id: invite.id },
        data: { status: "approved", approved_at: new Date() },
    });
    await pgClient.events.update({
        where: { id: event_id },
        data: { current_players: { increment: 1 } },
    });

    const joiner = await pgClient.users.findUnique({
        where: { id: userId },
        select: { first_name: true, last_name: true },
    });
    const joinerName = displayName(joiner);

    // Let the admins know the invite landed, and nudge the joiner's turfmates.
    // The joiner gets no bell entry — accepting was their own action (toasted
    // client-side), matching the join-request notification policy.
    await notifyEventAdmins(
        event_id,
        {
            type: "event_invitation",
            title: "Invite accepted",
            message: `${joinerName} accepted the invite for "${event.title}"`,
            data: { eventId: event_id, userId },
            priority: "low",
            action_url: `/events/${event_id}`,
        },
        [userId]
    );
    await broadcastToTurfmates(userId, {
        type: "event_invitation",
        title: "A turfmate joined a match",
        message: `${joinerName} joined "${event.title}" — jump in with them`,
        data: { eventId: event_id },
        priority: eventPriorityByDate(event.event_date),
        action_url: `/events/${event_id}`,
    });

    broadcastRoster(event_id);

    logger.info(`invitation accepted: event=${event_id} user=${userId}`);
    return res.status(200).json(new ApiResponse(200, "Invitation accepted — you're in!", { event_id }));
});

// Decline an invitation (invitee only). Deletes the caller's `invited` row so
// they're free to request a spot the normal way later. An invite never consumed
// a slot, so there's nothing to decrement.
const declineEventInvitation = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { event_id } = req.params;
    if (!event_id) {
        throw ApiError.fromCode(ERROR_CODES.BAD_REQUEST, { message: "An event id is required" });
    }

    const invite = await pgClient.event_participants.findFirst({
        where: { event_id, user_id: userId, status: "invited" },
        select: { id: true },
    });
    if (!invite) throw ApiError.fromCode(ERROR_CODES.INVITATION_NOT_FOUND);

    await pgClient.event_participants.delete({ where: { id: invite.id } });

    const event = await pgClient.events.findUnique({
        where: { id: event_id },
        select: { title: true },
    });
    // Low-priority courtesy note to the admins so their roster view stays honest.
    await notifyEventAdmins(
        event_id,
        {
            type: "event_invitation",
            title: "Invite declined",
            message: `A player declined the invite${event ? ` for "${event.title}"` : ""}`,
            data: { eventId: event_id, userId },
            priority: "low",
            action_url: `/events/${event_id}`,
        },
        [userId]
    );

    broadcastRoster(event_id);

    logger.info(`invitation declined: event=${event_id} user=${userId}`);
    return res.status(200).json(new ApiResponse(200, "Invitation declined", { event_id }));
});

export {
    createEvent,
    getEvents,
    deleteEvent,
    getUserEvents,
    getNearbyEvents,
    getEventById,
    editEvent,
    rematchEvent,
    joinEvent,
    leaveEvent,
    getJoinRequests,
    acceptJoinRequest,
    rejectJoinRequest,
    cancelJoinRequest,
    acceptEventInvitation,
    declineEventInvitation,
    grantEventAdmin,
    revokeEventAdmin
}