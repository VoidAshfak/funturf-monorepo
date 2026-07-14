import { Router } from "express";
import {
    getAvailableSlots,
    calculateBookingPrice,
    createBooking,
    getMyBookings,
    getBookingById,
    getManageBookings,
    confirmPayment,
    rejectPayment,
    cancelBooking,
    respondCancellation,
} from "../../controllers/venue/booking.controller.js";
import {
    verifyJWT,
    authorizeRoles,
    attachUserIfPresent,
} from "../../middlewares/auth/auth.middleware.js";
import { bookingReadLimiter, bookingWriteLimiter } from "../../middlewares/rateLimit.middleware.js";

const router = Router();

// Public reads (availability + price quote) — rate limited so they can't be hammered.
// `attachUserIfPresent`: still public, but when a token IS sent we can flag the
// caller's OWN bookings on the grid (`my_slots`). It also makes the limiter key
// on the user id rather than the shared IP.
router.route("/available-slots").get(attachUserIfPresent, bookingReadLimiter, getAvailableSlots);
router.route("/quote").get(bookingReadLimiter, calculateBookingPrice);

// Turf-admin management. Static paths BEFORE the dynamic '/:booking_id'.
// NOTE: authorizeRoles only gates who may REACH these; the controller further
// scopes each action to the turf the caller actually owns.
router.route("/manage").get(verifyJWT, authorizeRoles("turf_admin", "super_admin"), getManageBookings);

// User bookings. verifyJWT first, so the limiter can key on the user id.
router.route("/create").post(verifyJWT, bookingWriteLimiter, createBooking);
router.route("/my").get(verifyJWT, getMyBookings);

// Admin payment verification.
router
    .route("/:booking_id/confirm-payment")
    .post(verifyJWT, authorizeRoles("turf_admin", "super_admin"), bookingWriteLimiter, confirmPayment);
router
    .route("/:booking_id/reject-payment")
    .post(verifyJWT, authorizeRoles("turf_admin", "super_admin"), bookingWriteLimiter, rejectPayment);

// Cancellation (owner or admin) + mutual-cancel response.
router.route("/:booking_id/cancel").post(verifyJWT, bookingWriteLimiter, cancelBooking);
router.route("/:booking_id/cancel/respond").post(verifyJWT, bookingWriteLimiter, respondCancellation);

// Dynamic read — keep last (owner or admin; enforced in controller).
router.route("/:booking_id").get(verifyJWT, getBookingById);

export default router;
