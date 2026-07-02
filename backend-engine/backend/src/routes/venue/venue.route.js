import { Router } from "express";
import { 
    getVenues,
    getVenueById,
    getVenueList,
    createVenue,
    createGround,
    getVenueByAdminId
} from "../../controllers/venue/venue.controller.js";
import { verifyJWT, authorizeRoles } from "../../middlewares/auth/auth.middleware.js"


const router = Router();

// Public reads
router.route("/").get(getVenues);
router.route("/list").get(getVenueList);
router.route('/:venue_id').get(getVenueById);
router.route('/get-venues-by-admin/:admin_id').get(getVenueByAdminId);

// Writes — only turf admins / super admins may create venues and grounds
router.route('/create-venue').post(verifyJWT, authorizeRoles("turf_admin", "super_admin"), createVenue);
router.route('/create-ground').post(verifyJWT, authorizeRoles("turf_admin", "super_admin"), createGround);

export default router;