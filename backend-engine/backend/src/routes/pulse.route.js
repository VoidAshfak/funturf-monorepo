import { Router } from "express";
import { getCityPulse, getCityStats } from "../controllers/pulse.controller.js";
import { pulseLimiter } from "../middlewares/rateLimit.middleware.js";

const router = Router();

/**
 * Public landing-page reads. Both are anonymous by design — no auth middleware,
 * because everything they return is already public and none of it is scoped to a
 * caller. They live on their own prefix rather than under /venues or /events
 * because each spans both (and bookings besides).
 */

// Map layer: turfs near a point, with today's free slots and open matches.
router.route("/map").get(pulseLimiter, getCityPulse);

// Ticker: city-wide counters plus a short public activity feed.
router.route("/stats").get(pulseLimiter, getCityStats);

export default router;
