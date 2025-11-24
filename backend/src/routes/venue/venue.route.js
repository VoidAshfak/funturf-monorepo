import { Router } from "express";
import { 
    getVenues,
    getVenueById 
} from "../../controllers/venue/venue.controller.js";
import {verifyJWT} from "../../middlewares/auth/auth.middleware.js"


const router = Router();

router.route("/").get(getVenues);
router.route('/:venue_id').get(getVenueById);


export default router;