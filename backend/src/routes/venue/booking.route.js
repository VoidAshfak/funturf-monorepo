import { Router } from "express";
import {
    createBooking,
    getAvailableSlots
} from "../../controllers/venue/booking.controller.js"
import { verifyJWT } from "../../middlewares/auth/auth.middleware.js";

const router = Router();

router.route("/create").post(verifyJWT, createBooking);
router.route("/available-slots").get(getAvailableSlots);



export default router;

