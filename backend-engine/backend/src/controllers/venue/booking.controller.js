import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";
import { logger } from "../../../logs/logger.js";
import { pgClient } from "../../prisma.js";
import { createNotification } from "../../utils/notificationService.js";
import {
    ACTIVE_STATES,
    MAX_UNPAID_HOLDS_PER_TURF,
    PAID_STATES,
    checkBookingWindow,
    claimSlot,
    computeSlotPricing,
    countActiveUnpaidHoldsForTurf,
    expireStaleHolds,
    getEventTrust,
    getSlotGrid,
    isAllowedProofUrl,
    isSlotLockConflict,
    isValidSlotCode,
    lockSlot,
    releaseSlotClaim,
    slotEndTime,
    takeOverSlotClaim,
    unlockSlot,
} from "../../utils/bookingService.js";

// Route-level `authorizeRoles` gates who may *reach* the admin endpoints;
// `isBookingAdmin` below decides who may act on a SPECIFIC booking. There is
// deliberately no bare "is this user a turf_admin?" helper — that check is what
// let any turf owner act on a competitor's bookings.

/**
 * May this caller administer THIS booking?
 *
 * Being a `turf_admin` is not enough — otherwise any turf owner on the platform
 * could confirm payments, reject proofs and cancel bookings on a competitor's
 * turf. Scope it to the turf they actually own. `super_admin` stays global.
 *
 * The booking must be loaded with `grounds.turfs.admin_user_id`.
 */
const isBookingAdmin = (req, booking) => {
    if (req.user?.user_type === "super_admin") return true;
    if (req.user?.user_type !== "turf_admin") return false;
    return booking?.grounds?.turfs?.admin_user_id === req.user.id;
};

/** Throw unless the caller administers this booking's turf. */
const assertBookingAdmin = (req, booking) => {
    if (!isBookingAdmin(req, booking)) throw ApiError.fromCode(ERROR_CODES.NOT_TURF_ADMIN);
};

// Bookings loaded for an admin action always need the owning turf admin.
const ADMIN_BOOKING_INCLUDE = {
    grounds: {
        select: {
            id: true,
            name: true,
            turfs: { select: { id: true, name: true, admin_user_id: true } },
        },
    },
};

// A single booking loaded for the detail / ticket-verify screens: turf (for
// RBAC + display) plus the booking owner (WHO the ticket belongs to). Shared by
// getBookingById and the reference lookup so both return the same shape.
const BOOKING_DETAIL_INCLUDE = {
    grounds: {
        select: {
            id: true,
            name: true,
            turfs: { select: { id: true, name: true, city: true, admin_user_id: true } },
        },
    },
    users_bookings_user_idTousers: {
        select: { id: true, first_name: true, last_name: true, profile_picture_url: true },
    },
};

// Whole-day difference (booking_date - today), for the 2-day free-cancel window.
const daysUntil = (date) => {
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((startOfDay(new Date(date)) - startOfDay(new Date())) / 86400000);
};

export const getAvailableSlots = asyncHandler(async (req, res) => {
    const { ground, date } = req.query;
    logger.info(`Received request to get available slots for ground ${ground} on ${date}`);

    if (!ground || !date) {
        // NOTE: winston's method is `warn`, not `warning`.
        logger.warn(`Did not receive query parameters properly`);
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "ground and date query parameters are required",
        });
    }

    // Reap expired unpaid holds first, so what we report is actually true.
    await expireStaleHolds({ groundId: ground, date });

    // No stored row == the whole day is open (see getSlotGrid). A ground is
    // therefore bookable the moment it's created — no slot seeding required.
    const availableSlots = await getSlotGrid(ground, date);

    // Which slots are merely HELD by an unpaid booking? The grid boolean stays
    // `true` for those (an unpaid hold doesn't lock), so the client can't tell
    // them apart without this. Surfacing it lets the UI say "held — book with
    // payment to take it" instead of silently failing on submit.
    const holds = await pgClient.slot_locks.findMany({
        where: { ground_id: ground, date: new Date(date), locked_until: { gt: new Date() } },
        select: { slot_code: true, locked_until: true },
    });
    const held_slots = holds
        // paid claims are parked far in the future; those already show as booleans
        .filter((h) => h.locked_until.getTime() < Date.now() + 24 * 60 * 60 * 1000)
        .map((h) => h.slot_code);

    // The CALLER's own bookings on this ground/date (route uses optional auth, so
    // this is empty for anonymous visitors). Without it a user's own slot looks
    // identical to a stranger's — either "booked" (their own paid booking) or
    // just "held" (their own unpaid one). Tell them it's theirs.
    let my_slots = [];
    if (req.user?.id) {
        const mine = await pgClient.bookings.findMany({
            where: {
                ground_id: ground,
                booking_date: new Date(date),
                user_id: req.user.id,
                booking_status: { in: [...ACTIVE_STATES] },
            },
            select: { id: true, slot: true, booking_status: true, payment_status: true },
        });
        my_slots = mine.map((b) => ({
            code: b.slot?.code,
            booking_id: b.id,
            booking_status: b.booking_status,
            payment_status: b.payment_status,
        }));
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, "Available slots found", { ...availableSlots, held_slots, my_slots })
        );
});

export const calculateBookingPrice = asyncHandler(async (req, res) => {
    const { ground_id, slot, booking_date, promo_code } = req.query;

    if (!ground_id || !slot || !booking_date) {
        logger.warn(`Did not receive query parameters properly`);
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "ground_id, slot and booking_date query parameters are required",
        });
    }

    const slot_row = await getSlotGrid(ground_id, booking_date);

    // Boolean grid = admin master enable + paid-lock. false -> not bookable.
    if (!Boolean(slot_row[slot])) throw ApiError.fromCode(ERROR_CODES.SLOT_UNAVAILABLE);

    const ground = await pgClient.grounds.findUnique({ where: { id: ground_id } });
    if (!ground) throw ApiError.fromCode(ERROR_CODES.GROUND_NOT_FOUND);

    // Shared pricing (same maths used when a real booking is created).
    const pricing = await computeSlotPricing({
        ground,
        slotCode: slot,
        bookingDate: booking_date,
        promoCode: promo_code,
    });

    return res.json(
        new ApiResponse(200, "Success", {
            isAvailable: true,
            reason: null,
            slot,
            booking_date,
            ...pricing,
        })
    );
});

// Create a booking on a ground+date+slot.
//
// Rules:
//  - only VERIFIED turfs + AVAILABLE grounds are bookable;
//  - a booking is "paid" if it carries a transaction_id or a payment_proof_url —
//    a paid claim LOCKS the slot (boolean off) and awaits admin verification;
//  - an "unpaid" booking is a soft hold: it does NOT lock the slot. Another user
//    can still take that slot WITH payment (which supersedes + notifies the
//    unpaid holder); a second UNPAID request on a held slot is rejected.
export const createBooking = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const {
        ground_id,
        booking_date,
        slot,
        event_id,
        paid,
        transaction_id,
        payment_proof_url,
        payment_method,
        promo_code,
        notes,
    } = req.body;

    if (!ground_id || !booking_date || !slot) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "ground_id, booking_date and slot are required",
        });
    }
    if (!isValidSlotCode(slot)) throw ApiError.fromCode(ERROR_CODES.INVALID_SLOT_CODE);

    // Gate: verified turf + available ground.
    const ground = await pgClient.grounds.findUnique({
        where: { id: ground_id },
        include: {
            turfs: {
                select: {
                    id: true,
                    name: true,
                    verified: true,
                    status: true,
                    admin_user_id: true,
                    advance_booking_days: true,
                },
            },
        },
    });
    if (!ground) throw ApiError.fromCode(ERROR_CODES.GROUND_NOT_FOUND);
    if (ground.status !== "available") throw ApiError.fromCode(ERROR_CODES.GROUND_NOT_AVAILABLE);
    const turf = ground.turfs;
    if (!turf?.verified) throw ApiError.fromCode(ERROR_CODES.TURF_NOT_VERIFIED);

    // Date must be inside the bookable window (not past, not beyond the turf's horizon).
    const windowError = checkBookingWindow(booking_date, turf.advance_booking_days);
    if (windowError === "past") throw ApiError.fromCode(ERROR_CODES.BOOKING_DATE_IN_PAST);
    if (windowError === "too_far") throw ApiError.fromCode(ERROR_CODES.BOOKING_TOO_FAR_AHEAD);

    // Paid claim = a transaction number OR an uploaded proof doc.
    const hasProof = Boolean(transaction_id?.trim() || payment_proof_url?.trim());
    const isPaid = Boolean(paid) || hasProof;
    if (isPaid && !hasProof) throw ApiError.fromCode(ERROR_CODES.PAYMENT_PROOF_REQUIRED);

    // The proof URL must be one WE hosted — an admin clicks it from the dashboard.
    if (!isAllowedProofUrl(payment_proof_url)) {
        throw ApiError.fromCode(ERROR_CODES.INVALID_PAYMENT_PROOF);
    }

    // A payment reference can only back one live booking (stops "I paid" replay).
    if (transaction_id?.trim()) {
        const reused = await pgClient.bookings.findFirst({
            where: {
                transaction_id: transaction_id.trim(),
                booking_status: { in: [...ACTIVE_STATES] },
            },
            select: { id: true },
        });
        if (reused) throw ApiError.fromCode(ERROR_CODES.DUPLICATE_TRANSACTION);
    }

    // Free any holds that outlived their TTL before judging availability, so an
    // abandoned hold never keeps a slot hostage.
    await expireStaleHolds({ groundId: ground_id, date: booking_date });

    // Anti-spam: cap how many slots one user can sit on unpaid PER TURF at once.
    if (!isPaid) {
        const holds = await countActiveUnpaidHoldsForTurf(userId, turf.id);
        if (holds >= MAX_UNPAID_HOLDS_PER_TURF) {
            logger.warn(`user ${userId} hit the per-turf unpaid-hold cap (${holds}) on turf ${turf.id}`);
            throw ApiError.fromCode(ERROR_CODES.TOO_MANY_UNPAID_HOLDS);
        }
    }

    // Slot must be admin-enabled (and not already paid-locked) for the date.
    // A missing row means every slot is still open — see getSlotGrid.
    const slotRow = await getSlotGrid(ground_id, booking_date);
    if (!Boolean(slotRow[slot])) throw ApiError.fromCode(ERROR_CODES.SLOT_UNAVAILABLE);

    // Optional event attach — must be the caller's own event.
    if (event_id) {
        const ev = await pgClient.events.findUnique({
            where: { id: event_id },
            select: { id: true, organizer_id: true },
        });
        if (!ev) throw ApiError.fromCode(ERROR_CODES.EVENT_NOT_FOUND);
        if (ev.organizer_id !== userId) {
            throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
                message: "You can only attach an event you organized",
            });
        }
    }

    const pricing = await computeSlotPricing({
        ground,
        slotCode: slot,
        bookingDate: booking_date,
        promoCode: promo_code,
    });

    // -----------------------------------------------------------------------
    // Everything that mutates state happens in ONE transaction. Either the slot
    // claim, the superseded holds and the booking all land, or none of them do —
    // no more "paid booking exists but the slot was never locked" states.
    //
    // The `slot_locks` unique constraint is the referee: if a concurrent request
    // claims this slot first, our INSERT raises P2002, the whole transaction
    // rolls back, and we answer SLOT_UNAVAILABLE. That's what makes this
    // double-booking-proof rather than merely unlikely.
    // -----------------------------------------------------------------------
    let booking;
    let supersededHolds = [];
    try {
        booking = await pgClient.$transaction(async (tx) => {
            // Who currently occupies this slot?
            const activeOnSlot = await tx.bookings.findMany({
                where: {
                    ground_id,
                    booking_date: new Date(booking_date),
                    booking_status: { in: [...ACTIVE_STATES] },
                    slot: { path: ["code"], equals: slot },
                },
                select: { id: true, user_id: true, payment_status: true },
            });

            // A paid/confirmed booking is a hard lock — nobody takes that slot.
            if (activeOnSlot.some((b) => PAID_STATES.includes(b.payment_status))) {
                throw ApiError.fromCode(ERROR_CODES.SLOT_UNAVAILABLE);
            }
            // One booking per user per slot — makes a double-click idempotent-ish
            // instead of creating two holds.
            if (activeOnSlot.some((b) => b.user_id === userId)) {
                throw ApiError.fromCode(ERROR_CODES.ALREADY_BOOKED_SLOT);
            }

            const unpaidHolds = activeOnSlot.filter((b) => b.payment_status === "pending");
            // Unpaid can't take a slot another unpaid user is holding; paid can.
            if (unpaidHolds.length > 0 && !isPaid) {
                throw ApiError.fromCode(ERROR_CODES.SLOT_HELD_UNPAID);
            }

            // Claim the slot. New claim -> INSERT (unique constraint arbitrates).
            // Superseding an unpaid holder -> take the existing claim over.
            if (unpaidHolds.length > 0) {
                await tx.bookings.updateMany({
                    where: { id: { in: unpaidHolds.map((b) => b.id) } },
                    data: {
                        booking_status: "cancelled",
                        cancelled_by: userId,
                        cancelled_at: new Date(),
                        cancellation_reason: "superseded_by_paid_booking",
                    },
                });
                await takeOverSlotClaim(tx, {
                    groundId: ground_id,
                    date: booking_date,
                    slotCode: slot,
                    userId,
                    paid: isPaid,
                });
                supersededHolds = unpaidHolds;
            } else {
                await claimSlot(tx, {
                    groundId: ground_id,
                    date: booking_date,
                    slotCode: slot,
                    userId,
                    paid: isPaid,
                });
            }

            const created = await tx.bookings.create({
                data: {
                    ground_id,
                    user_id: userId,
                    event_id: event_id || null,
                    booking_date: new Date(booking_date),
                    total_amount: pricing.base_rate,
                    discount_amount: pricing.discount,
                    final_amount: pricing.final_price,
                    payment_status: isPaid ? "partial" : "pending",
                    booking_status: "pending",
                    payment_method: payment_method || null,
                    transaction_id: transaction_id?.trim() || null,
                    payment_proof_url: payment_proof_url || null,
                    notes: notes || null,
                    slot: { code: slot, start_time: pricing.slot_time, end_time: slotEndTime(slot) },
                },
            });

            // A paid claim also flips the visible grid boolean off (hard lock).
            if (isPaid) await lockSlot(ground_id, booking_date, slot, tx);

            return created;
        });
    } catch (err) {
        // Lost the race for this slot — someone claimed it mid-transaction.
        if (isSlotLockConflict(err)) {
            logger.warn(`slot race lost: ground=${ground_id} date=${booking_date} slot=${slot} user=${userId}`);
            throw ApiError.fromCode(ERROR_CODES.SLOT_UNAVAILABLE);
        }
        throw err;
    }

    // ---- Side effects (notifications) run AFTER the transaction commits, so a
    // rolled-back booking can never send "your slot was taken" to anyone. ----
    await Promise.all(
        supersededHolds.map((b) =>
            createNotification({
                user_id: b.user_id,
                type: "booking_cancelled",
                title: "Your unpaid slot was taken",
                message: `Someone booked ${turf.name} (${booking_date} ${pricing.slot_time}) with payment. Unpaid bookings don't hold a slot — book with payment to secure it.`,
                data: { groundId: ground_id, bookingDate: booking_date, slot },
                priority: "high",
            })
        )
    );

    // Notify the turf admin (owner of the turf).
    await createNotification({
        user_id: turf.admin_user_id,
        type: isPaid ? "payment_pending" : "booking_reminder",
        title: isPaid ? "Payment awaiting verification" : "New unpaid booking",
        message: isPaid
            ? `A paid booking for ${turf.name} (${booking_date} ${pricing.slot_time}) needs your verification`
            : `A new unpaid booking was placed for ${turf.name} (${booking_date} ${pricing.slot_time})`,
        data: { bookingId: booking.id },
        priority: isPaid ? "high" : "medium",
        action_url: "/dashboard/bookings",
    });

    logger.info(
        `booking created: id=${booking.id} paid=${isPaid} user=${userId} ground=${ground_id} superseded=${supersededHolds.length}`
    );
    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                isPaid ? "Booking placed — awaiting payment verification" : "Unpaid booking placed",
                booking
            )
        );
});

// The caller's own bookings. Unpaid ones carry `hold_expires_at` so the UI can
// show the 2-hour countdown — a hold the user can't see is a hold they'll lose.
export const getMyBookings = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Clear out this user's dead holds first, so the list reflects reality.
    await expireStaleHolds();

    const bookings = await pgClient.bookings.findMany({
        where: { user_id: userId },
        orderBy: [{ booking_date: "desc" }, { created_at: "desc" }],
        include: {
            grounds: {
                // sport_type is needed so "attach booking to a match" can fill the
                // event's sport straight from the reservation's ground.
                select: { id: true, name: true, sport_type: true, turfs: { select: { id: true, name: true, city: true } } },
            },
        },
    });

    // Attach the live hold expiry (from the lock row — the source of truth).
    const locks = await pgClient.slot_locks.findMany({
        where: { locked_by_user_id: userId, locked_until: { gt: new Date() } },
    });
    const expiryOf = (b) =>
        locks.find(
            (l) =>
                l.ground_id === b.ground_id &&
                l.date.getTime() === b.booking_date.getTime() &&
                l.slot_code === b.slot?.code
        )?.locked_until ?? null;

    const withHold = bookings.map((b) => ({
        ...b,
        hold_expires_at:
            b.booking_status === "pending" && b.payment_status === "pending" ? expiryOf(b) : null,
    }));

    return res.status(200).json(new ApiResponse(200, `${withHold.length} bookings`, { bookings: withHold }));
});

// A single booking — visible to the owner or a turf admin. When an event is
// attached, embeds its trust snapshot (squad size, organizer). Payment proof is
// returned to both the owner and admins.
export const getBookingById = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { booking_id } = req.params;

    const booking = await pgClient.bookings.findUnique({
        where: { id: booking_id },
        include: BOOKING_DETAIL_INCLUDE,
    });
    if (!booking) throw ApiError.fromCode(ERROR_CODES.BOOKING_NOT_FOUND);

    // The booking carries a payment proof — only the owner and the turf's own
    // admin may see it, never an unrelated turf_admin.
    if (booking.user_id !== userId && !isBookingAdmin(req, booking)) {
        throw ApiError.fromCode(ERROR_CODES.NOT_BOOKING_OWNER);
    }

    const event_trust = booking.event_id ? await getEventTrust(booking.event_id) : null;

    return res.status(200).json(new ApiResponse(200, "Booking found", { ...booking, event_trust }));
});

// Resolve a printed ticket REFERENCE (the "FT-XXXXXXXX" short code = first 8 hex
// of the booking id) to a booking, for MANUAL verification when a QR won't scan.
//
// Scoped like every admin action: a turf_admin only resolves references on the
// turfs they own; super_admin is global. The 8-hex prefix is matched against the
// booking id in SQL (there's no stored reference column). 8 hex = 32 bits, so a
// collision within one turf is astronomically unlikely — but if two ever match
// we refuse rather than guess (BOOKING_REF_AMBIGUOUS).
export const lookupBookingByRef = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const isSuper = req.user.user_type === "super_admin";

    // Normalize "FT-7K3QX9A1" / "7k3qx9a1" -> "7k3qx9a1"; must be exactly 8 hex.
    const hex = String(req.query.code ?? "")
        .trim()
        .toLowerCase()
        .replace(/^ft/, "")
        .replace(/[^0-9a-f]/g, "");
    if (!/^[0-9a-f]{8}$/.test(hex)) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "Enter a valid ticket reference (e.g. FT-7K3QX9A1)",
        });
    }

    // Prefix-match the code against the id, scoped to the caller's turfs. `hex`
    // is validated to hex-only above, so it's safe to interpolate as a parameter.
    const rows = isSuper
        ? await pgClient.$queryRaw`
            SELECT b.id::text AS id
            FROM bookings b
            WHERE left(replace(b.id::text, '-', ''), 8) = ${hex}`
        : await pgClient.$queryRaw`
            SELECT b.id::text AS id
            FROM bookings b
            JOIN grounds g ON g.id = b.ground_id
            JOIN turfs t ON t.id = g.turf_id
            WHERE left(replace(b.id::text, '-', ''), 8) = ${hex}
              AND t.admin_user_id = ${userId}::uuid`;

    if (rows.length === 0) throw ApiError.fromCode(ERROR_CODES.BOOKING_NOT_FOUND);
    if (rows.length > 1) throw ApiError.fromCode(ERROR_CODES.BOOKING_REF_AMBIGUOUS);

    const booking = await pgClient.bookings.findUnique({
        where: { id: rows[0].id },
        include: BOOKING_DETAIL_INCLUDE,
    });
    if (!booking) throw ApiError.fromCode(ERROR_CODES.BOOKING_NOT_FOUND);

    const event_trust = booking.event_id ? await getEventTrust(booking.event_id) : null;
    logger.info(`ticket ref ${hex} resolved to booking ${booking.id} by admin=${userId}`);

    return res.status(200).json(new ApiResponse(200, "Booking found", { ...booking, event_trust }));
});

// Bookings a turf admin manages. super_admin sees all; a turf_admin sees bookings
// on the turfs they own. Each attached event carries its trust snapshot so the
// admin can judge the game before confirming payment.
export const getManageBookings = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const isSuper = req.user.user_type === "super_admin";
    const { status } = req.query;

    const where = isSuper ? {} : { grounds: { turfs: { admin_user_id: userId } } };
    if (status) where.booking_status = status;

    const bookings = await pgClient.bookings.findMany({
        where,
        orderBy: [{ booking_date: "desc" }, { created_at: "desc" }],
        include: {
            grounds: {
                select: {
                    id: true,
                    name: true,
                    turfs: { select: { id: true, name: true, city: true, admin_user_id: true } },
                },
            },
            users_bookings_user_idTousers: {
                select: { id: true, first_name: true, last_name: true, profile_picture_url: true },
            },
        },
    });

    // Attach event trust for bookings that reference an event.
    const withTrust = await Promise.all(
        bookings.map(async (b) => ({
            ...b,
            event_trust: b.event_id ? await getEventTrust(b.event_id) : null,
        }))
    );

    return res.status(200).json(new ApiResponse(200, `${withTrust.length} bookings`, { bookings: withTrust }));
});

// Turf admin verifies a paid booking -> confirmed/completed. Payment is now
// final: from here the booking can only be cancelled by mutual acceptance.
export const confirmPayment = asyncHandler(async (req, res) => {
    const { booking_id } = req.params;

    const booking = await pgClient.bookings.findUnique({
        where: { id: booking_id },
        include: ADMIN_BOOKING_INCLUDE,
    });
    if (!booking) throw ApiError.fromCode(ERROR_CODES.BOOKING_NOT_FOUND);
    // Only the admin of THIS turf (or a super_admin) — not any turf_admin.
    assertBookingAdmin(req, booking);
    if (booking.booking_status === "cancelled") throw ApiError.fromCode(ERROR_CODES.BOOKING_ALREADY_CANCELLED);
    if (booking.payment_status !== "partial") throw ApiError.fromCode(ERROR_CODES.BOOKING_NOT_PAID_CLAIM);

    const updated = await pgClient.bookings.update({
        where: { id: booking_id },
        data: {
            booking_status: "confirmed",
            payment_status: "completed",
            admin_notes: req.body?.admin_notes || booking.admin_notes,
        },
    });

    logger.info(`payment confirmed: booking=${booking_id} by admin=${req.user.id}`);

    await createNotification({
        user_id: booking.user_id,
        type: "payment_received",
        title: "Payment confirmed",
        message: `Your booking for ${booking.grounds?.turfs?.name ?? "the turf"} is confirmed`,
        data: { bookingId: booking_id },
        priority: "high",
        action_url: "/bookings",
    });

    return res.status(200).json(new ApiResponse(200, "Payment confirmed", updated));
});

// Turf admin rejects a paid claim -> reverts to an UNPAID hold (clears proof,
// unlocks the slot). The user keeps a soft hold but must re-pay to secure it.
export const rejectPayment = asyncHandler(async (req, res) => {
    const { booking_id } = req.params;

    const booking = await pgClient.bookings.findUnique({
        where: { id: booking_id },
        include: ADMIN_BOOKING_INCLUDE,
    });
    if (!booking) throw ApiError.fromCode(ERROR_CODES.BOOKING_NOT_FOUND);
    assertBookingAdmin(req, booking);
    if (booking.booking_status === "cancelled") throw ApiError.fromCode(ERROR_CODES.BOOKING_ALREADY_CANCELLED);
    if (booking.payment_status !== "partial") throw ApiError.fromCode(ERROR_CODES.BOOKING_NOT_PAID_CLAIM);

    const updated = await pgClient.$transaction(async (tx) => {
        const row = await tx.bookings.update({
            where: { id: booking_id },
            data: {
                payment_status: "pending",
                booking_status: "pending",
                transaction_id: null,
                payment_proof_url: null,
                admin_notes: req.body?.admin_notes || booking.admin_notes,
            },
        });

        // No longer paid-locked -> re-open the grid boolean, and downgrade the
        // claim to a normal unpaid hold: it now expires like any other (2h TTL),
        // so a rejected payment can't park the slot indefinitely.
        await unlockSlot(booking.ground_id, booking.booking_date, booking.slot.code, tx);
        await takeOverSlotClaim(tx, {
            groundId: booking.ground_id,
            date: booking.booking_date,
            slotCode: booking.slot.code,
            userId: booking.user_id,
            paid: false,
        });

        return row;
    });

    logger.info(`payment rejected: booking=${booking_id} by admin=${req.user.id}`);

    await createNotification({
        user_id: booking.user_id,
        type: "payment_pending",
        title: "Payment not verified",
        message:
            "Your payment could not be verified. The booking is now unpaid and doesn't hold the slot — submit payment again to secure it.",
        data: { bookingId: booking_id },
        priority: "high",
        action_url: "/dashboard/bookings",
    });

    return res.status(200).json(new ApiResponse(200, "Payment rejected", updated));
});

// Finalise a cancellation: mark cancelled, clear any pending cancel request, and
// free the slot boolean back on. `refunded` flags a paid booking for refund.
const finalizeCancel = async (booking, actorId, reason, refunded) => {
    // Atomic: the booking is never cancelled without the slot being freed, and
    // the slot is never freed without the booking being cancelled.
    await pgClient.$transaction(async (tx) => {
        await tx.bookings.update({
            where: { id: booking.id },
            data: {
                booking_status: "cancelled",
                cancelled_by: actorId,
                cancelled_at: new Date(),
                cancellation_reason: reason || booking.cancellation_reason || null,
                cancellation_requested_by: null,
                ...(refunded ? { payment_status: "refunded" } : {}),
            },
        });
        // Re-open the grid boolean and drop the claim, so the slot is bookable again.
        await unlockSlot(booking.ground_id, booking.booking_date, booking.slot.code, tx);
        await releaseSlotClaim(booking.ground_id, booking.booking_date, booking.slot.code, tx);
    });

    logger.info(`booking cancelled: id=${booking.id} by=${actorId} refunded=${Boolean(refunded)}`);
};

// Cancel a booking.
//  - unpaid            -> cancelled immediately, any time (free; never locked a slot);
//  - paid, not yet confirmed -> free cancel only if >= 2 days out, else window closed;
//  - paid AND admin-confirmed -> opens a MUTUAL cancel request (the other party
//    must accept via /cancel/respond) — payment is final otherwise.
export const cancelBooking = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { booking_id } = req.params;
    const { reason } = req.body || {};

    const booking = await pgClient.bookings.findUnique({
        where: { id: booking_id },
        include: ADMIN_BOOKING_INCLUDE,
    });
    if (!booking) throw ApiError.fromCode(ERROR_CODES.BOOKING_NOT_FOUND);
    if (booking.booking_status === "cancelled") throw ApiError.fromCode(ERROR_CODES.BOOKING_ALREADY_CANCELLED);

    // Either the booker, or the admin of the turf it's on. A turf_admin from a
    // DIFFERENT turf has no business here.
    const isOwner = booking.user_id === userId;
    if (!isOwner && !isBookingAdmin(req, booking)) {
        throw ApiError.fromCode(ERROR_CODES.NOT_BOOKING_OWNER);
    }

    const adminUserId = booking.grounds?.turfs?.admin_user_id;
    // Notify the OTHER party to this booking.
    const notifyCounterparty = (payload) => {
        const target = isOwner ? adminUserId : booking.user_id;
        if (target) return createNotification({ ...payload, user_id: target });
    };

    // Unpaid soft hold: free cancellation at any time.
    if (booking.payment_status === "pending") {
        await finalizeCancel(booking, userId, reason, false);
        await notifyCounterparty({
            type: "booking_cancelled",
            title: "Booking cancelled",
            message: "An unpaid booking was cancelled.",
            data: { bookingId: booking_id },
            priority: "low",
            action_url: "/dashboard/bookings",
        });
        return res.status(200).json(new ApiResponse(200, "Booking cancelled", { booking_id }));
    }

    // Paid + admin-confirmed: payment is final -> mutual cancellation handshake.
    if (booking.booking_status === "confirmed") {
        await pgClient.bookings.update({
            where: { id: booking_id },
            data: { cancellation_requested_by: userId, cancellation_reason: reason || booking.cancellation_reason },
        });
        await notifyCounterparty({
            type: "booking_cancelled",
            title: "Cancellation requested",
            message: "A cancellation was requested for a confirmed booking. Accept to proceed.",
            data: { bookingId: booking_id },
            priority: "high",
            action_url: "/dashboard/bookings",
        });
        return res
            .status(200)
            .json(new ApiResponse(200, "Cancellation requested — awaiting the other party's acceptance", { booking_id }));
    }

    // Paid claim not yet confirmed: free cancel only up to 2 days before.
    if (daysUntil(booking.booking_date) < 2) {
        throw ApiError.fromCode(ERROR_CODES.CANCELLATION_WINDOW_CLOSED);
    }
    await finalizeCancel(booking, userId, reason, true);
    await notifyCounterparty({
        type: "booking_cancelled",
        title: "Booking cancelled",
        message: "A paid booking was cancelled before confirmation.",
        data: { bookingId: booking_id },
        priority: "medium",
        action_url: "/dashboard/bookings",
    });
    return res.status(200).json(new ApiResponse(200, "Booking cancelled", { booking_id }));
});

// Respond to a mutual cancellation request (the counterparty to whoever opened
// it). accept=true finalises the cancellation (+refund flag); accept=false clears
// the request and keeps the booking confirmed.
export const respondCancellation = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { booking_id } = req.params;
    const { accept } = req.body || {};

    const booking = await pgClient.bookings.findUnique({
        where: { id: booking_id },
        include: ADMIN_BOOKING_INCLUDE,
    });
    if (!booking) throw ApiError.fromCode(ERROR_CODES.BOOKING_NOT_FOUND);
    if (booking.booking_status === "cancelled") throw ApiError.fromCode(ERROR_CODES.BOOKING_ALREADY_CANCELLED);
    if (!booking.cancellation_requested_by) throw ApiError.fromCode(ERROR_CODES.CANCELLATION_NOT_REQUESTED);

    const requesterId = booking.cancellation_requested_by;
    if (requesterId === userId) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "You opened this cancellation — the other party must respond",
        });
    }

    const isOwner = booking.user_id === userId;
    if (!isOwner && !isBookingAdmin(req, booking)) {
        throw ApiError.fromCode(ERROR_CODES.NOT_BOOKING_OWNER);
    }

    if (accept) {
        await finalizeCancel(booking, userId, booking.cancellation_reason, true);
        await createNotification({
            user_id: requesterId,
            type: "booking_cancelled",
            title: "Cancellation accepted",
            message: "The booking was cancelled by mutual acceptance.",
            data: { bookingId: booking_id },
            priority: "high",
            action_url: "/dashboard/bookings",
        });
        return res.status(200).json(new ApiResponse(200, "Booking cancelled by mutual acceptance", { booking_id }));
    }

    // Declined -> clear the request, booking stays confirmed.
    await pgClient.bookings.update({
        where: { id: booking_id },
        data: { cancellation_requested_by: null },
    });
    await createNotification({
        user_id: requesterId,
        type: "booking_cancelled",
        title: "Cancellation declined",
        message: "Your cancellation request was declined. The booking stands.",
        data: { bookingId: booking_id },
        priority: "medium",
        action_url: "/dashboard/bookings",
    });
    return res.status(200).json(new ApiResponse(200, "Cancellation declined", { booking_id }));
});

// Turf admin checks a player in at the gate by scanning their ticket QR (which
// carries the booking id). This is how the turf "confirms" the ticket in person:
//   - only the admin of THIS turf (or super_admin) can do it — same scoping as
//     every other admin action, so a competitor can't check in your players;
//   - the booking must be CONFIRMED (a paid, admin-verified booking) — an unpaid
//     hold or a claim still awaiting verification has no valid ticket;
//   - it's single-use: a second scan is rejected with ALREADY_CHECKED_IN, so a
//     screenshot of someone's ticket can't be reused after they've entered.
// Reuses the existing `check_in_time` column — no schema change.
export const checkInBooking = asyncHandler(async (req, res) => {
    const { booking_id } = req.params;

    const booking = await pgClient.bookings.findUnique({
        where: { id: booking_id },
        include: ADMIN_BOOKING_INCLUDE,
    });
    if (!booking) throw ApiError.fromCode(ERROR_CODES.BOOKING_NOT_FOUND);
    assertBookingAdmin(req, booking);

    if (booking.booking_status !== "confirmed") {
        throw ApiError.fromCode(ERROR_CODES.BOOKING_NOT_CONFIRMED);
    }
    // Single-use: the verify screen reads `check_in_time` from the booking to show
    // WHEN it was used, so the error itself doesn't need to carry the timestamp.
    if (booking.check_in_time) throw ApiError.fromCode(ERROR_CODES.ALREADY_CHECKED_IN);

    const updated = await pgClient.bookings.update({
        where: { id: booking_id },
        data: { check_in_time: new Date() },
    });

    logger.info(`booking checked in: booking=${booking_id} by admin=${req.user.id}`);

    // Record for the player (bell only — they're physically at the gate, no toast).
    await createNotification({
        user_id: booking.user_id,
        type: "booking_confirmed",
        title: "Checked in",
        message: `You're checked in at ${booking.grounds?.turfs?.name ?? "the turf"}. Enjoy the match!`,
        data: { bookingId: booking_id },
        priority: "low",
        action_url: "/bookings",
    });

    return res.status(200).json(new ApiResponse(200, "Checked in", updated));
});

// ---------------------------------------------------------------------------
// Turf-admin dashboard analytics
// ---------------------------------------------------------------------------
// One roll-up for the Overview tab. Everything is derived from existing tables
// (bookings / reviews / grounds / turfs) — no analytics table, no new columns.
// Scoped to the turfs the caller owns; super_admin sees the whole platform.
//
// "Realized revenue" = bookings whose payment_status is `completed` (admin has
// verified the money). A `partial` claim is money awaiting verification and is
// surfaced separately as an action item, never counted as earned.
export const getDashboardStats = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const isSuper = req.user.user_type === "super_admin";

    // Bookings on the caller's turfs (or all, for super_admin).
    const scope = isSuper ? {} : { grounds: { turfs: { admin_user_id: userId } } };
    const REALIZED = { payment_status: "completed" };

    // Turfs the caller owns — needed for the reviews aggregate and the counts.
    const turfs = await pgClient.turfs.findMany({
        where: isSuper ? {} : { admin_user_id: userId },
        select: { id: true },
    });
    const turfIds = turfs.map((t) => t.id);

    // Time anchors in UTC so they line up with `booking_date` (@db.Date, stored
    // at UTC midnight). The 30-day window is inclusive of today.
    const nowD = new Date();
    const todayUTC = new Date(Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth(), nowD.getUTCDate()));
    const from30 = new Date(todayUTC);
    from30.setUTCDate(from30.getUTCDate() - 29);
    const startOfMonth = new Date(Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth(), 1));

    const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
    const num = (v) => Number(v ?? 0);

    const bookingListInclude = {
        grounds: {
            select: {
                id: true,
                name: true,
                turfs: { select: { id: true, name: true, admin_user_id: true } },
            },
        },
        users_bookings_user_idTousers: {
            select: { id: true, first_name: true, last_name: true, profile_picture_url: true },
        },
    };

    const [
        revenueAllAgg,
        revenueMonthAgg,
        bookingsTotal,
        bookingsMonth,
        upcomingCount,
        pendingVerifyCount,
        statusGroup,
        distinctPlayers,
        groundsCount,
        ratingAgg,
        windowRows,
        topGroundRows,
        recentBookings,
        upcomingBookings,
        pendingVerifications,
    ] = await Promise.all([
        pgClient.bookings.aggregate({ _sum: { final_amount: true }, where: { ...scope, ...REALIZED } }),
        pgClient.bookings.aggregate({
            _sum: { final_amount: true },
            where: { ...scope, ...REALIZED, created_at: { gte: startOfMonth } },
        }),
        pgClient.bookings.count({ where: scope }),
        pgClient.bookings.count({ where: { ...scope, created_at: { gte: startOfMonth } } }),
        pgClient.bookings.count({
            where: { ...scope, booking_date: { gte: todayUTC }, booking_status: { in: ["pending", "confirmed"] } },
        }),
        pgClient.bookings.count({ where: { ...scope, payment_status: "partial" } }),
        pgClient.bookings.groupBy({ by: ["booking_status"], _count: { _all: true }, where: scope }),
        pgClient.bookings.groupBy({ by: ["user_id"], where: scope }),
        pgClient.grounds.count({ where: isSuper ? {} : { turfs: { admin_user_id: userId } } }),
        pgClient.reviews.aggregate({
            _avg: { rating: true },
            _count: { _all: true },
            where: isSuper ? {} : { turf_id: { in: turfIds } },
        }),
        // Last 30 days of bookings -> daily series + occupancy (minimal fields).
        pgClient.bookings.findMany({
            where: { ...scope, booking_date: { gte: from30 } },
            select: { booking_date: true, final_amount: true, payment_status: true, booking_status: true },
        }),
        // Revenue by ground (realized), top 5.
        pgClient.bookings.groupBy({
            by: ["ground_id"],
            _sum: { final_amount: true },
            _count: { _all: true },
            where: { ...scope, ...REALIZED },
            orderBy: { _sum: { final_amount: "desc" } },
            take: 5,
        }),
        pgClient.bookings.findMany({
            where: scope,
            orderBy: { created_at: "desc" },
            take: 6,
            include: bookingListInclude,
        }),
        pgClient.bookings.findMany({
            where: { ...scope, booking_date: { gte: todayUTC }, booking_status: { in: ["pending", "confirmed"] } },
            orderBy: [{ booking_date: "asc" }, { created_at: "asc" }],
            take: 6,
            include: bookingListInclude,
        }),
        pgClient.bookings.findMany({
            where: { ...scope, payment_status: "partial" },
            orderBy: { created_at: "desc" },
            take: 6,
            include: bookingListInclude,
        }),
    ]);

    // Build the 30-day axis (bookings/day + realized revenue/day), zero-filled.
    const series = new Map();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(todayUTC);
        d.setUTCDate(d.getUTCDate() - i);
        series.set(dayKey(d), { date: dayKey(d), bookings: 0, revenue: 0 });
    }
    let bookedSlots30 = 0;
    for (const row of windowRows) {
        const key = dayKey(row.booking_date);
        const bucket = series.get(key);
        if (!bucket) continue;
        bucket.bookings += 1;
        if (row.payment_status === "completed") bucket.revenue += num(row.final_amount);
        if (["confirmed", "completed"].includes(row.booking_status)) bookedSlots30 += 1;
    }

    // Rough occupancy: booked (confirmed/completed) slots in the window vs the
    // theoretical capacity (grounds x 16 slots/day x 30 days).
    const capacity30 = groundsCount * 16 * 30;
    const occupancyPct = capacity30 > 0 ? Math.round((bookedSlots30 / capacity30) * 1000) / 10 : 0;

    // Attach ground names to the revenue-by-ground rows.
    const groundIds = topGroundRows.map((r) => r.ground_id);
    const groundNames = groundIds.length
        ? await pgClient.grounds.findMany({ where: { id: { in: groundIds } }, select: { id: true, name: true } })
        : [];
    const nameById = new Map(groundNames.map((g) => [g.id, g.name]));
    const topGrounds = topGroundRows.map((r) => ({
        ground_id: r.ground_id,
        name: nameById.get(r.ground_id) ?? "Ground",
        revenue: num(r._sum.final_amount),
        bookings: r._count._all,
    }));

    const statusBreakdown = statusGroup.map((s) => ({
        status: s.booking_status,
        count: s._count._all,
    }));

    return res.status(200).json(
        new ApiResponse(200, "Dashboard stats", {
            kpis: {
                revenue_all: num(revenueAllAgg._sum.final_amount),
                revenue_month: num(revenueMonthAgg._sum.final_amount),
                bookings_total: bookingsTotal,
                bookings_month: bookingsMonth,
                upcoming: upcomingCount,
                pending_verifications: pendingVerifyCount,
                unique_players: distinctPlayers.length,
                grounds: groundsCount,
                turfs: turfIds.length,
                avg_rating: ratingAgg._avg.rating ? Math.round(num(ratingAgg._avg.rating) * 10) / 10 : null,
                rating_count: ratingAgg._count._all,
                occupancy_pct: occupancyPct,
            },
            series: [...series.values()],
            status_breakdown: statusBreakdown,
            top_grounds: topGrounds,
            recent_bookings: recentBookings,
            upcoming_bookings: upcomingBookings,
            pending_verifications_list: pendingVerifications,
        })
    );
});
