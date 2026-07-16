import { Router } from "express";
import {
    createPromotion,
    getPromotions,
    getPromotionById,
    updatePromotion,
    deletePromotion,
    getPromotionAnalytics,
} from "../../controllers/venue/promotion.controller.js";
import { verifyJWT, authorizeRoles } from "../../middlewares/auth/auth.middleware.js";

const router = Router();

// All promotion management is turf-manager only (a turf_admin owns one turf;
// super_admin may target any via ?turf_id). The controller scopes every action to
// the caller's turf.
router.use(verifyJWT, authorizeRoles("turf_admin", "super_admin"));

// Analytics for the dashboard charts — declared before '/:promotion_id'.
router.route("/analytics").get(getPromotionAnalytics);

router.route("/").get(getPromotions).post(createPromotion);
router
    .route("/:promotion_id")
    .get(getPromotionById)
    .patch(updatePromotion)
    .delete(deletePromotion);

export default router;
