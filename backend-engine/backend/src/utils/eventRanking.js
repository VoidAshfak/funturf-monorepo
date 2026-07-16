import { pgClient, Prisma } from "../prisma.js";
import { getAcceptedTurfmateIds } from "./turfmateService.js";
import { logger } from "../../logs/logger.js";

/**
 * Smart "recommended" ranking for the events feed.
 *
 * The feed is server-paginated (infinite scroll), so ranking MUST happen in SQL
 * before paging — you can't reorder pages the client hasn't loaded. We compute a
 * single weighted score per event and ORDER BY it, then return just the ordered
 * ids + total for that page. The controller hydrates those ids with its own rich
 * `select` (keeping the DTO shape) and reorders to match — so this module owns
 * "what ranks highest" and nothing else (SRP).
 *
 * Signals & weights are in the product's stated priority order (higher = matters
 * more). Each signal is normalised to 0..1, so weights are directly comparable.
 * A signal that can't be computed (no user location, anonymous caller, missing
 * turf rating) contributes 0 — it never blocks, the other signals just decide.
 */

// Weight per signal (sum = 100 for readability; absolute scale is irrelevant).
const W = Object.freeze({
    nearby: 28,     // 1. closest turf to the user
    turfmate: 22,   // 2. a turfmate is organising or already in
    soon: 18,       // 3. happening soonest
    weekend: 12,    // 4. Friday/Saturday (Bangladesh weekend)
    rating: 9,      // 5. high-rated turf
    popular: 6,     // 6. popular turf (booking volume)
    organizer: 5,   // 7. experienced organiser (matches organised)
});

// Tuning constants for the normalisers.
const NEARBY_RADIUS_KM = 25;   // distance at/beyond which the nearby score is 0
const SOON_HORIZON_DAYS = 14;  // events further out than this score 0 on recency
const POPULAR_CAP = 200;       // total_bookings that saturates the popularity score
const ORGANIZER_CAP = 50;      // matches-organised that saturates the organiser score

/**
 * Build the SQL score expression. All dynamic values are bound parameters — no
 * string interpolation of user input, so this is injection-safe.
 *
 * @param {number|null} lat user home latitude (null -> nearby signal = 0)
 * @param {number|null} lng user home longitude
 * @param {string[]} turfmateIds accepted turfmate user ids ([] -> turfmate = 0)
 */
function scoreExpr(lat, lng, turfmateIds) {
    // --- 1. Nearby: haversine km between the user and the turf, turned into a
    // 1..0 closeness ramp over NEARBY_RADIUS_KM. Null when either point is missing.
    const nearby =
        lat != null && lng != null
            ? Prisma.sql`
                (1 - LEAST(
                    (2 * 6371 * asin(sqrt(
                        power(sin(radians(t.latitude::double precision - ${lat}) / 2), 2)
                        + cos(radians(${lat})) * cos(radians(t.latitude::double precision))
                        * power(sin(radians(t.longitude::double precision - ${lng}) / 2), 2)
                    ))) / ${NEARBY_RADIUS_KM}, 1))`
            : Prisma.sql`0`;
    // Guard against a turf with no coordinates (distance undefined -> 0 closeness).
    const nearbyScore =
        lat != null && lng != null
            ? Prisma.sql`(CASE WHEN t.latitude IS NULL OR t.longitude IS NULL THEN 0 ELSE ${nearby} END)`
            : Prisma.sql`0`;

    // --- 2. Turfmate involved: organiser is a turfmate, or an approved player is.
    const turfmateScore =
        turfmateIds.length > 0
            ? Prisma.sql`
                (CASE WHEN e.organizer_id = ANY(${turfmateIds}::uuid[])
                       OR EXISTS (
                            SELECT 1 FROM event_participants ep
                            WHERE ep.event_id = e.id
                              AND ep.status = 'approved'
                              AND ep.user_id = ANY(${turfmateIds}::uuid[])
                       )
                      THEN 1 ELSE 0 END)`
            : Prisma.sql`0`;

    // --- 3. Soonest: linear decay from today (1) to SOON_HORIZON_DAYS out (0).
    const soonScore = Prisma.sql`
        GREATEST(0, 1 - (e.event_date - CURRENT_DATE)::double precision / ${SOON_HORIZON_DAYS})`;

    // --- 4. Weekend: Postgres DOW is Sun=0..Sat=6, so Fri=5, Sat=6.
    const weekendScore = Prisma.sql`
        (CASE WHEN EXTRACT(DOW FROM e.event_date) IN (5, 6) THEN 1 ELSE 0 END)`;

    // --- 5. Turf rating: 0..5 stars -> 0..1.
    const ratingScore = Prisma.sql`(COALESCE(t.rating, 0)::double precision / 5)`;

    // --- 6. Turf popularity: log of booking volume, saturating at POPULAR_CAP.
    const popularScore = Prisma.sql`
        LEAST(ln(COALESCE(t.total_bookings, 0)::double precision + 1) / ln(${POPULAR_CAP} + 1), 1)`;

    // --- 7. Organiser experience: how many real matches they've organised
    // (cancelled excluded), log-scaled and saturating at ORGANIZER_CAP.
    const organizerScore = Prisma.sql`
        LEAST(ln((
            SELECT COUNT(*) FROM events oe
            WHERE oe.organizer_id = e.organizer_id
              AND oe.status <> 'cancelled'
        )::double precision + 1) / ln(${ORGANIZER_CAP} + 1), 1)`;

    return Prisma.sql`(
          ${W.nearby}    * ${nearbyScore}
        + ${W.turfmate}  * ${turfmateScore}
        + ${W.soon}      * ${soonScore}
        + ${W.weekend}   * ${weekendScore}
        + ${W.rating}    * ${ratingScore}
        + ${W.popular}   * ${popularScore}
        + ${W.organizer} * ${organizerScore}
    )`;
}

/**
 * Translate the feed filters into SQL WHERE conditions (same semantics as the
 * old Prisma `where`, plus a base "upcoming & live" restriction so the
 * recommendation feed never surfaces past or finished games).
 */
function buildConditions({ sport, timeframe, q, openOnly }) {
    const conds = [
        // Base: only games that haven't happened yet and are still live.
        Prisma.sql`e.event_date >= CURRENT_DATE`,
        Prisma.sql`e.status IN ('open', 'ready', 'booked')`,
    ];

    if (sport && sport !== "all") {
        conds.push(Prisma.sql`e.sport_type = ${sport}`);
    }

    if (timeframe && timeframe !== "all") {
        if (timeframe === "today") {
            conds.push(Prisma.sql`e.event_date = CURRENT_DATE`);
        } else if (timeframe === "week") {
            conds.push(Prisma.sql`e.event_date < CURRENT_DATE + INTERVAL '7 days'`);
        } else if (timeframe === "month") {
            conds.push(
                Prisma.sql`e.event_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'`
            );
        }
    }

    if (q && q.trim()) {
        const like = `%${q.trim()}%`;
        conds.push(Prisma.sql`(e.title ILIKE ${like} OR t.name ILIKE ${like})`);
    }

    // "Open" = still short of the minimum squad size.
    if (openOnly === "true") {
        conds.push(Prisma.sql`e.min_players > e.current_players`);
    }

    return Prisma.join(conds, " AND ");
}

/**
 * Rank + paginate the events feed.
 *
 * @param {Object} args
 * @param {string} [args.userId]   caller id (enables nearby + turfmate signals)
 * @param {Object} args.filters    { sport, timeframe, q, openOnly }
 * @param {number} args.skip       rows to skip (pagination offset)
 * @param {number} args.limit      page size
 * @returns {Promise<{ orderedIds: string[], total: number }>}
 */
export async function getRankedEventPage({ userId, filters, skip, limit }) {
    // Personalisation inputs — fetched only when we have a caller.
    let lat = null;
    let lng = null;
    let turfmateIds = [];

    if (userId) {
        const [me, mates] = await Promise.all([
            pgClient.users.findUnique({
                where: { id: userId },
                select: { latitude: true, longitude: true },
            }),
            getAcceptedTurfmateIds(userId),
        ]);
        // Decimal columns come back as strings/Decimal — coerce to Number for binding.
        lat = me?.latitude != null ? Number(me.latitude) : null;
        lng = me?.longitude != null ? Number(me.longitude) : null;
        turfmateIds = mates ?? [];
    }

    const score = scoreExpr(lat, lng, turfmateIds);
    const whereSql = buildConditions(filters);

    // One query: ranked page ids + the total row count (window fn) for pagination.
    // Tie-break by soonest kickoff then id, so paging is deterministic.
    const rows = await pgClient.$queryRaw`
        SELECT e.id,
               COUNT(*) OVER() AS total_count
        FROM events e
        LEFT JOIN grounds g ON g.id = e.ground_id
        LEFT JOIN turfs t ON t.id = g.turf_id
        WHERE ${whereSql}
        ORDER BY ${score} DESC,
                 (e.event_date + e.start_time) ASC,
                 e.id ASC
        LIMIT ${limit} OFFSET ${skip}
    `;

    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    const orderedIds = rows.map((r) => r.id);

    logger.info(
        `event ranking: user=${userId ?? "anon"} geo=${lat != null} mates=${turfmateIds.length} ` +
        `-> ${orderedIds.length}/${total} (skip=${skip})`
    );

    return { orderedIds, total };
}
