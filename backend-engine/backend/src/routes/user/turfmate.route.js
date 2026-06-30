import {Router} from 'express'
import {
    sendTurfmateRequest,
    acceptTurfmateRequest,
    getPendingRequests,
    getMutualTurfmates,
    getTurfmates
} from '../../controllers/user-connection/turfmate.controller.js'
import {verifyJWT} from '../../middlewares/auth/auth.middleware.js'

const router = Router();

// Protected routes
router.route('/turfmate-request').post(verifyJWT, sendTurfmateRequest);
router.route('/get-pending-requests').get(verifyJWT, getPendingRequests);
router.route('/accept-turfmate-request').post(verifyJWT, acceptTurfmateRequest);
router.route('/get-turfmates').get(verifyJWT, getTurfmates);
router.route('/get-mutual-turfmates').get(verifyJWT, getMutualTurfmates);


// router.route('/reject-turfmate-request').post(verifyJWT, rejectTurfmateRequest);
// router.route('/detach-with-turfmate').post(verifyJWT, ditachWithTurfmate);



export default router