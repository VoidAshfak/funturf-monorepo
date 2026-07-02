import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";
import { logger } from "../../../logs/logger.js";
import { pgClient } from "../../prisma.js";
import { createNotification } from "../../utils/notificationService.js";
import {
    computeSlotPricing,
    getEventTrust,
    isValidSlotCode,
    slotEndTime,
} from "../../utils/bookingService.js";

// Turf-admin roles (RBAC decision: any turf_admin/super_admin may verify/manage,
// not only the ground's owner). Route-level authorizeRoles enforces this too.
const ADMIN_ROLES = ["turf_admin", "super_admin"];
const isAdminRole = (req) => ADMIN_ROLES.includes(req.user?.user_type);

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

    const availableSlots = await pgClient.slots.findUnique({
        where: {
            ground_id_date: {
                ground_id: ground,
                date: new Date(date),
            },
        },
    });

    if (!availableSlots) {
        logger.warn(`No available slots found for ground ${ground} on ${date}`);
        throw ApiError.fromCode(ERROR_CODES.SLOT_NOT_FOUND);
    }

    return res.status(200).json(new ApiResponse(200, "Available slots found", availableSlots));
});

export const calculateBookingPrice = asyncHandler(async (req, res) => {
    const { ground_id, slot, booking_date, promo_code } = req.query;

    if (!ground_id || !slot || !booking_date) {
        logger.warn(`Did not receive query parameters properly`);
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "ground_id, slot and booking_date query parameters are required",
        });
    }

    const slot_row = await pgClient.slots.findUnique({
        where: { ground_id_date: { ground_id, date: new Date(booking_date) } },
    });
    if (!slot_row) throw ApiError.fromCode(ERROR_CODES.SLOT_NOT_FOUND);

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
            turfs: { select: { id: true, name: true, verified: true, status: true, admin_user_id: true } },
        },
    });
    if (!ground) throw ApiError.fromCode(ERROR_CODES.GROUND_NOT_FOUND);
    if (ground.status !== "available") throw ApiError.fromCode(ERROR_CODES.GROUND_NOT_AVAILABLE);
    const turf = ground.turfs;
    if (!turf?.verified) throw ApiError.fromCode(ERROR_CODES.TURF_NOT_VERIFIED);

    // Slot must be admin-enabled (and not already paid-locked) for the date.
    const slotRow = await pgClient.slots.findUnique({
        where: { ground_id_date: { ground_id, date: new Date(booking_date) } },
    });
    if (!slotRow) throw ApiError.fromCode(ERROR_CODES.SLOT_NOT_FOUND);
    if (!Boolean(slotRow[slot])) throw ApiError.fromCode(ERROR_CODES.SLOT_UNAVAILABLE);

    // Paid claim = a transaction number OR an uploaded proof doc.
    const hasProof = Boolean(transaction_id?.trim() || payment_proof_url?.trim());
    const isPaid = Boolean(paid) || hasProof;
    if (isPaid && !hasProof) throw ApiError.fromCode(ERROR_CODES.PAYMENT_PROOF_REQUIRED);

    // Bookings currently holding this exact slot (pending/confirmed only).
    const activeOnSlot = await pgClient.bookings.findMany({
        where: {
            ground_id,
            booking_date: new Date(booking_date),
            booking_status: { in: ["pending", "confirmed"] },
            slot: { path: ["code"], equals: slot },
        },
        select: { id: true, user_id: true, payment_status: true },
    });

    // Defensive: a paid claim/confirmed booking is a hard lock (boolean should
    // already be off, but double-check the records too).
    if (activeOnSlot.some((b) => ["partial", "completed"].includes(b.payment_status))) {
        throw ApiError.fromCode(ERROR_CODES.SLOT_UNAVAILABLE);
    }
    const unpaidHolds = activeOnSlot.filter((b) => b.payment_status === "pending");
    if (unpaidHolds.length > 0 && !isPaid) throw ApiError.fromCode(ERROR_CODES.SLOT_HELD_UNPAID);

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

    // Paid supersedes unpaid holders: cancel them + notify (they never locked it).
    if (isPaid && unpaidHolds.length > 0) {
        await pgClient.bookings.updateMany({
            where: { id: { in: unpaidHolds.map((b) => b.id) } },
            data: {
                booking_status: "cancelled",
                cancelled_by: userId,
                cancelled_at: new Date(),
                cancellation_reason: "superseded_by_paid_booking",
            },
        });
        await Promise.all(
            unpaidHolds.map((b) =>
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
    }

    const booking = await pgClient.bookings.create({
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
            transaction_id: transaction_id || null,
            payment_proof_url: payment_proof_url || null,
            notes: notes || null,
            slot: { code: slot, start_time: pricing.slot_time, end_time: slotEndTime(slot) },
        },
    });

    // A paid claim hard-locks the slot: flip the boolean off so it's fully taken.
    if (isPaid) {
        await pgClient.slots.update({
            where: { ground_id_date: { ground_id, date: new Date(booking_date) } },
            data: { [slot]: false },
        });
    }

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

    logger.info(`booking created: id=${booking.id} paid=${isPaid} user=${userId} ground=${ground_id}`);
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

// The caller's own bookings.
export const getMyBookings = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const bookings = await pgClient.bookings.findMany({
        where: { user_id: userId },
        orderBy: [{ booking_date: "desc" }, { created_at: "desc" }],
        include: {
            grounds: {
                select: { id: true, name: true, turfs: { select: { id: true, name: true, city: true } } },
            },
        },
    });
    return res.status(200).json(new ApiResponse(200, `${bookings.length} bookings`, { bookings }));
});

// A single booking — visible to the owner or a turf admin. When an event is
// attached, embeds its trust snapshot (squad size, organizer). Payment proof is
// returned to both the owner and admins.
export const getBookingById = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { booking_id } = req.params;

    const booking = await pgClient.bookings.findUnique({
        where: { id: booking_id },
        include: {
            grounds: {
                select: {
                    id: true,
                    name: true,
                    turfs: { select: { id: true, name: true, city: true, admin_user_id: true } },
                },
            },
        },
    });
    if (!booking) throw ApiError.fromCode(ERROR_CODES.BOOKING_NOT_FOUND);

    if (booking.user_id !== userId && !isAdminRole(req)) {
        throw ApiError.fromCode(ERROR_CODES.NOT_BOOKING_OWNER);
    }

    const event_trust = booking.event_id ? await getEventTrust(booking.event_id) : null;

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
        include: { grounds: { select: { turfs: { select: { name: true } } } } },
    });
    if (!booking) throw ApiError.fromCode(ERROR_CODES.BOOKING_NOT_FOUND);
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

    await createNotification({
        user_id: booking.user_id,
        type: "payment_received",
        title: "Payment confirmed",
        message: `Your booking for ${booking.grounds?.turfs?.name ?? "the turf"} is confirmed`,
        data: { bookingId: booking_id },
        priority: "high",
        action_url: "/dashboard/bookings",
    });

    return res.status(200).json(new ApiResponse(200, "Payment confirmed", updated));
});

// Turf admin rejects a paid claim -> reverts to an UNPAID hold (clears proof,
// unlocks the slot). The user keeps a soft hold but must re-pay to secure it.
export const rejectPayment = asyncHandler(async (req, res) => {
    const { booking_id } = req.params;

    const booking = await pgClient.bookings.findUnique({ where: { id: booking_id } });
    if (!booking) throw ApiError.fromCode(ERROR_CODES.BOOKING_NOT_FOUND);
    if (booking.booking_status === "cancelled") throw ApiError.fromCode(ERROR_CODES.BOOKING_ALREADY_CANCELLED);
    if (booking.payment_status !== "partial") throw ApiError.fromCode(ERROR_CODES.BOOKING_NOT_PAID_CLAIM);

    const updated = await pgClient.bookings.update({
        where: { id: booking_id },
        data: {
            payment_status: "pending",
            booking_status: "pending",
            transaction_id: null,
            payment_proof_url: null,
            admin_notes: req.body?.admin_notes || booking.admin_notes,
        },
    });

    // No longer paid-locked -> unlock the slot (becomes an unpaid hold again).
    await pgClient.slots
        .update({
            where: {
                ground_id_date: { ground_id: booking.ground_id, date: booking.booking_date },
            },
            data: { [booking.slot.code]: true },
        })
        .catch(() => {});

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
    await pgClient.bookings.update({
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
    await pgClient.slots
        .update({
            where: { ground_id_date: { ground_id: booking.ground_id, date: booking.booking_date } },
            data: { [booking.slot.code]: true },
        })
        .catch(() => {});
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
        include: { grounds: { select: { turfs: { select: { admin_user_id: true } } } } },
    });
    if (!booking) throw ApiError.fromCode(ERROR_CODES.BOOKING_NOT_FOUND);
    if (booking.booking_status === "cancelled") throw ApiError.fromCode(ERROR_CODES.BOOKING_ALREADY_CANCELLED);

    const isOwner = booking.user_id === userId;
    if (!isOwner && !isAdminRole(req)) throw ApiError.fromCode(ERROR_CODES.NOT_BOOKING_OWNER);

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
        include: { grounds: { select: { turfs: { select: { admin_user_id: true } } } } },
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
    if (!isOwner && !isAdminRole(req)) throw ApiError.fromCode(ERROR_CODES.NOT_BOOKING_OWNER);

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
