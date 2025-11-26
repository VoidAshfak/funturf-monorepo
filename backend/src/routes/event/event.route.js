import { Router } from "express";
import {
    createEvent,
    getEvents,
    deleteEvent,
    getEventById
} from '../../controllers/event/event.controller.js'
import { verifyJWT } from "../../middlewares/auth/auth.middleware.js"

const router = Router();

router.route('/').get(getEvents)
router.route('/create-event').post(verifyJWT, createEvent)
router.route('/:event_id').get(getEventById)
router.route('/delete-event').delete(verifyJWT, deleteEvent)
// router.route('/update-event').put()



export default router