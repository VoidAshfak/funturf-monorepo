import { Router } from "express";
import {
    createEvent,
    getEvents,
    getNearbyEvents,
    deleteEvent,
    getEventById,
    editEvent,
    rematchEvent,
    getUserEvents,
    joinEvent,
    leaveEvent,
    getJoinRequests,
    acceptJoinRequest,
    rejectJoinRequest,
    cancelJoinRequest,
    acceptEventInvitation,
    declineEventInvitation,
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
import {
    getEventMessages,
    sendEventMessage,
    editEventMessage,
    deleteEventMessage,
    reactEventMessage,
    markEventChatRead,
} from '../../controllers/event/message.controller.js'
import { verifyJWT, attachUserIfPresent } from "../../middlewares/auth/auth.middleware.js"
import { commentWriteLimiter } from "../../middlewares/rateLimit.middleware.js"

const router = Router();

// Public read, but OPTIONALLY authenticated: when a token is present the feed
// highlights which of the caller's turfmates are involved in each event.
router.route('/').get(attachUserIfPresent, getEvents)
// Static paths MUST be declared before the dynamic '/:event_id', otherwise
// GET /my-events would be swallowed as event_id="my-events".
router.route('/my-events').get(verifyJWT, getUserEvents)
// Geo search — public. Haversine on turf coords (no PostGIS), real enum statuses.
router.route('/nearby').get(getNearbyEvents)

// Writes — require authentication (organizer identity comes from the token)
router.route('/create-event').post(verifyJWT, createEvent)
router.route('/update-event/:event_id').patch(verifyJWT, editEvent)
router.route('/delete-event').delete(verifyJWT, deleteEvent)
// Rematch: clone a match into a new one and re-invite the same squad.
router.route('/:event_id/rematch').post(verifyJWT, rematchEvent)

// Join flow (participant identity comes from the token):
//   POST   /:id/join    -> request to join (pending admin approval)
//   DELETE /:id/join    -> withdraw your own pending request
//   DELETE /:id/leave   -> leave a match you were approved for
router.route('/:event_id/join').post(verifyJWT, joinEvent).delete(verifyJWT, cancelJoinRequest)
router.route('/:event_id/leave').delete(verifyJWT, leaveEvent)

// Invitation flow (INVITEE side — e.g. a rematch carry-over). The organizer
// pulled them in, so THEY decide. Decline deletes the invite, freeing them to
// request a spot normally later.
//   POST /:id/invitation/accept   -> accept the invite (become an approved player)
//   POST /:id/invitation/decline  -> decline (invite row removed)
router.route('/:event_id/invitation/accept').post(verifyJWT, acceptEventInvitation)
router.route('/:event_id/invitation/decline').post(verifyJWT, declineEventInvitation)

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

// ---- Squad group chat ----
// Private to the match's members (approved players + admins) — enforced in the
// controller via canCommentOnEvent. Reuses the comment write rate-limiter.
router
    .route('/:event_id/messages')
    .get(verifyJWT, getEventMessages)
    .post(verifyJWT, commentWriteLimiter, sendEventMessage)
// Mark the squad chat read (per-user). Declared before '/:message_id' so "read"
// is never mistaken for a message id.
router.route('/:event_id/messages/read').post(verifyJWT, markEventChatRead)
router
    .route('/:event_id/messages/:message_id')
    .patch(verifyJWT, commentWriteLimiter, editEventMessage)
    .delete(verifyJWT, deleteEventMessage)
router
    .route('/:event_id/messages/:message_id/reactions')
    .post(verifyJWT, commentWriteLimiter, reactEventMessage)

// Dynamic catch-all read — keep last
router.route('/:event_id').get(getEventById)



export default router