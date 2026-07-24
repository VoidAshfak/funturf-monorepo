import { Router } from "express";
import {
    getAvailableSlots,
    calculateBookingPrice,
    createBooking,
    getMyBookings,
    getBookingById,
    lookupBookingByRef,
    getManageBookings,
    getDashboardStats,
    confirmPayment,
    rejectPayment,
    cancelBooking,
    respondCancellation,
    checkInBooking,
} from "../../controllers/venue/booking.controller.js";
import {
    verifyJWT,
    authorizeRoles,
    attachUserIfPresent,
} from "../../middlewares/auth/auth.middleware.js";
import { bookingReadLimiter, bookingWriteLimiter } from "../../middlewares/rateLimit.middleware.js";
import { validateUuidQuery } from "../../middlewares/validateUuid.middleware.js";

const router = Router();

// Public reads (availability + price quote) — rate limited so they can't be hammered.
// `attachUserIfPresent`: still public, but when a token IS sent we can flag the
// caller's OWN bookings on the grid (`my_slots`). It also makes the limiter key
// on the user id rather than the shared IP.
// `validateUuidQuery("ground")`: the ground id rides in the query string, so it
// misses the path-param guard. Without it an id that failed to decode reaches
// Prisma and comes back as a 500 instead of a 400.
router
    .route("/available-slots")
    .get(attachUserIfPresent, bookingReadLimiter, validateUuidQuery("ground"), getAvailableSlots);
// attachUserIfPresent: public, but when a token IS sent we know the booker — so
// user/group-targeted coupons resolve in the price preview too (not just at create).
router
    .route("/quote")
    .get(attachUserIfPresent, bookingReadLimiter, validateUuidQuery("ground_id"), calculateBookingPrice);

// Turf-admin management. Static paths BEFORE the dynamic '/:booking_id'.
// NOTE: authorizeRoles only gates who may REACH these; the controller further
// scopes each action to the turf the caller actually owns.
router.route("/manage").get(verifyJWT, authorizeRoles("turf_admin", "super_admin"), getManageBookings);

// Overview analytics roll-up for the admin dashboard.
router
    .route("/dashboard-stats")
    .get(verifyJWT, authorizeRoles("turf_admin", "super_admin"), bookingReadLimiter, getDashboardStats);

// Resolve a printed ticket reference for MANUAL verification (admin-scoped).
router
    .route("/verify-lookup")
    .get(verifyJWT, authorizeRoles("turf_admin", "super_admin"), bookingReadLimiter, lookupBookingByRef);

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

// Gate check-in: turf admin scans the player's ticket QR (carries the booking id)
// to confirm attendance. Controller scopes it to the turf the caller owns.
router
    .route("/:booking_id/check-in")
    .post(verifyJWT, authorizeRoles("turf_admin", "super_admin"), bookingWriteLimiter, checkInBooking);

// Dynamic read — keep last (owner or admin; enforced in controller).
router.route("/:booking_id").get(verifyJWT, getBookingById);

export default router;
