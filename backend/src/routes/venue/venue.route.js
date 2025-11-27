import { Router } from "express";
import { 
    getVenues,
    getVenueById,
    getVenueList,
    createVenue,
    createGround
} from "../../controllers/venue/venue.controller.js";
import {verifyJWT} from "../../middlewares/auth/auth.middleware.js"


const router = Router();

router.route("/").get(getVenues);
router.route("/list").get(getVenueList);
router.route('/:venue_id').get(getVenueById);
router.route('/create-venue').post(createVenue);
router.route('/create-ground').post(createGround);


export default router;