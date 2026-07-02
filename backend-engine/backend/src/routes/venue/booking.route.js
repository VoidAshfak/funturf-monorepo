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
import { verifyJWT, authorizeRoles } from "../../middlewares/auth/auth.middleware.js";

const router = Router();

// Public reads (availability + price quote).
router.route("/available-slots").get(getAvailableSlots);
router.route("/quote").get(calculateBookingPrice);

// Turf-admin management. Static paths BEFORE the dynamic '/:booking_id'.
router.route("/manage").get(verifyJWT, authorizeRoles("turf_admin", "super_admin"), getManageBookings);

// User bookings.
router.route("/create").post(verifyJWT, createBooking);
router.route("/my").get(verifyJWT, getMyBookings);

// Admin payment verification.
router
    .route("/:booking_id/confirm-payment")
    .post(verifyJWT, authorizeRoles("turf_admin", "super_admin"), confirmPayment);
router
    .route("/:booking_id/reject-payment")
    .post(verifyJWT, authorizeRoles("turf_admin", "super_admin"), rejectPayment);

// Cancellation (owner or admin) + mutual-cancel response.
router.route("/:booking_id/cancel").post(verifyJWT, cancelBooking);
router.route("/:booking_id/cancel/respond").post(verifyJWT, respondCancellation);

// Dynamic read — keep last (owner or admin; enforced in controller).
router.route("/:booking_id").get(verifyJWT, getBookingById);

export default router;
