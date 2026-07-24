import { Router } from "express";
import {
    sendTurfmateRequest,
    getPendingRequests,
    getOutgoingRequests,
    acceptTurfmateRequest,
    rejectTurfmateRequest,
    cancelTurfmateRequest,
    removeTurfmate,
    getTurfmates,
    getConnectionStatus,
    getMutualTurfmates,
    getRecommendations,
} from "../../controllers/user-connection/turfmate.controller.js";
import { verifyJWT } from "../../middlewares/auth/auth.middleware.js";
import { validateUuidQuery } from "../../middlewares/validateUuid.middleware.js";

const router = Router();

// Every turfmate route is private to the logged-in user.
router.use(verifyJWT);

// requests
router.route("/turfmate-request").post(sendTurfmateRequest);
router.route("/get-pending-requests").get(getPendingRequests);
router.route("/get-outgoing-requests").get(getOutgoingRequests);
router.route("/accept-turfmate-request").post(acceptTurfmateRequest);
router.route("/reject-turfmate-request").post(rejectTurfmateRequest);
router.route("/cancel-turfmate-request").post(cancelTurfmateRequest);

// turfmates
router.route("/remove-turfmate").post(removeTurfmate);
router.route("/get-turfmates").get(getTurfmates);
// `userTwo` is the other user's id and rides in the query string, so it misses
// the path-param guard — same reason as /available-slots?ground=.
router.route("/get-mutual-turfmates").get(validateUuidQuery("userTwo"), getMutualTurfmates);
router.route("/recommendations").get(getRecommendations);
// Dynamic path last so it doesn't swallow the static ones above.
router.route("/connection-status/:userId").get(getConnectionStatus);

export default router;
