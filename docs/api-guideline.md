# FunTurf API Guideline

Base URL: `http://localhost:8080/api/v1` (dev) · `https://app4-osju.onrender.com/api/v1` (prod).

This document is the **contract between the backend and the frontend**. Update it in the
same change that touches a route, so `frontend-engine` can be kept in sync.

## Response envelopes

Every endpoint returns one of two shapes.

**Success** (`ApiResponse`):

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Human readable message",
  "data": { }
}
```

**Error** (`errorHandler`):

```json
{
  "success": false,
  "code": "USER_NOT_FOUND",
  "message": "User not found",
  "errors": [],
  "data": null
}
```

- `code` is a **stable, machine-readable** string — the frontend should branch on `code`, never on `message`.
- `errors` is an optional array of field-level details for validation failures.

## Centralized error codes

Defined in `backend-engine/backend/src/utils/errorCodes.js`. Throw them via `ApiError.fromCode(ERROR_CODES.X)`.

| code | HTTP | meaning |
| --- | --- | --- |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `VALIDATION_ERROR` | 400 | One or more fields invalid (see `errors[]`) |
| `BAD_REQUEST` | 400 | Malformed request |
| `NOT_FOUND` | 404 | Resource not found |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Authenticated but not allowed |
| `CONFLICT` | 409 | Resource already exists |
| `MISSING_TOKEN` | 401 | No `Authorization` header |
| `INVALID_TOKEN` | 401 | Token invalid/expired |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `USER_NOT_FOUND` | 404 | No such user |
| `USER_ALREADY_EXISTS` | 409 | Email/phone already registered |
| `TOKEN_GENERATION_FAILED` | 500 | Could not issue tokens |
| `EVENT_FULL` | 409 | Match already at capacity (join/approve) |
| `ALREADY_JOINED` | 409 | Caller already has a request/participation |
| `NOT_EVENT_PARTICIPANT` | 400 | Caller isn't a participant (leave / promote target) |
| `NOT_EVENT_ADMIN` | 403 | Caller isn't an event admin (organizer/co_organizer) |
| `JOIN_REQUEST_NOT_FOUND` | 404 | No pending join request for that user |
| `ALREADY_ADMIN` | 409 | Target is already an event admin |
| `NOTIFICATION_NOT_FOUND` | 404 | Notification not found / not owned |

## Auth

Protected routes require `Authorization: Bearer <accessToken>`. The token is issued by
`POST /users/login` and carried by the frontend NextAuth session
(`session.user.access_token`) → RTK Query `prepareHeaders`.

## Endpoints

> Filled in route-by-route as each area is reviewed. Each entry documents method,
> path, auth requirement, request body/query, and success `data` shape.

### Users (`/users`)

| method | path | auth | body / params | success `data` |
| --- | --- | --- | --- | --- |
| POST | `/register` | public | `{ first_name, last_name, email, password_hash, phone?, date_of_birth?, gender?, profile_picture_url?, bio?, sports?, division?, district?, latitude?, longitude?, user_type? }` | `201` — user fields + `accessToken`, `refreshToken`, `tokenExpiresIn` |
| POST | `/login` | public | `{ email, password }` | `200` — `{ user: { ...profile, sports, teamsJoined, eventsJoined, friends, username, accessToken, refreshToken, tokenExpiresIn } }` |
| POST | `/refresh` | public | `{ refresh_token }` | `200` — `{ accessToken, refreshToken, tokenExpiresIn }` |
| GET | `/:user_id` | public | path `user_id` | `200` — `{ id, email, phone, first_name, last_name, ..., sports, teamsJoined, eventsJoined, friends, username }` |
| POST | `/media/signature` | public | — | media upload signature |

**Errors:** `VALIDATION_ERROR` (missing fields), `USER_ALREADY_EXISTS` (register, email/phone clash),
`INVALID_CREDENTIALS` (login — same code for unknown email and wrong password, by design),
`USER_NOT_FOUND` (GET by id), `INVALID_TOKEN` / `MISSING_TOKEN` (protected routes).

Notes:
- `password_hash` in the register body is the **plaintext** password; the `encryptPassword`
  middleware hashes it before the controller runs (field name is historical).
- Register returns `201` (was `200`).
- Login does **not** reveal whether an email exists — always `INVALID_CREDENTIALS`.
- `user_type` at register is **whitelisted**: only `player` (default) or `turf_admin` are
  honored; any other value (notably `super_admin`) falls back to `player`. The frontend
  onboarding routes `/signup` (chooser) → `/signup/player` / `/signup/turf-admin` set it.
  A `turf_admin` account unlocks the venue/ground create endpoints and dashboard.

### Venues (`/venues`)

| method | path | auth | body / params | success `data` |
| --- | --- | --- | --- | --- |
| GET | `/` | public | — | `200` — venue-list DTOs (id, name, images, rating, location, grounds summary) |
| GET | `/list` | public | — | `200` — minimal `{ id, name, grounds:[{id,name,sport_type}] }` |
| GET | `/:venue_id` | public | path `venue_id` | `200` — full venue DTO with grounds |
| GET | `/get-venues-by-admin/:admin_id` | public | path `admin_id` | `200` — venues owned by that admin (`[]` if none) |
| POST | `/create-venue` | **turf_admin / super_admin** | venue payload incl. `grounds[]` (see `frontend-engine/src/utils/constants.js`) | `201` — created venue DTO |
| POST | `/create-ground` | **turf_admin / super_admin** | ground payload | `201` — created ground |

**Auth change:** `create-venue` / `create-ground` now require `Authorization: Bearer` **and**
a `turf_admin`/`super_admin` role. The owner (`admin_user_id`) is taken from the token —
the old anonymous hardcoded-admin fallback is removed.

**`create-venue` payload (BD address + required set):** required fields now mirror the DB
`NOT NULL` columns only. The `address_line_1` object is Bangladesh-shaped and maps to columns:

```
address_line_1: {
  area,            // required -> column address_line_1 (street/area)
  city,            // required -> district
  state,           // required -> division
  country,         // defaults to "Bangladesh"
  postal_code,     // optional
  latitude, longitude  // optional, set from the map picker
}
```

- **Required:** `name`, `address_line_1.area`, `address_line_1.city`, `address_line_1.state`,
  and at least one ground with `name` + `sport_type` + `hourly_rate`.
- **Optional (nullable in DB):** description, address_line_2 (landmark), postal_code, lat/lng,
  phone, email, website_url, establishment_year, facilities, sports_available,
  rules_and_regulations, cancellation_policy, operating_hours, images, and all other ground fields.
- Ground `amenities` are inherited from the venue's `facilities` on the client.
- Ground `status` (`available` | `maintenance` | `unavailable`) controls booking availability.
- Phone numbers are validated Bangladesh-format on the client (`01[3-9]XXXXXXXX`).

**Errors:** `VALIDATION_ERROR` (missing name/address/ground essentials), `UNAUTHORIZED` /
`MISSING_TOKEN` / `INVALID_TOKEN` (no/bad token), `FORBIDDEN` (logged in but not an admin role),
`NOT_FOUND` (venue id not found).

### Events (`/events`)

| method | path | auth | body / params | success `data` |
| --- | --- | --- | --- | --- |
| GET | `/` | **optional auth** | query `page?`, `limit?`, `sport?`, `timeframe?`, `q?`, `openOnly?` | `200` — `{ events, pagination, stats? }` (paginated feed) |
| POST | `/:event_id/join` | **required** | — | `201` — created **pending** request (status `requested`; does NOT bump `current_players`; notifies all admins + requester) |
| DELETE | `/:event_id/join` | **required, requester** | — | `200` — `{ event_id }` (withdraw own pending request) |
| DELETE | `/:event_id/leave` | **required, approved participant** | — | `200` — `{ event_id }` (decrements only if was approved) |
| GET | `/:event_id/requests` | **required, admin** | — | `200` — `{ requests:[{id,user_id,joined_at,users}] }` (pending only) |
| POST | `/:event_id/requests/:user_id/accept` | **required, admin** | — | `200` — `{ event_id, user_id }` (approve → +`current_players`, notify user + admins, align turfmates) |
| POST | `/:event_id/requests/:user_id/reject` | **required, admin** | — | `200` — `{ event_id, user_id }` (decline) |
| POST | `/:event_id/admins` | **required, organizer** | `{ user_id }` | `200` — `{ event_id, user_id }` (grant admin → role `co_organizer`) |
| DELETE | `/:event_id/admins/:user_id` | **required, organizer** | — | `200` — `{ event_id, user_id }` (revoke admin → role `player`) |
| GET | `/my-events` | **required** | query `status?` | `200` — `{ events: [ { ...event, my_participation:{status,payment_status,joined_at} } ] }` |
| POST | `/create-event` | **required** | event fields + `current_players[]` | `200` — created event (organizer = token user; initial roster inserted as `approved`) |
| PATCH | `/update-event/:event_id` | **required, organizer only** | editable event fields | `200` — updated event |
| DELETE | `/delete-event` | **required, organizer only** | `{ event_id }` | `200` — deleted event |
| GET | `/:event_id` | public | path `event_id` | `200` — full event DTO |

**`GET /events` is a paginated, filterable feed** (powers the infinite-scroll `/events` page):

- **Query params (all optional):** `page` (1-based, default 1), `limit` (1–50, default 12),
  `sport` (exact `sport_type`, `"all"` = any), `timeframe` (`all` | `today` | `week` | `month`,
  filters `event_date` forward), `q` (search — matches event title or turf name, case-insensitive),
  `openOnly` (`"true"` = only events still short of `min_players`).
- **Response `data`:**
  ```
  {
    events: [ { ...event, users: {organizer}, grounds:{name,turfs}, event_participants:[{users}] } ],
    pagination: { page, limit, total, hasMore },
    stats: { total, open, sports:[{name,count}] }   // ONLY on page 1
  }
  ```
- Events are ordered soonest-first (`event_date asc`, `id` tiebreak). Each event embeds the
  **organizer profile** (`users`) and **participant avatars** (`event_participants[].users`).
- **Turfmate highlight:** `GET /events` uses **optional auth** (`attachUserIfPresent`) — when a
  valid token is sent, each event gains `turfmates_involved:[{id,first_name,profile_picture_url}]`
  listing the caller's turfmates who organize or play in it (the feed card rings + badges these).
- `stats` (global, unfiltered) is returned only on `page === 1` to save queries; the frontend
  caches it for the hero + sport chips. `openOnly` uses a Prisma **field reference**
  (`min_players > current_players`).
- Frontend: `useGetEventsQuery({page,limit,sport,timeframe,q,openOnly})` accumulates pages via
  RTK Query `merge` (cache key excludes `page`); the server component pre-fetches `page 1` only
  for `stats`.

#### Join-request / admin flow

Joining a match is an **approval flow** — no instant joins:

- **Request:** `POST /:id/join` creates a participant row with status `requested` (guards
  not-organizer, not-already-requested, soft `EVENT_FULL`). It does **not** touch `current_players`.
  Notifies **all** event admins (`event_join_request`) and confirms to the requester.
- **Withdraw:** `DELETE /:id/join` deletes the caller's own pending request (`JOIN_REQUEST_NOT_FOUND`
  if none); no counter change; notifies admins.
- **Approve:** `POST /:id/requests/:user_id/accept` — **admins only** (`NOT_EVENT_ADMIN`). Flips the
  row to `approved`, bumps `current_players` (hard `EVENT_FULL` check here), notifies the requester
  (`event_invitation`) + other admins, and broadcasts "a turfmate joined" to the new player's turfmates.
- **Reject:** `POST /:id/requests/:user_id/reject` — admins only. Marks `rejected`; notifies requester + admins.
- **List:** `GET /:id/requests` — admins only; pending requests with requester profiles.
- **Leave:** `DELETE /:id/leave` removes an approved participant and decrements `current_players`
  (clamped at 0 via `GREATEST`); pending requests use withdraw, not leave.

**Event admins** = the organizer (always, from `events.organizer_id`) **plus** any approved
participant whose `event_participants.role = co_organizer`. Multiple admins supported.
- **Grant:** `POST /:id/admins` `{ user_id }` — **organizer (creator) only** (`NOT_EVENT_ORGANIZER`);
  target must be an approved participant (`NOT_EVENT_PARTICIPANT`), not already an admin (`ALREADY_ADMIN`).
  Sets role `co_organizer`; notifies the new admin + existing admins.
- **Revoke:** `DELETE /:id/admins/:user_id` — organizer only; demotes `co_organizer` → `player`.
- Frontend hooks: `useJoinEventMutation`, `useCancelJoinRequestMutation`, `useLeaveEventMutation`,
  `useGetJoinRequestsQuery`, `useAcceptJoinRequestMutation`, `useRejectJoinRequestMutation`,
  `useGrantEventAdminMutation`, `useRevokeEventAdminMutation`.

> **Schema migration required:** adds `event_participants.role participant_role_type @default(player)`.
> Run `npm run prisma:migrate` + `npm run prisma:generate` from `backend-engine/backend/` before these
> endpoints work (the `role` reads/writes fail otherwise).

**Auth changes:** create/update/delete now require `Authorization: Bearer`. Organizer identity
is taken from the token on create (client no longer sends `organizer_id`); `organizer_id` is not
editable. Update/delete enforce organizer ownership.

**Route ordering:** static paths (`/my-events`) are declared before the dynamic `/:event_id`.

**Errors:** `VALIDATION_ERROR`, `BAD_REQUEST` (missing id), `EVENT_NOT_FOUND`,
`NOT_EVENT_ORGANIZER` (edit/delete by non-owner), `UNAUTHORIZED`/`INVALID_TOKEN`.

> `GET /events/nearby` (geo-search) is implemented in the controller but **not routed** —
> it needs PostGIS + verified status enums. Do not rely on it yet.

### Bookings (`/bookings`)

| method | path | auth | body / query | success `data` |
| --- | --- | --- | --- | --- |
| GET | `/available-slots` | public | q `ground`, `date` (YYYY-MM-DD) | `200` — slot availability row for that ground/date |
| GET | `/quote` | public | q `ground_id`, `slot`, `booking_date`, `promo_code?` | `200` — `{ isAvailable, slot, booking_date, base_rate, discount, final_price, is_peak, is_weekend, promotion }` |
| POST | `/create` | **required** | `{ ground_id, booking_date, slot, paid?, transaction_id?, payment_proof_url?, event_id?, promo_code?, payment_method?, notes? }` | `201` — created booking |
| GET | `/my` | **required** | — | `200` — `{ bookings:[...] }` (caller's bookings) |
| GET | `/manage` | **required, turf_admin/super_admin** | q `status?` | `200` — `{ bookings:[ {...,event_trust,users_bookings_user_idTousers} ] }` (own turfs; super_admin = all) |
| GET | `/:booking_id` | **required, owner or admin** | — | `200` — booking + `event_trust` (if event attached) |
| POST | `/:booking_id/confirm-payment` | **required, turf_admin/super_admin** | `{ admin_notes? }` | `200` — booking → confirmed/completed |
| POST | `/:booking_id/reject-payment` | **required, turf_admin/super_admin** | `{ admin_notes? }` | `200` — booking → reverts to unpaid hold (proof cleared, slot unlocked) |
| POST | `/:booking_id/cancel` | **required, owner or admin** | `{ reason? }` | `200` — cancelled OR mutual-cancel request opened |
| POST | `/:booking_id/cancel/respond` | **required, counterparty** | `{ accept: boolean }` | `200` — cancellation accepted (cancel + refund flag) or declined |

**Slot model:** 90-minute discrete grid — the 16 boolean columns on `slots` (`t0000`…`t2230`).
The boolean = **admin master enable + paid-lock**: `false` means admin-disabled OR paid-locked, so
it's not bookable; `true` means enabled (and possibly held by an *unpaid* booking, see below).

**Booking states** (reusing existing enums):

| meaning | `booking_status` | `payment_status` | locks slot? |
| --- | --- | --- | --- |
| unpaid soft hold | `pending` | `pending` | **no** (boolean stays `true`) |
| paid claim (awaiting admin) | `pending` | `partial` | yes (boolean → `false`) |
| admin-confirmed | `confirmed` | `completed` | yes |
| cancelled | `cancelled` | — / `refunded` | slot freed (boolean → `true`) |

**Rules enforced by `POST /create`:**
- Only **verified turfs** (`turfs.verified`) + **available grounds** (`grounds.status='available'`) —
  else `TURF_NOT_VERIFIED` / `GROUND_NOT_AVAILABLE`.
- **Paid** = a `transaction_id` **or** a `payment_proof_url` is supplied (`paid:true` without either →
  `PAYMENT_PROOF_REQUIRED`). A paid claim locks the slot and awaits admin verification.
- **Unpaid doesn't lock:** another user may still take a held slot **with payment** — the paid
  booking **auto-cancels** the unpaid holder (reason `superseded_by_paid_booking`) and notifies them.
  A second **unpaid** request on a held slot is rejected (`SLOT_HELD_UNPAID`). A paid-locked slot is
  fully unavailable (`SLOT_UNAVAILABLE`).
- An attached `event_id` must be an event the caller **organized**; admins then see its trust
  snapshot (`event_trust`: squad size `current_players`/`min`/`max`, `approved_count`, organizer).
- `payment_proof_url` (uploaded via the frontend imgbb flow) is visible to the owner + turf admins.

**Cancellation:**
- **Unpaid** → cancellable any time, free (never locked a slot).
- **Paid, not yet confirmed** → free cancel only **≥ 2 days** before `booking_date`, else
  `CANCELLATION_WINDOW_CLOSED`.
- **Paid + admin-confirmed** → payment is final: `POST /cancel` opens a **mutual cancellation
  request** (`cancellation_requested_by`); the *other* party must `POST /cancel/respond {accept:true}`
  to finalise (booking → cancelled, `payment_status='refunded'`). `accept:false` clears the request.

**Schema migration required:** adds `bookings.payment_proof_url String?` and
`bookings.cancellation_requested_by String? @db.Uuid`. Run `npm run prisma:migrate` +
`npm run prisma:generate` from `backend-engine/backend/`.

**Errors:** `VALIDATION_ERROR`, `INVALID_SLOT_CODE`, `SLOT_NOT_FOUND`, `SLOT_UNAVAILABLE`,
`SLOT_HELD_UNPAID`, `TURF_NOT_VERIFIED`, `GROUND_NOT_AVAILABLE`, `GROUND_NOT_FOUND`,
`PAYMENT_PROOF_REQUIRED`, `EVENT_NOT_FOUND`, `BOOKING_NOT_FOUND`, `NOT_BOOKING_OWNER`,
`NOT_TURF_ADMIN`, `BOOKING_NOT_PAID_CLAIM`, `BOOKING_ALREADY_CANCELLED`,
`CANCELLATION_WINDOW_CLOSED`, `CANCELLATION_NOT_REQUESTED`.

**Notifications** (reuse `booking_confirmed`/`booking_cancelled`/`payment_received`/`payment_pending`):
new booking → turf admin; superseded unpaid holder → user; confirm/reject payment → user;
cancel request/accept/decline → counterparty.

Frontend hooks: `useGetAvailableSlotsQuery`, `useGetBookingQuoteQuery`, `useCreateBookingMutation`,
`useGetMyBookingsQuery`, `useGetBookingByIdQuery`, `useGetManageBookingsQuery`,
`useConfirmBookingPaymentMutation`, `useRejectBookingPaymentMutation`, `useCancelBookingMutation`,
`useRespondCancellationMutation`.

### Turfmates (`/turfmates`)

All routes require `Authorization: Bearer`. Backed by the PostgreSQL `connections`
model (migrated off the deprecated mongoClient). A "turfmate" is an **accepted** connection.

| method | path | body / query | success `data` |
| --- | --- | --- | --- |
| POST | `/turfmate-request` | `{ receiverId, message? }` | `201` — created pending connection |
| GET | `/get-pending-requests` | `page?`, `limit?` | `200` — `{ requests:[{connectionId,message,created_at,user}], pagination }` (incoming) |
| GET | `/get-outgoing-requests` | `page?`, `limit?` | `200` — `{ requests:[{connectionId,created_at,user}], pagination }` (sent) |
| POST | `/accept-turfmate-request` | `{ requestId }` | `200` — accepted connection |
| POST | `/reject-turfmate-request` | `{ requestId }` | `200` — rejected connection |
| POST | `/cancel-turfmate-request` | `{ requestId }` | `200` — `{ connectionId }` (requester deletes own pending) |
| POST | `/remove-turfmate` | `{ userId }` | `200` — `{ userId }` (unfriend an accepted turfmate) |
| GET | `/get-turfmates` | `page?`, `limit?` | `200` — `{ turfmates:[{...profile, connected_since}], pagination }` |
| GET | `/connection-status/:userId` | path `userId` | `200` — `{ status: none\|pending\|accepted\|rejected\|blocked\|self, direction, connectionId }` |
| GET | `/get-mutual-turfmates` | query `userTwo` | `200` — array of mutual turfmate **profiles** |
| GET | `/recommendations` | `limit?` | `200` — `{ recommendations:[{...profile, mutual_turfmates, has_mutual, reason}] }` |

**Production hardening (this pass):**
- **Atomic create** — send relies on the `@@unique(requester_id,recipient_id)` index and
  catches Prisma `P2002` → `CONNECTION_ALREADY_EXISTS` (no non-atomic check-then-create);
  the reverse direction is still guarded explicitly.
- **Pagination** on all list endpoints; `get-turfmates` returns **profiles** (not bare ids) with
  `connected_since` — kills the client-side N+1.
- New lifecycle: reject / cancel / remove / outgoing list / connection-status.

**Notifications & alignment:** `connection_request` (priority `high`) on send, `connection_accepted`
(priority `high`) on accept. Turfmate **activity** is broadcast too (see Events): when a turfmate
organizes or joins a match, their turfmates are notified with a priority that scales with how soon
the match is (today=`urgent`, ≤3d=`high`, else `medium`), via `broadcastToTurfmates()`.

**Recommendations (location-based):** `GET /recommendations` ranks non-connected users by
**shared area** + **mutual turfmates**. Location = the user's home area (new optional
`users.division` / `district` / `latitude` / `longitude` columns) **and** an activity fallback
(cities of turfs from events they organized/joined). Each result carries `mutual_turfmates` +
`has_mutual` so the UI can highlight when a turfmate is involved.

**Errors:** `VALIDATION_ERROR`, `CANNOT_CONNECT_SELF`, `USER_NOT_FOUND`,
`CONNECTION_ALREADY_EXISTS`, `CONNECTION_NOT_FOUND`, `UNAUTHORIZED`/`INVALID_TOKEN`.

Frontend: hooks for every endpoint above, plus a `/turfmates` page (tabs: My Turfmates /
Requests / Discover).

> **Schema migration required:** this pass adds optional `division`, `district`, `latitude`,
> `longitude` columns to `users`. Run `npm run prisma:migrate` (or `prisma db push`) **and**
> `npm run prisma:generate` before starting the API, or the client will be out of sync.

**Behaviour note:** `get-mutual-turfmates` was changed from reading a request body to a
`userTwo` **query param** (GET requests carry no body).

**Notifications:** sending a turfmate request now notifies the receiver
(`connection_request`); accepting one notifies the original requester
(`connection_accepted`) — both persisted **and** pushed over Socket.IO.

### Notifications (`/notifications`)

All routes require `Authorization: Bearer` and are **scoped to the caller** — a user can
only read/mutate their own notifications (every query filters by `user_id`). Backed by the
PostgreSQL `notifications` model (`type` = `notification_type` enum, `is_read`, `priority`,
`data` JSON, `action_url`, …).

| method | path | body / query | success `data` |
| --- | --- | --- | --- |
| GET | `/` | query `page?`, `limit?` | `200` — `{ notifications, unreadCount, pagination:{page,limit,total,hasMore} }` (newest first) |
| GET | `/unread-count` | — | `200` — `{ unreadCount }` |
| PATCH | `/read-all` | — | `200` — `{ updated }` (marks all unread read) |
| PATCH | `/:id/read` | path `id` | `200` — updated notification |
| DELETE | `/:id` | path `id` | `200` — `{ id }` |

**Errors:** `NOTIFICATION_NOT_FOUND` (mark/delete an id you don't own), `UNAUTHORIZED`/`INVALID_TOKEN`.

Frontend hooks: `useGetNotificationsQuery`, `useMarkNotificationReadMutation`,
`useMarkAllNotificationsReadMutation`, `useDeleteNotificationMutation`.

#### Real-time (Socket.IO)

- The API server (Express) is wrapped in an HTTP server so **Socket.IO shares port 8080**.
  Client connects to the server **origin** (strip `/api/v1` from `NEXT_PUBLIC_API_BASE_URL`).
- **Handshake auth:** client sends the access token in `auth: { token }`; the server verifies
  it with `ACCESS_TOKEN_SECRET` and joins the socket to a private room `user:<id>`.
- **Server → client event:** `notification:new` with the full notification row, emitted to the
  recipient's room by `createNotification()` (`src/utils/notificationService.js`) — the single
  entry point every feature should use to notify a user (persists + delivers, never throws).
- **Frontend integration:** `getNotifications` (RTK Query) is the single source of truth — an
  initial REST fetch seeds the cache and `onCacheEntryAdded` streams `notification:new` into it
  (prepend + bump `unreadCount`). Socket singleton in `src/lib/socket.js`; disconnected on logout.

> **Production / multi-replica caveat:** the deploy runs **3 backend replicas behind nginx**.
> Socket.IO connection state is in-process, so cross-replica delivery needs nginx **sticky
> sessions** (`ip_hash`) **+** a Redis adapter (`@socket.io/redis-adapter`). Single-process dev
> works as-is; this is **not** wired yet.
