import { Router } from "express";
import {
    createBooking,
    getAvailableSlots
} from "../controllers/booking.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { checkAvailability } from "../middlewares/booking.middleware.js";

const router = Router();

router.route("/create").post(verifyJWT, createBooking);
router.route("/available-slots").get(getAvailableSlots);



export default router;

