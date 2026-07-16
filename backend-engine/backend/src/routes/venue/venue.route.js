import { Router } from "express";
import {
    getVenues,
    getVenueById,
    getVenueList,
    rateTurf,
    createVenue,
    createGround,
    updateGround,
    getVenueByAdminId
} from "../../controllers/venue/venue.controller.js";
import { verifyJWT, authorizeRoles, attachUserIfPresent } from "../../middlewares/auth/auth.middleware.js"


const router = Router();

// Public reads. getVenueById is OPTIONALLY authenticated so a signed-in caller
// also gets their own `my_rating` back for the star widget.
router.route("/").get(getVenues);
router.route("/list").get(getVenueList);
router.route('/get-venues-by-admin/:admin_id').get(getVenueByAdminId);
router.route('/:venue_id').get(attachUserIfPresent, getVenueById);

// Rate a turf — auth required. One rating per user; re-posting updates it.
router.route('/:venue_id/rating').post(verifyJWT, rateTurf);

// Writes — only turf admins / super admins may create venues and grounds
router.route('/create-venue').post(verifyJWT, authorizeRoles("turf_admin", "super_admin"), createVenue);
router.route('/create-ground').post(verifyJWT, authorizeRoles("turf_admin", "super_admin"), createGround);
router.route('/grounds/:ground_id').patch(verifyJWT, authorizeRoles("turf_admin", "super_admin"), updateGround);

export default router;