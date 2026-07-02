import { Router } from "express";
import {
    createEvent,
    getEvents,
    deleteEvent,
    getEventById,
    editEvent,
    getUserEvents
} from '../../controllers/event/event.controller.js'
import { verifyJWT } from "../../middlewares/auth/auth.middleware.js"

const router = Router();

// Public reads
router.route('/').get(getEvents)
// Static paths MUST be declared before the dynamic '/:event_id', otherwise
// GET /my-events would be swallowed as event_id="my-events".
// NOTE: getNearbyEvents is intentionally NOT routed yet — it relies on PostGIS
// (ST_Distance_Sphere) and event-status values that aren't verified in this DB.
router.route('/my-events').get(verifyJWT, getUserEvents)

// Writes — require authentication (organizer identity comes from the token)
router.route('/create-event').post(verifyJWT, createEvent)
router.route('/update-event/:event_id').patch(verifyJWT, editEvent)
router.route('/delete-event').delete(verifyJWT, deleteEvent)

// Dynamic catch-all read — keep last
router.route('/:event_id').get(getEventById)



export default router