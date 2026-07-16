import { pgClient } from "../../prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";
import { logger } from "../../../logs/logger.js";

// Coupon / promo-code management for a turf manager. A promotion always belongs to
// the caller's turf (turf_id). Optionally it can be narrowed to:
//   - a single ground   (ground_id)
//   - specific sports    (applicable_sports: ["football", ...])
//   - specific users     (applicable_users: [uuid, ...])
//   - specific weekdays  (applicable_days: [0..6], 0 = Sunday)
// plus a validity window, a global usage cap, a min-booking floor and a max-discount
// ceiling. Redemption is applied at booking time (see utils/bookingService.js).

// ---- helpers ---------------------------------------------------------------

// Resolve the turf the caller manages. A turf_admin owns exactly one turf; a
// super_admin may pass ?turf_id / body.turf_id to act on a specific turf.
async function resolveManagerTurf(req) {
    if (req.user.user_type === "super_admin") {
        const turfId = req.body?.turf_id || req.query?.turf_id;
        if (turfId) {
            const turf = await pgClient.turfs.findUnique({ where: { id: turfId }, select: { id: true } });
            if (!turf) throw ApiError.fromCode(ERROR_CODES.VENUE_NOT_FOUND ?? ERROR_CODES.VALIDATION_ERROR, {
                message: "Turf not found",
            });
            return turf.id;
        }
    }
    const turf = await pgClient.turfs.findFirst({
        where: { admin_user_id: req.user.id },
        select: { id: true },
    });
    if (!turf) throw ApiError.fromCode(ERROR_CODES.NO_TURF_FOR_ADMIN);
    return turf.id;
}

// Normalise a JSON array field: undefined -> keep unset, null/[] -> clear, else the
// cleaned array. Returns { set: true, value } only when the field was provided.
function jsonArrayField(raw, mapItem = (x) => x) {
    if (raw === undefined) return { set: false };
    if (raw === null) return { set: true, value: null };
    if (!Array.isArray(raw)) throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
        message: "Expected an array",
    });
    const cleaned = raw.map(mapItem).filter((x) => x !== null && x !== undefined && x !== "");
    return { set: true, value: cleaned.length ? cleaned : null };
}

// Shared validation for create/update. `partial` skips required-field checks on update.
async function buildPromotionData(req, turfId, { partial = false } = {}) {
    const b = req.body ?? {};
    const data = {};

    // --- code (unique, uppercased) ---
    if (b.code !== undefined || !partial) {
        const code = (b.code ?? "").toString().trim().toUpperCase();
        if (!code) throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "A code is required" });
        if (code.length > 50) throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "Code too long (max 50)" });
        data.code = code;
    }
    // --- title ---
    if (b.title !== undefined || !partial) {
        const title = (b.title ?? "").toString().trim();
        if (!title) throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "A title is required" });
        data.title = title;
    }
    if (b.description !== undefined) data.description = b.description ? String(b.description) : null;

    // --- discount type + value ---
    if (b.discount_type !== undefined || !partial) {
        const t = (b.discount_type ?? "").toString();
        if (!["percentage", "fixed_amount"].includes(t)) {
            throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
                message: "discount_type must be 'percentage' or 'fixed_amount'",
            });
        }
        data.discount_type = t;
    }
    if (b.discount_value !== undefined || !partial) {
        const v = Number(b.discount_value);
        if (!Number.isFinite(v) || v <= 0) {
            throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "discount_value must be a positive number" });
        }
        const effType = data.discount_type ?? b.discount_type;
        if (effType === "percentage" && v > 100) {
            throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "A percentage discount can't exceed 100" });
        }
        data.discount_value = v;
    }

    // --- money guards ---
    if (b.minimum_booking_amount !== undefined) {
        const m = b.minimum_booking_amount === null ? null : Number(b.minimum_booking_amount);
        if (m !== null && (!Number.isFinite(m) || m < 0)) {
            throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "minimum_booking_amount must be ≥ 0" });
        }
        data.minimum_booking_amount = m;
    }
    if (b.maximum_discount_amount !== undefined) {
        const m = b.maximum_discount_amount === null ? null : Number(b.maximum_discount_amount);
        if (m !== null && (!Number.isFinite(m) || m < 0)) {
            throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "maximum_discount_amount must be ≥ 0" });
        }
        data.maximum_discount_amount = m;
    }

    // --- validity window ---
    if (b.valid_from !== undefined || !partial) {
        const d = new Date(b.valid_from);
        if (Number.isNaN(d.getTime())) throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "Invalid valid_from" });
        data.valid_from = d;
    }
    if (b.valid_until !== undefined || !partial) {
        const d = new Date(b.valid_until);
        if (Number.isNaN(d.getTime())) throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "Invalid valid_until" });
        data.valid_until = d;
    }
    if (data.valid_from && data.valid_until && data.valid_from >= data.valid_until) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "valid_until must be after valid_from" });
    }

    // --- usage cap ---
    if (b.usage_limit !== undefined) {
        const u = b.usage_limit === null ? null : Number(b.usage_limit);
        if (u !== null && (!Number.isInteger(u) || u < 1)) {
            throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "usage_limit must be a positive whole number" });
        }
        data.usage_limit = u;
    }

    // --- scope: ground (must belong to the manager's turf) ---
    if (b.ground_id !== undefined) {
        if (!b.ground_id) {
            data.ground_id = null;
        } else {
            const ground = await pgClient.grounds.findUnique({
                where: { id: b.ground_id },
                select: { id: true, turf_id: true },
            });
            if (!ground || ground.turf_id !== turfId) {
                throw ApiError.fromCode(ERROR_CODES.PROMO_SCOPE_FORBIDDEN, {
                    message: "That ground doesn't belong to your turf",
                });
            }
            data.ground_id = b.ground_id;
        }
    }

    // --- scope: users / days (JSON arrays) ---
    const users = jsonArrayField(b.applicable_users, (u) => String(u).trim());
    if (users.set) data.applicable_users = users.value;

    const days = jsonArrayField(b.applicable_days, (d) => Number(d));
    if (days.set) {
        if (days.value && days.value.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
            throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "applicable_days must be 0–6 (Sun–Sat)" });
        }
        data.applicable_days = days.value;
    }

    // --- status ---
    if (b.status !== undefined) {
        if (!["active", "inactive", "expired"].includes(b.status)) {
            throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "Invalid status" });
        }
        data.status = b.status;
    }

    return data;
}

// Attach derived, read-only fields the UI needs (never persisted).
function decorate(promo) {
    const now = new Date();
    const isExpired = promo.valid_until && new Date(promo.valid_until) < now;
    const capReached = promo.usage_limit != null && (promo.used_count ?? 0) >= promo.usage_limit;
    return {
        ...promo,
        is_expired: Boolean(isExpired),
        is_exhausted: Boolean(capReached),
        // "effective" state the manager cares about at a glance.
        effective_status: isExpired ? "expired" : capReached ? "exhausted" : promo.status,
    };
}

// ---- CRUD ------------------------------------------------------------------

const createPromotion = asyncHandler(async (req, res) => {
    const turfId = await resolveManagerTurf(req);
    const data = await buildPromotionData(req, turfId);
    data.turf_id = turfId;

    // Codes are unique PER TURF — the same code can exist on another turf, but not
    // twice on this one.
    const clash = await pgClient.promotions.findFirst({
        where: { turf_id: turfId, code: data.code },
        select: { id: true },
    });
    if (clash) throw ApiError.fromCode(ERROR_CODES.PROMO_CODE_EXISTS);

    const created = await pgClient.promotions.create({ data });
    logger.info(`promotion created: ${created.code} (turf ${turfId}) by ${req.user.id}`);
    return res.status(201).json(new ApiResponse(201, "Promotion created", decorate(created)));
});

const getPromotions = asyncHandler(async (req, res) => {
    const turfId = await resolveManagerTurf(req);
    const promos = await pgClient.promotions.findMany({
        where: { turf_id: turfId },
        orderBy: { created_at: "desc" },
        include: { ground_rate: { select: { id: true, name: true } } },
    });
    return res
        .status(200)
        .json(new ApiResponse(200, `${promos.length} promotions`, { promotions: promos.map(decorate) }));
});

const getPromotionById = asyncHandler(async (req, res) => {
    const turfId = await resolveManagerTurf(req);
    const { promotion_id } = req.params;
    const promo = await pgClient.promotions.findUnique({
        where: { id: promotion_id },
        include: { ground_rate: { select: { id: true, name: true } } },
    });
    if (!promo || promo.turf_id !== turfId) throw ApiError.fromCode(ERROR_CODES.PROMO_NOT_FOUND);
    return res.status(200).json(new ApiResponse(200, "Promotion found", decorate(promo)));
});

const updatePromotion = asyncHandler(async (req, res) => {
    const turfId = await resolveManagerTurf(req);
    const { promotion_id } = req.params;

    const existing = await pgClient.promotions.findUnique({
        where: { id: promotion_id },
        select: { id: true, turf_id: true, code: true },
    });
    if (!existing || existing.turf_id !== turfId) throw ApiError.fromCode(ERROR_CODES.PROMO_NOT_FOUND);

    const data = await buildPromotionData(req, turfId, { partial: true });

    // If the code changed, keep it unique WITHIN this turf.
    if (data.code && data.code !== existing.code) {
        const clash = await pgClient.promotions.findFirst({
            where: { turf_id: turfId, code: data.code, id: { not: promotion_id } },
            select: { id: true },
        });
        if (clash) throw ApiError.fromCode(ERROR_CODES.PROMO_CODE_EXISTS);
    }
    data.updated_at = new Date();

    const updated = await pgClient.promotions.update({ where: { id: promotion_id }, data });
    logger.info(`promotion updated: ${updated.code} by ${req.user.id}`);
    return res.status(200).json(new ApiResponse(200, "Promotion updated", decorate(updated)));
});

const deletePromotion = asyncHandler(async (req, res) => {
    const turfId = await resolveManagerTurf(req);
    const { promotion_id } = req.params;

    const existing = await pgClient.promotions.findUnique({
        where: { id: promotion_id },
        select: { id: true, turf_id: true },
    });
    if (!existing || existing.turf_id !== turfId) throw ApiError.fromCode(ERROR_CODES.PROMO_NOT_FOUND);

    // If it has ever been redeemed, deactivate instead of hard-deleting so the
    // usage/analytics history (promotion_usage FKs) stays intact.
    const usedCount = await pgClient.promotion_usage.count({ where: { promotion_id } });
    if (usedCount > 0) {
        const deactivated = await pgClient.promotions.update({
            where: { id: promotion_id },
            data: { status: "inactive", updated_at: new Date() },
        });
        return res
            .status(200)
            .json(new ApiResponse(200, "Promotion had redemptions — deactivated instead of deleted", decorate(deactivated)));
    }

    await pgClient.promotions.delete({ where: { id: promotion_id } });
    logger.info(`promotion deleted: ${promotion_id} by ${req.user.id}`);
    return res.status(200).json(new ApiResponse(200, "Promotion deleted", { id: promotion_id }));
});

// ---- Analytics (powers the dashboard charts) -------------------------------

const getPromotionAnalytics = asyncHandler(async (req, res) => {
    const turfId = await resolveManagerTurf(req);

    // Window: last N days (default 30) for the time-series charts.
    const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 180);
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    // Headline totals + per-coupon breakdown + a daily redemptions/discount series.
    const [totals, byCoupon, series, statusCounts] = await Promise.all([
        // Overall redemptions + discount given for this turf's promotions.
        pgClient.$queryRaw`
            SELECT COUNT(*)::int AS redemptions,
                   COALESCE(SUM(pu.discount_amount), 0)::float AS total_discount,
                   COUNT(DISTINCT pu.user_id)::int AS unique_users
            FROM promotion_usage pu
            JOIN promotions p ON p.id = pu.promotion_id
            WHERE p.turf_id = ${turfId}::uuid
        `,
        // Top coupons by redemptions.
        pgClient.$queryRaw`
            SELECT p.code, p.title,
                   COUNT(pu.id)::int AS redemptions,
                   COALESCE(SUM(pu.discount_amount), 0)::float AS total_discount
            FROM promotions p
            LEFT JOIN promotion_usage pu ON pu.promotion_id = p.id
            WHERE p.turf_id = ${turfId}::uuid
            GROUP BY p.id, p.code, p.title
            ORDER BY redemptions DESC, total_discount DESC
            LIMIT 10
        `,
        // Daily series over the window.
        pgClient.$queryRaw`
            SELECT to_char(date_trunc('day', pu.used_at), 'YYYY-MM-DD') AS day,
                   COUNT(*)::int AS redemptions,
                   COALESCE(SUM(pu.discount_amount), 0)::float AS discount
            FROM promotion_usage pu
            JOIN promotions p ON p.id = pu.promotion_id
            WHERE p.turf_id = ${turfId}::uuid AND pu.used_at >= ${since}
            GROUP BY 1
            ORDER BY 1
        `,
        // Count of promotions by (effective) status for a small breakdown.
        pgClient.$queryRaw`
            SELECT
                COUNT(*) FILTER (WHERE status = 'active' AND valid_until >= now()
                    AND (usage_limit IS NULL OR used_count < usage_limit))::int AS active,
                COUNT(*) FILTER (WHERE status = 'inactive')::int AS inactive,
                COUNT(*) FILTER (WHERE valid_until < now())::int AS expired,
                COUNT(*) FILTER (WHERE usage_limit IS NOT NULL AND used_count >= usage_limit)::int AS exhausted,
                COUNT(*)::int AS total
            FROM promotions
            WHERE turf_id = ${turfId}::uuid
        `,
    ]);

    // Fill missing days with zeros so the chart has a continuous x-axis.
    const map = new Map(series.map((r) => [r.day, r]));
    const timeseries = [];
    for (let i = 0; i < days; i++) {
        const d = new Date(since);
        d.setDate(since.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        const row = map.get(key);
        timeseries.push({
            day: key,
            redemptions: row?.redemptions ?? 0,
            discount: row ? Math.round(row.discount * 100) / 100 : 0,
        });
    }

    return res.status(200).json(
        new ApiResponse(200, "Promotion analytics", {
            range_days: days,
            totals: totals[0] ?? { redemptions: 0, total_discount: 0, unique_users: 0 },
            status_counts: statusCounts[0] ?? { active: 0, inactive: 0, expired: 0, exhausted: 0, total: 0 },
            by_coupon: byCoupon,
            timeseries,
        })
    );
});

// ---- Customer-facing: coupons a booker can actually use --------------------

// GET /coupons/available?ground_id=&date= — the coupons the CALLER may apply to a
// booking on this ground (and date, if given). Respects every scope: validity
// window, ground/turf/global scope, usage cap, day / sport / user targeting — so a
// user only ever sees coupons meant for them (private/group coupons never leak).
const getAvailableCoupons = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { ground_id, date } = req.query;
    if (!ground_id) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, { message: "ground_id is required" });
    }

    const ground = await pgClient.grounds.findUnique({
        where: { id: ground_id },
        select: { id: true, turf_id: true, sport_type: true },
    });
    if (!ground) throw ApiError.fromCode(ERROR_CODES.GROUND_NOT_FOUND ?? ERROR_CODES.VALIDATION_ERROR, {
        message: "Ground not found",
    });

    // Validity + weekday are judged against the BOOKING date when given (you book
    // in advance), else "today". Parse as UTC midnight so the weekday is the
    // calendar weekday regardless of server timezone.
    const dayStr = date || new Date().toISOString().slice(0, 10);
    const dayOfWeek = new Date(`${dayStr}T00:00:00Z`).getUTCDay();

    const promos = await pgClient.promotions.findMany({
        where: {
            status: "active",
            OR: [
                { ground_id: ground.id },
                { ground_id: null, turf_id: ground.turf_id },
                { ground_id: null, turf_id: null },
            ],
        },
        orderBy: { discount_value: "desc" },
    });

    const usable = promos.filter((p) => {
        // validity window vs the (booking) date
        if (dayStr < p.valid_from.toISOString().slice(0, 10)) return false;
        if (dayStr > p.valid_until.toISOString().slice(0, 10)) return false;
        // usage cap
        if (p.usage_limit != null && (p.used_count ?? 0) >= p.usage_limit) return false;
        // day targeting
        if (Array.isArray(p.applicable_days) && p.applicable_days.length > 0) {
            if (!p.applicable_days.includes(dayOfWeek)) return false;
        }
        // user / group targeting — a private coupon is invisible to everyone else
        if (Array.isArray(p.applicable_users) && p.applicable_users.length > 0) {
            if (!p.applicable_users.includes(userId)) return false;
        }
        return true;
    });

    const coupons = usable.map((p) => ({
        code: p.code,
        title: p.title,
        description: p.description,
        discount_type: p.discount_type,
        discount_value: Number(p.discount_value),
        minimum_booking_amount: p.minimum_booking_amount != null ? Number(p.minimum_booking_amount) : null,
        maximum_discount_amount: p.maximum_discount_amount != null ? Number(p.maximum_discount_amount) : null,
        // Flag targeted (non-public) coupons so the UI can badge them.
        is_targeted: Array.isArray(p.applicable_users) && p.applicable_users.length > 0,
    }));

    return res.status(200).json(new ApiResponse(200, `${coupons.length} coupons`, { coupons }));
});

export {
    createPromotion,
    getPromotions,
    getPromotionById,
    updatePromotion,
    deletePromotion,
    getPromotionAnalytics,
    getAvailableCoupons,
};
