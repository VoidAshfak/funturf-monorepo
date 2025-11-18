import { Router } from "express";
import { 
    getVenues,
    getVenueById 
} from "../../controllers/venue/venue.controller.js";


const router = Router();

router.route("/all").get(getVenues);
router.route('/:venue_id').get(getVenueById);


export default router;