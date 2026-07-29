import { pgClient } from "../prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { ERROR_CODES } from "../utils/errorCodes.js";
import { logger } from "../../logs/logger.js";
import { get, set } from "../utils/cache.js";
import { closedSlotCodes } from "../utils/operatingHours.js";
import { ACTIVE_STATES } from "../utils/bookingService.js";
import { SLOT_CODES, slotStartMinute } from "../utils/slotGrid.js";
import { minutesToTimeString } from "../utils/timeAndDateFormatting.js";
import { isTodayLocal, nowLocalMinutes, todayLocalISO } from "../utils/appTime.js";

/**
 * "City pulse" — the public, read-only reads that power the landing page's live
 * map and activity ticker.
 *
 * Why these live here and not on /venues or /events: both answers span several
 * tables (turfs + grounds + slots + events + bookings) and neither belongs to a
 * single resource. They are also the only endpoints tuned for a *map* — coarse,
 * aggregated, and cheap enough to serve to every anonymous visitor.
 *
 * Nothing here is user-scoped, so both responses are safe to cache and contain
 * no personal data (the ticker deliberately carries first names only).
 */

/** Radius window a caller may ask for, in km. */
const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 50;
const DEFAULT_RADIUS_KM = 10;

/** Cap on turfs returned to the map — a marker layer beyond this is unreadable. */
const MAX_TURFS = 60;

/** How many upcoming matches to preview inside each turf's marker popup. */
const MATCHES_PER_TURF = 3;

const PULSE_MAP_TTL = Number(process.env.CACHE_TTL_PULSE_MAP) || 60;
const PULSE_STATS_TTL = Number(process.env.CACHE_TTL_PULSE_STATS) || 120;

/** Statuses that mean a match is still live and joinable. */
const LIVE_EVENT_STATUSES = ["open", "ready", "booked"];

/**
 * GET /api/v1/pulse/map?lat=&lng=&radius=&date=
 *
 * Every turf within `radius` km of (lat, lng) that has coordinates, each with:
 *   - how many 90-minute slots are still free on `date`, and the next free one;
 *   - the upcoming public matches on its grounds that still need players.
 *
 * One request feeds the whole map. The obvious alternative — call
 * /bookings/available-slots per ground — is an N+1 that would fire dozens of
 * requests from a single page load.
 *
 * Public and unauthenticated: this is the same information a visitor would get
 * by opening each turf page, just aggregated.
 */
export const getCityPulse = asyncHandler(async (req, res) => {
    const { lat, lng } = req.query;

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "Valid lat and lng query parameters are required",
        });
    }
    // Reject impossible coordinates rather than running a pointless radius scan.
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "lat must be within ±90 and lng within ±180",
        });
    }

    const radiusKm = Math.min(
        Math.max(parseFloat(req.query.radius) || DEFAULT_RADIUS_KM, MIN_RADIUS_KM),
        MAX_RADIUS_KM
    );

    // Dates are app-local wall clock (see utils/appTime.js), never the server's.
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date ?? "")
        ? req.query.date
        : todayLocalISO();

    // Round the cache key's coordinates to ~1km so panning the map slightly
    // still hits a warm entry instead of missing on every pixel of movement.
    const cacheKey = `pulse:map:${latitude.toFixed(2)}:${longitude.toFixed(2)}:${radiusKm}:${date}`;
    const cached = await get(cacheKey);
    if (cached) {
        return res.status(200).json(new ApiResponse(200, "City pulse", cached));
    }

    // 1. Turfs in range. Haversine in SQL (no PostGIS in this database), matching
    //    the formula already used by /events/nearby so both agree on distance.
    const turfs = await pgClient.$queryRaw`
        SELECT
            t.id,
            t.name,
            t.slug,
            t.city,
            t.rating,
            t.logo_url,
            t.images,
            t.operating_hours,
            t.latitude::double precision  AS latitude,
            t.longitude::double precision AS longitude,
            (2 * 6371 * asin(sqrt(
                power(sin(radians(t.latitude::double precision - ${latitude}) / 2), 2)
                + cos(radians(${latitude})) * cos(radians(t.latitude::double precision))
                * power(sin(radians(t.longitude::double precision - ${longitude}) / 2), 2)
            ))) AS distance_km
        FROM turfs t
        WHERE t.latitude IS NOT NULL
            AND t.longitude IS NOT NULL
            AND t.verified = true
            AND (2 * 6371 * asin(sqrt(
                    power(sin(radians(t.latitude::double precision - ${latitude}) / 2), 2)
                    + cos(radians(${latitude})) * cos(radians(t.latitude::double precision))
                    * power(sin(radians(t.longitude::double precision - ${longitude}) / 2), 2)
                ))) <= ${radiusKm}
        ORDER BY distance_km ASC
        LIMIT ${MAX_TURFS}
    `;

    if (turfs.length === 0) {
        const empty = {
            center: { lat: latitude, lng: longitude },
            radius_km: radiusKm,
            date,
            turfs: [],
            totals: { turfs: 0, open_slots: 0, open_matches: 0 },
        };
        await set(cacheKey, empty, PULSE_MAP_TTL);
        return res.status(200).json(new ApiResponse(200, "No turfs in range", empty));
    }

    const turfIds = turfs.map((t) => t.id);

    // 2. Their bookable grounds.
    const grounds = await pgClient.grounds.findMany({
        where: { turf_id: { in: turfIds }, status: "available" },
        select: { id: true, turf_id: true, name: true, sport_type: true, hourly_rate: true },
    });
    const groundIds = grounds.map((g) => g.id);

    // 3+4. Slot exception rows and live matches for every one of those grounds,
    //      in two queries rather than two per ground.
    const [slotRows, events] = await Promise.all([
        groundIds.length
            ? pgClient.slots.findMany({
                  where: { ground_id: { in: groundIds }, date: new Date(date) },
              })
            : [],
        groundIds.length
            ? pgClient.events.findMany({
                  where: {
                      ground_id: { in: groundIds },
                      status: { in: LIVE_EVENT_STATUSES },
                      visibility: "public",
                      event_date: { gte: new Date(todayLocalISO()) },
                  },
                  select: {
                      id: true,
                      title: true,
                      sport_type: true,
                      event_date: true,
                      start_time: true,
                      end_time: true,
                      min_players: true,
                      max_players: true,
                      current_players: true,
                      entry_fee: true,
                      ground_id: true,
                  },
                  orderBy: [{ event_date: "asc" }, { start_time: "asc" }],
              })
            : [],
    ]);

    const slotsByGround = new Map(slotRows.map((row) => [row.ground_id, row]));
    const groundsByTurf = new Map();
    for (const g of grounds) {
        if (!groundsByTurf.has(g.turf_id)) groundsByTurf.set(g.turf_id, []);
        groundsByTurf.get(g.turf_id).push(g);
    }
    const eventsByGround = new Map();
    for (const e of events) {
        if (!eventsByGround.has(e.ground_id)) eventsByGround.set(e.ground_id, []);
        eventsByGround.get(e.ground_id).push(e);
    }

    // A slot that has already begun is not bookable, but only matters for today —
    // every future date is open from midnight.
    const filterPastSlots = isTodayLocal(date);
    const minuteNow = nowLocalMinutes();

    let totalOpenSlots = 0;
    let totalOpenMatches = 0;

    const shaped = turfs.map((turf) => {
        const turfGrounds = groundsByTurf.get(turf.id) ?? [];

        // Trading hours are a turf-level setting, so the mask is computed once
        // per turf rather than once per ground.
        const closed = closedSlotCodes(turf.operating_hours);

        // A slot counts as free if ANY of the turf's grounds still has it. That
        // matches what a player actually cares about ("can I play here at 8pm?"),
        // and the marker links through to the turf where they pick a ground.
        const freeCodes = SLOT_CODES.filter((code) => {
            if (closed.has(code)) return false;
            if (filterPastSlots && slotStartMinute(code) <= minuteNow) return false;
            return turfGrounds.some((g) => {
                const row = slotsByGround.get(g.id);
                // No exceptions row means the whole day is open — same rule as
                // getSlotGrid(). Absence of a row is not absence of availability.
                return row ? row[code] !== false : true;
            });
        });

        const turfEvents = turfGrounds
            .flatMap((g) => eventsByGround.get(g.id) ?? [])
            .map((e) => ({
                id: e.id,
                title: e.title,
                sport_type: e.sport_type,
                event_date: e.event_date,
                start_time: e.start_time,
                end_time: e.end_time,
                entry_fee: e.entry_fee != null ? Number(e.entry_fee) : 0,
                current_players: e.current_players ?? 0,
                max_players: e.max_players,
                spots_left: Math.max((e.max_players ?? 0) - (e.current_players ?? 0), 0),
            }));

        totalOpenSlots += freeCodes.length;
        totalOpenMatches += turfEvents.length;

        return {
            id: turf.id,
            name: turf.name,
            slug: turf.slug,
            city: turf.city,
            lat: turf.latitude,
            lng: turf.longitude,
            rating: turf.rating != null ? Number(turf.rating) : null,
            logo_url: turf.logo_url,
            image: Array.isArray(turf.images) ? turf.images[0] ?? null : null,
            distance_km:
                turf.distance_km != null
                    ? Math.round(Number(turf.distance_km) * 10) / 10
                    : null,
            grounds_count: turfGrounds.length,
            open_slots: freeCodes.length,
            // "18:00" — the soonest slot a player could still take today.
            next_free_slot: freeCodes.length
                ? minutesToTimeString(slotStartMinute(freeCodes[0]))
                : null,
            free_slot_codes: freeCodes,
            open_matches: turfEvents.length,
            matches: turfEvents.slice(0, MATCHES_PER_TURF),
        };
    });

    const payload = {
        center: { lat: latitude, lng: longitude },
        radius_km: radiusKm,
        date,
        turfs: shaped,
        totals: {
            turfs: shaped.length,
            open_slots: totalOpenSlots,
            open_matches: totalOpenMatches,
        },
    };

    await set(cacheKey, payload, PULSE_MAP_TTL);
    logger.info(
        `pulse/map: ${shaped.length} turfs, ${totalOpenSlots} free slots, ${totalOpenMatches} matches within ${radiusKm}km`
    );

    return res.status(200).json(new ApiResponse(200, "City pulse", payload));
});

/**
 * GET /api/v1/pulse/stats
 *
 * Counters and a short recent-activity feed for the landing page ticker.
 *
 * Privacy: the feed is public-by-construction — it only reports things that are
 * already publicly visible (a public match being created, a player joining one),
 * and it carries first names only, never emails, ids or exact addresses.
 */
export const getCityStats = asyncHandler(async (req, res) => {
    const cached = await get("pulse:stats");
    if (cached) {
        return res.status(200).json(new ApiResponse(200, "City stats", cached));
    }

    const today = new Date(todayLocalISO());
    const weekAhead = new Date(today);
    weekAhead.setDate(weekAhead.getDate() + 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [matchesThisWeek, playersTotal, bookingsToday, turfsLive, recentEvents, recentJoins] =
        await Promise.all([
            pgClient.events.count({
                where: {
                    visibility: "public",
                    status: { in: LIVE_EVENT_STATUSES },
                    event_date: { gte: today, lt: weekAhead },
                },
            }),
            // Players only — turf admins signing up isn't what "players joined"
            // claims, and counting them would quietly overstate it.
            pgClient.users.count({
                where: { user_type: "player", created_at: { gte: monthAgo } },
            }),
            // Active states only — a cancelled booking is not a booking, and
            // counting it would inflate the number the ticker is meant to prove.
            pgClient.bookings.count({
                where: { booking_date: today, booking_status: { in: [...ACTIVE_STATES] } },
            }),
            pgClient.turfs.count({ where: { verified: true } }),

            // Newly posted public matches.
            pgClient.events.findMany({
                where: {
                    visibility: "public",
                    status: { in: LIVE_EVENT_STATUSES },
                    event_date: { gte: today },
                },
                select: {
                    id: true,
                    title: true,
                    sport_type: true,
                    created_at: true,
                    max_players: true,
                    current_players: true,
                    grounds: { select: { turfs: { select: { name: true, city: true } } } },
                },
                orderBy: { created_at: "desc" },
                take: 8,
            }),

            // Players who just joined a public match.
            pgClient.event_participants.findMany({
                where: {
                    status: "approved",
                    events: { visibility: "public", event_date: { gte: today } },
                },
                select: {
                    id: true,
                    joined_at: true,
                    users: { select: { first_name: true } },
                    events: {
                        select: {
                            id: true,
                            title: true,
                            sport_type: true,
                            grounds: { select: { turfs: { select: { name: true } } } },
                        },
                    },
                },
                orderBy: { joined_at: "desc" },
                take: 8,
            }),
        ]);

    // Merge both streams into one reverse-chronological feed. Shaped to a single
    // `{ kind, text, at }` form so the client renders one row component, not two.
    const activity = [
        ...recentEvents.map((e) => ({
            kind: "match_created",
            id: `event:${e.id}`,
            href: `/events/${e.id}`,
            actor: null,
            sport: e.sport_type,
            text: e.title,
            place: e.grounds?.turfs?.name ?? null,
            spots_left: Math.max((e.max_players ?? 0) - (e.current_players ?? 0), 0),
            at: e.created_at,
        })),
        ...recentJoins.map((p) => ({
            kind: "player_joined",
            id: `join:${p.id}`,
            href: `/events/${p.events?.id ?? ""}`,
            actor: p.users?.first_name ?? "A player",
            sport: p.events?.sport_type ?? null,
            text: p.events?.title ?? "a match",
            place: p.events?.grounds?.turfs?.name ?? null,
            spots_left: null,
            at: p.joined_at,
        })),
    ]
        .filter((row) => row.at)
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .slice(0, 10);

    const payload = {
        counters: {
            matches_this_week: matchesThisWeek,
            players_joined_30d: playersTotal,
            bookings_today: bookingsToday,
            turfs_live: turfsLive,
        },
        activity,
    };

    await set("pulse:stats", payload, PULSE_STATS_TTL);
    return res.status(200).json(new ApiResponse(200, "City stats", payload));
});
