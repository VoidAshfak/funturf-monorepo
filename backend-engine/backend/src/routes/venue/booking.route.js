import { Router } from "express";
import {
    getAvailableSlots,
    calculateBookingPrice
} from "../../controllers/venue/booking.controller.js"
import { verifyJWT } from "../../middlewares/auth/auth.middleware.js";

const router = Router();

// router.route("/create").post(createBooking);
router.route("/available-slots").get(getAvailableSlots);
router.route("/quote").get(calculateBookingPrice);



export default router;

