# FunTurf — Teams Feature: Implementation Instructions

**Read first:** the root `CLAUDE.md`, then `backend-engine/CLAUDE.md` and/or `frontend-engine/CLAUDE.md` depending on which side you're touching. This document does not repeat conventions already documented there — it assumes you follow them.

---

## 1. Goal

Add **persistent Teams** as a first-class entity. Today a "squad" only exists as the approved roster of one `events` row (`event_participants` has no role/team columns), and repeat play is glued together manually via `turfmate` connections + the Rematch flow. This feature formalizes that into a durable object: a named team with a roster, roles, and positions, that can organize matches directly.

**This is additive.** Ad-hoc, teamless matches (today's entire flow) must keep working unchanged. A team is an *optional* organizing layer on top of `events`, not a replacement for it.

Out of scope for this pass (do not build): league/table standings, team-vs-team challenge matchmaking, team chat separate from event chat, team payment/wallets. Flag these as future work if relevant, don't implement.

---

## 2. Data model changes

Location: `backend-engine/backend/prisma/postgresql/schema.prisma`. This is the **authoritative** schema — do not touch the `mongodb/` schema (deprecated, do not extend it).

Add three new models. Follow the existing conventions in the file exactly: `id String @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid`, `created_at`/`updated_at` with `@default(now()) @db.Timestamp(6)`, explicit `@@index` on FK columns, explicit relation names where a model has multiple FKs to the same table (see `reviews_reviewee_idTousers` / `reviews_reviewer_idTousers` for the pattern).

```prisma
enum team_member_role {
  captain
  co_captain
  member
}

enum team_member_status {
  active
  left
  removed
}

enum team_invite_status {
  pending
  accepted
  declined
  cancelled
}

model teams {
  id            String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name          String    @db.VarChar(100)
  sport_id      String    @db.Uuid
  captain_id    String    @db.Uuid
  home_area     String?   @db.VarChar(100)   // district/division, reuse users.district style
  crest_url     String?
  description   String?
  is_active     Boolean?  @default(true)
  created_at    DateTime? @default(now()) @db.Timestamp(6)
  updated_at    DateTime? @default(now()) @db.Timestamp(6)

  sports        sports         @relation(fields: [sport_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  captain       users          @relation("teams_captain", fields: [captain_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  team_members  team_members[]
  team_invites  team_invites[]
  events        events[]       // see events.team_id below

  @@index([sport_id], map: "idx_teams_sport")
  @@index([captain_id], map: "idx_teams_captain")
}

model team_members {
  id          String              @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  team_id     String              @db.Uuid
  user_id     String              @db.Uuid
  role        team_member_role    @default(member)
  position_id String?             @db.Uuid
  status      team_member_status  @default(active)
  joined_at   DateTime?           @default(now()) @db.Timestamp(6)
  left_at     DateTime?

  teams           teams            @relation(fields: [team_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  users           users            @relation(fields: [user_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  sport_positions sport_positions? @relation(fields: [position_id], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@unique([team_id, user_id], map: "unique_team_member")
  @@index([team_id], map: "idx_team_members_team")
  @@index([user_id], map: "idx_team_members_user")
}

model team_invites {
  id             String              @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  team_id        String              @db.Uuid
  invited_user_id String             @db.Uuid
  invited_by     String              @db.Uuid
  status         team_invite_status  @default(pending)
  message        String?
  created_at     DateTime?           @default(now()) @db.Timestamp(6)
  responded_at   DateTime?

  teams                              teams @relation(fields: [team_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  users_team_invites_invited_user_id users @relation("team_invites_invited_user", fields: [invited_user_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  users_team_invites_invited_by      users @relation("team_invites_invited_by", fields: [invited_by], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@unique([team_id, invited_user_id], map: "unique_team_invite")
  @@index([team_id], map: "idx_team_invites_team")
  @@index([invited_user_id], map: "idx_team_invites_invited_user")
}
```

Then, on the existing `events` model, add an **optional** FK:

```prisma
team_id String? @db.Uuid
teams   teams?  @relation(fields: [team_id], references: [id], onDelete: SetNull, onUpdate: NoAction)
```

Add the reverse relations on `users` (`teams_captain`, `team_members`, `team_invites_invited_user`, `team_invites_invited_by`) and on `sport_positions` (`team_members`) — match the existing back-relation style already used elsewhere in the file (e.g. how `reviews` wires its two `users` relations).

**Migration commands** (run from `backend-engine/backend/`, per existing convention — PostgreSQL only, do not touch the Mongo schema):
```bash
npm run prisma:push:pgsql
npm run prisma:generate:pg
```
This is additive-only: no existing columns change type or become non-nullable, so no backfill is required.

---

## 3. Error codes

Add to `backend-engine/backend/src/utils/errorCodes.js`, following the existing `{ code, statusCode, message }` shape and section-comment convention:

```js
// ---- teams ----
TEAM_NOT_FOUND:            { code: "TEAM_NOT_FOUND",            statusCode: 404, message: "Team not found" },
NOT_TEAM_CAPTAIN:          { code: "NOT_TEAM_CAPTAIN",          statusCode: 403, message: "Only the team captain can do this" },
NOT_TEAM_MEMBER:           { code: "NOT_TEAM_MEMBER",           statusCode: 403, message: "You are not a member of this team" },
ALREADY_TEAM_MEMBER:       { code: "ALREADY_TEAM_MEMBER",       statusCode: 409, message: "This player is already on the team" },
TEAM_INVITE_ALREADY_EXISTS:{ code: "TEAM_INVITE_ALREADY_EXISTS",statusCode: 409, message: "A pending invite already exists for this player" },
TEAM_INVITE_NOT_FOUND:     { code: "TEAM_INVITE_NOT_FOUND",     statusCode: 404, message: "Team invite not found" },
CANNOT_REMOVE_CAPTAIN:     { code: "CANNOT_REMOVE_CAPTAIN",     statusCode: 400, message: "Transfer captaincy before removing yourself, or delete the team" },
CANNOT_INVITE_SELF:        { code: "CANNOT_INVITE_SELF",        statusCode: 400, message: "You cannot invite yourself to a team" },
```

Reuse the existing `STATUS_TO_CODE` fallback map — no changes needed there.

---

## 4. Backend: routes / controllers

Mirror the structure and conventions of `src/controllers/user-connection/turfmate.controller.js` and `src/controllers/event/event.controller.js` exactly: `asyncHandler` wrapping every controller, `ApiError.fromCode(ERROR_CODES.X)` for failures, `new ApiResponse(statusCode, message, data)` for success, pagination via `page`/`limit` query params on list endpoints, atomic create-or-409 via the Prisma `P2002` unique-constraint catch (see `sendTurfmateRequest` for the pattern) rather than check-then-create.

New files:
- `src/controllers/team/team.controller.js`
- `src/routes/team/team.routes.js`

Mount in `src/app.js` alongside the existing mounts: `/api/v1/teams`.

### Endpoints

| method | path | notes |
|---|---|---|
| POST | `/teams` | Create team. Body: `{ name, sport_id, home_area?, crest_url?, description? }`. Creator becomes `captain` — create the `teams` row and the captain's `team_members` row in one `$transaction` (same pattern as `cancelEvent`'s transactional booking update). |
| GET | `/teams/:teamId` | Team detail incl. roster (active members, with position + role), captain, sport. |
| PATCH | `/teams/:teamId` | Captain-only. Partial update of name/home_area/crest_url/description. Not editable: `captain_id` (use the transfer-captaincy endpoint instead), `sport_id` once the team has members (reject with a validation error — changing sport invalidates position assignments). |
| DELETE | `/teams/:teamId` | Captain-only. Soft-delete (`is_active: false`) rather than hard delete — team history should survive for any `events` still referencing it. |
| GET | `/teams/my-teams` | Paginated. Teams where the caller has an `active` `team_members` row. Include their `role` on each. |
| POST | `/teams/:teamId/invites` | Captain or co-captain only. Body: `{ invitedUserId, message? }`. Atomic create relying on `@@unique(team_id, invited_user_id)`, catch `P2002` → `TEAM_INVITE_ALREADY_EXISTS` (same pattern as turfmate requests). Reject self-invite (`CANNOT_INVITE_SELF`) and existing-member invite (`ALREADY_TEAM_MEMBER`). Notify the invited user (`type: "team_invite"`, see §5). |
| GET | `/teams/:teamId/invites` | Captain/co-captain only. Pending invites for the team. |
| GET | `/teams/my-invites` | Paginated. Caller's own incoming pending invites, across all teams — mirrors `getPendingRequests` for turfmates. |
| POST | `/teams/invites/:inviteId/accept` | Invited user only. Creates the `team_members` row (`role: member`) and marks invite `accepted`, in a transaction. Notify the captain. |
| POST | `/teams/invites/:inviteId/decline` | Invited user only. Marks invite `declined`. |
| POST | `/teams/invites/:inviteId/cancel` | Captain/co-captain only. Marks invite `cancelled` (withdrawing it before response). |
| PATCH | `/teams/:teamId/members/:userId` | Captain only. Body: `{ role?, position_id? }`. Use to promote to `co_captain` or assign/change position. Cannot set `role: captain` here — use transfer-captaincy. |
| POST | `/teams/:teamId/transfer-captaincy` | Captain only. Body: `{ newCaptainId }`. `newCaptainId` must already be an active member. Transactionally: update `teams.captain_id`, set old captain's `team_members.role` to `member`, set new captain's role to `captain`. |
| DELETE | `/teams/:teamId/members/:userId` | Captain can remove anyone but themself (`CANNOT_REMOVE_CAPTAIN` — must transfer captaincy or delete the team first). A member can remove themself (leave) — same route, authorize both cases explicitly. Sets `status: removed` (captain-initiated) or `left` (self-initiated) + `left_at`, does not hard-delete the row (preserve history). |
| GET | `/teams/:teamId/events` | Paginated. Matches organized under this team (`events.team_id = teamId`), reuse existing event list shape/response. |

### Wiring teams into event creation (touch, don't rewrite)

In the existing `createEvent` controller (`src/controllers/event/event.controller.js`):
- Accept an optional `team_id` in the request body.
- If present: validate the caller is an active member of that team (any role) via `ApiError.fromCode(ERROR_CODES.NOT_TEAM_MEMBER)` if not; set `events.team_id`.
- **Do not** auto-populate `event_participants` from `team_members` in this pass — keep join/invite flow for the event itself exactly as it is today. (Auto-inviting the whole team roster on team-event creation is a reasonable fast-follow, but explicitly out of scope here — call it out as a TODO comment, don't build it, to keep this change reviewable.)
- No changes to `editEvent`, roster/invite/accept logic, or `broadcastRoster` — team is purely an organizing tag on the event in this pass.

---

## 5. Notifications

Reuse `src/utils/notificationService.js` — the `createNotification()` entry point, same as every other feature. Do not build a parallel notification path.

New notification `type` values (add wherever the existing types are enumerated/validated — check `constants.js` and the Prisma enum backing `notifications.type` if one exists, and extend it the same way promotions/events did):

- `team_invite` — priority `high`. To: invited user. On: invite created.
- `team_invite_accepted` — priority `medium`. To: captain + co-captains. On: invite accepted.
- `team_member_removed` — priority `medium`. To: removed user. On: captain removes a member.
- `team_captaincy_transferred` — priority `high`. To: new captain (and old captain, informational). On: transfer.

Follow the exact phrasing/tone style already used in `event.controller.js`'s notification payloads (e.g. `"${joinerName} joined "${event.title}" — jump in with them"`) — short, first-name-forward, action-oriented `title`, and an `action_url` pointing at the relevant team or invite page.

---

## 6. OpenAPI + API guideline docs

This repo treats these as required, not optional — both are explicitly called out in `CLAUDE.md`'s "Additional Instructions":

- Add the full `Teams`, `Team Invites` sections to `backend-engine/backend/docs/openapi.yaml` (hand-written spec, source of truth — see the comment header in `src/utils/swagger.js`). Match the existing style: tag grouping, `operationId`, full request/response schemas including error responses per status code, and a `SlotCode`-style enum block for `team_member_role`/`team_invite_status` under `components.schemas`.
- Add a `### Teams` section to `docs/api-guideline.md` (umbrella root, one level above `backend-engine/` — per `CLAUDE.md`) in the same table format used for Turfmates/Bookings: method/path/body/response table, followed by prose notes on production-hardening details (atomic invite creation, notification list, etc.) — mirror the "Turfmates" section's structure closely since this feature is its closest sibling.

---

## 7. Frontend

Read `frontend-engine/CLAUDE.md` before starting. Follow the existing hybrid strategy: server components for initial page loads via `src/utils/getData.js`-style fetchers, RTK Query for interaction-driven reads and all writes.

### RTK Query (`src/store/api/apiSlice.js`)

Add a `Teams`/`Team` tag pair (and `TeamInvites` if useful for cache scoping), following the exact pattern already used for `Events`/`Event`:

- `getMyTeams` — paginated query, `providesTags` per team + list tag.
- `getTeamById` — query, `providesTags: [{ type: "Team", id }]`.
- `createTeam` — mutation, `invalidatesTags: [{ type: "Teams", id: "LIST" }]`.
- `updateTeam`, `deleteTeam` — mutations, invalidate the specific `Team` id + list.
- `getMyTeamInvites`, `sendTeamInvite`, `acceptTeamInvite`, `declineTeamInvite`, `cancelTeamInvite`.
- `updateTeamMember` (role/position), `removeTeamMember`, `transferCaptaincy` — all invalidate the specific `Team` id (roster changed).
- `transformResponse` unwraps `res?.data` per existing convention; if a list endpoint needs the same infinite-scroll pagination as `getEvents`, reuse its `serializeQueryArgs`/`merge`/`forceRefetch` pattern verbatim.

### Routes (App Router, `src/app/(root)/`)

Add a `teams/` segment alongside the existing `events/` and `venues/` segments:

```
(root)/teams/
├── page.jsx              # "My Teams" list — server-fetched initial data + client refresh
├── loading.jsx
├── create/
│   └── page.jsx           # Create-team form (react-hook-form + zod, matching existing form conventions in src/components/forms/)
├── [teamId]/
│   ├── page.jsx            # Team detail: roster, positions, upcoming team matches
│   └── _components/
│       ├── TeamRoster.jsx       # mirrors EventSquad.jsx's live-roster pattern, but for team_members
│       ├── TeamInviteDialog.jsx
│       └── TeamMemberRow.jsx    # role/position controls, remove action (captain-only UI gating)
```

- `TeamRoster.jsx` should follow `EventSquad.jsx` closely: read via `useGetTeamByIdQuery`, render role + position + `reliability_score`/`rating` per member (this data already exists on `player_profiles` — join it in the backend response, don't fetch it separately client-side).
- Gate captain-only actions (invite, remove, promote, transfer, delete) in the UI based on the current user's `role` in the team payload — but the backend must be the actual enforcement point (§4), never trust client-side gating alone.
- Add a "My Teams" entry to whatever nav/menu component currently lists Events/Venues (`BottomTabBar`/`Navbar`/`SmallScreenMenu`) — check those components for the existing pattern before adding.
- On the existing event-creation form (`(root)/events/create/page.jsx`), add an optional "Organize as a team" selector sourced from `getMyTeams` — if selected, send `team_id` in the `createEvent` mutation body (§4).

---

## 8. Acceptance criteria

- [ ] Prisma migration applied; both `prisma:generate:pg` clients regenerate cleanly; Mongo schema untouched.
- [ ] All new endpoints require `Authorization: Bearer` (except none — teams have no public read endpoints in this pass) and follow the `asyncHandler`/`ApiError`/`ApiResponse` conventions with zero manual try/catch.
- [ ] Captain-only and member-only authorization is enforced server-side on every relevant route, not just hidden in the UI.
- [ ] Existing teamless event creation, join/invite/roster/rematch flows are unchanged — verify by exercising the existing event flow end-to-end with no `team_id` supplied.
- [ ] Removing/leaving a team never hard-deletes `team_members` rows (soft status change only), preserving history for teams referenced by past `events`.
- [ ] `docs/openapi.yaml` and `docs/api-guideline.md` are both updated in the same PR — not follow-ups.
- [ ] Frontend: captain-only UI actions are hidden for non-captains, but this is a UX nicety, not the authorization boundary.
- [ ] No new notification type bypasses `notificationService.createNotification()`.
