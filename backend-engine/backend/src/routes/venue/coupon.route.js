import { Router } from "express";
import { getAvailableCoupons } from "../../controllers/venue/promotion.controller.js";
import { verifyJWT } from "../../middlewares/auth/auth.middleware.js";

const router = Router();

// Customer-facing: coupons the signed-in caller can apply to a booking on a given
// ground/date. Auth-only (NOT turf-admin gated) — private/group coupons are
// filtered per user server-side so nothing leaks.
router.route("/available").get(verifyJWT, getAvailableCoupons);

export default router;
