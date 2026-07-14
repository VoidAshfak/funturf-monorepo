import { Router } from "express";
import {
    createEvent,
    getEvents,
    deleteEvent,
    getEventById,
    editEvent,
    getUserEvents,
    joinEvent,
    leaveEvent,
    getJoinRequests,
    acceptJoinRequest,
    rejectJoinRequest,
    cancelJoinRequest,
    grantEventAdmin,
    revokeEventAdmin
} from '../../controllers/event/event.controller.js'
import {
    getComments,
    createComment,
    updateComment,
    deleteComment,
    toggleCommentLike,
} from '../../controllers/event/comment.controller.js'
import { verifyJWT, attachUserIfPresent } from "../../middlewares/auth/auth.middleware.js"
import { commentWriteLimiter } from "../../middlewares/rateLimit.middleware.js"

const router = Router();

// Public read, but OPTIONALLY authenticated: when a token is present the feed
// highlights which of the caller's turfmates are involved in each event.
router.route('/').get(attachUserIfPresent, getEvents)
// Static paths MUST be declared before the dynamic '/:event_id', otherwise
// GET /my-events would be swallowed as event_id="my-events".
// NOTE: getNearbyEvents is intentionally NOT routed yet — it relies on PostGIS
// (ST_Distance_Sphere) and event-status values that aren't verified in this DB.
router.route('/my-events').get(verifyJWT, getUserEvents)

// Writes — require authentication (organizer identity comes from the token)
router.route('/create-event').post(verifyJWT, createEvent)
router.route('/update-event/:event_id').patch(verifyJWT, editEvent)
router.route('/delete-event').delete(verifyJWT, deleteEvent)

// Join flow (participant identity comes from the token):
//   POST   /:id/join    -> request to join (pending admin approval)
//   DELETE /:id/join    -> withdraw your own pending request
//   DELETE /:id/leave   -> leave a match you were approved for
router.route('/:event_id/join').post(verifyJWT, joinEvent).delete(verifyJWT, cancelJoinRequest)
router.route('/:event_id/leave').delete(verifyJWT, leaveEvent)

// Admin moderation of join requests (organizer + co_organizers). The controller
// enforces the admin check; these must be declared before '/:event_id'.
router.route('/:event_id/requests').get(verifyJWT, getJoinRequests)
router.route('/:event_id/requests/:user_id/accept').post(verifyJWT, acceptJoinRequest)
router.route('/:event_id/requests/:user_id/reject').post(verifyJWT, rejectJoinRequest)

// Event-admin management — ORGANIZER (creator) only; enforced in the controller.
router.route('/:event_id/admins').post(verifyJWT, grantEventAdmin)
router.route('/:event_id/admins/:user_id').delete(verifyJWT, revokeEventAdmin)

// ---- Discussion ----
// Reading is PUBLIC (optional auth so we can flag the caller's own likes and
// tell them whether they may post). Writing is limited to approved players —
// enforced in the controller via canCommentOnEvent.
router
    .route('/:event_id/comments')
    .get(attachUserIfPresent, getComments)
    .post(verifyJWT, commentWriteLimiter, createComment)
router
    .route('/:event_id/comments/:comment_id')
    .patch(verifyJWT, commentWriteLimiter, updateComment)
    .delete(verifyJWT, deleteComment)
router.route('/:event_id/comments/:comment_id/like').post(verifyJWT, commentWriteLimiter, toggleCommentLike)

// Dynamic catch-all read — keep last
router.route('/:event_id').get(getEventById)



export default router