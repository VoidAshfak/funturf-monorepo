import { Router } from "express";
import {
    getSportsCatalogue,
    createTeam,
    getTeamById,
    updateTeam,
    deleteTeam,
    getMyTeams,
    getTeamEvents,
    sendTeamInvite,
    getTeamInvites,
    getMyTeamInvites,
    acceptTeamInvite,
    declineTeamInvite,
    cancelTeamInvite,
    updateTeamMember,
    transferCaptaincy,
    removeTeamMember,
} from "../../controllers/team/team.controller.js";
import { verifyJWT } from "../../middlewares/auth/auth.middleware.js";
import { teamWriteLimiter } from "../../middlewares/rateLimit.middleware.js";
import { validateUuidParams } from "../../middlewares/validateUuid.middleware.js";

const router = Router();

// Every id in this router is a `@db.Uuid` column. Screening the path params here
// turns a typo'd link into a clean 400 instead of a Prisma `P2023` surfacing as
// a 500 (see validateUuid.middleware.js).
const uuidParams = validateUuidParams("teamId", "userId", "inviteId");

// Teams have no public surface in this pass — every route is private to the
// signed-in user, so the guard is mounted once here rather than per route.
router.use(verifyJWT);

// ---- reference data ----
// Sports + their positions, for the create-team form and the position picker.
router.route("/sports").get(getSportsCatalogue);

// ---- the caller's own views ----
// Static paths MUST come before '/:teamId', or "my-teams" is read as a team id.
router.route("/my-teams").get(getMyTeams);
router.route("/my-invites").get(getMyTeamInvites);

// ---- invite responses (invite id, not team id) ----
// Also declared before '/:teamId' so "invites" is never taken for a team.
router.route("/invites/:inviteId/accept").post(uuidParams, teamWriteLimiter, acceptTeamInvite);
router.route("/invites/:inviteId/decline").post(uuidParams, teamWriteLimiter, declineTeamInvite);
router.route("/invites/:inviteId/cancel").post(uuidParams, teamWriteLimiter, cancelTeamInvite);

// ---- teams ----
router.route("/").post(teamWriteLimiter, createTeam);

// ---- team-scoped sub-resources (before the '/:teamId' catch-all) ----
// Recruitment — captain/co-captain only, enforced in the controller.
router
    .route("/:teamId/invites")
    .get(uuidParams, getTeamInvites)
    .post(uuidParams, teamWriteLimiter, sendTeamInvite);
// Matches organized under this team.
router.route("/:teamId/events").get(uuidParams, getTeamEvents);
// Captain only.
router.route("/:teamId/transfer-captaincy").post(uuidParams, teamWriteLimiter, transferCaptaincy);
// PATCH is captain-only; DELETE also allows a member to remove THEMSELF (leave).
router
    .route("/:teamId/members/:userId")
    .patch(uuidParams, teamWriteLimiter, updateTeamMember)
    .delete(uuidParams, teamWriteLimiter, removeTeamMember);

// ---- dynamic team routes — keep last ----
router
    .route("/:teamId")
    .get(uuidParams, getTeamById)
    .patch(uuidParams, teamWriteLimiter, updateTeam)
    .delete(uuidParams, teamWriteLimiter, deleteTeam);

export default router;
