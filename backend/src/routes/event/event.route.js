import { Router } from "express";
import {
    createEvent,
    getEvents,
    deleteEvent,
    getEventById
} from '../../controllers/event/event.controller.js'

const router = Router();

// router.route('/create-event').post(verifyJWT, createEvent)
router.route('/all').get(getEvents)
router.route('/:event_id').get(getEventById)
// router.route('/delete-event').delete(verifyJWT, deleteEvent)
// router.route('/update-event').put()



export default router