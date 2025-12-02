import { Router } from "express";
import {
    createEvent,
    getEvents,
    deleteEvent,
    getEventById,
    editEvent
} from '../../controllers/event/event.controller.js'
import { verifyJWT } from "../../middlewares/auth/auth.middleware.js"

const router = Router();

router.route('/').get(getEvents)
router.route('/create-event').post(createEvent)
router.route('/:event_id').get(getEventById)
router.route('/delete-event').delete(deleteEvent)
router.route('/update-event/:event_id').patch(editEvent)



export default router