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
| POST | `/create-ground` | **turf_admin / super_admin** | single ground payload (name + ≥1 `sport_type` + `hourly_rate` required) | `201` — created ground |
| PATCH | `/grounds/:ground_id` | **turf_admin / super_admin** | partial ground fields (incl. `status`) | `200` — updated ground (scoped to the ground's owning turf admin) |

**Auth change:** `create-venue` / `create-ground` now require `Authorization: Bearer` **and**
a `turf_admin`/`super_admin` role. The owner (`admin_user_id`) is taken from the token —
the old anonymous hardcoded-admin fallback is removed.

**One turf per admin.** A `turf_admin` owns **exactly one** turf and grows it by adding
**grounds**, not more turfs:
- `create-venue` rejects a second turf from the same `turf_admin` → `TURF_ALREADY_EXISTS` (409).
  (App-level; `super_admin` is exempt — it's a moderator, not an owner.)
- `create-ground` attaches the ground to the **caller's own turf** (found by `admin_user_id`;
  `turf_id` in the body is honored only for `super_admin`). It sets `turf_id` + `status: available`,
  bumps `turfs.total_grounds`, and merges the ground's sports into `turfs.sports_available`. No turf
  yet → `NO_TURF_FOR_ADMIN` (404). *(Previously `create-ground` never set `turf_id` and was unusable.)*
  In the admin UI, the "Create Turf" action becomes **"Add Ground"** once the turf exists.

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

### Event comments (`/events/:event_id/comments`)

| method | path | auth | body | success `data` |
| --- | --- | --- | --- | --- |
| GET | `/` | optional | — | `200` — `{ comments:[...], can_comment }` |
| POST | `/` | **required, approved player** | `{ content, parent_comment_id? }` | `201` — created comment |
| PATCH | `/:comment_id` | **required, author** | `{ content }` | `200` — updated comment |
| DELETE | `/:comment_id` | **required, author or event admin** | — | `200` — soft-deleted |
| POST | `/:comment_id/like` | **required, approved player** | — | `200` — `{ liked, likes_count }` |

**Access model — read public, write earned.** Anyone (incl. signed-out) can read the thread; it's
social proof that a match is real. Only people actually IN the match may post, reply, or like:
the organizer, a `co_organizer`, or a participant with `status='approved'` (`canCommentOnEvent` in
`utils/eventService.js`). A user with a *pending* or *rejected* join request can read but not post.
`GET` returns **`can_comment`** so the client renders a composer or a "join to comment" prompt
without re-deriving the rule.

**Threading is one level deep.** Replying to a reply re-parents onto the same root, so a thread can
never become a staircase. **Deletes are soft** (`is_deleted`): the row survives so its replies keep a
parent, but `content` and `author` are nulled out of every response — the client renders a tombstone.
An event admin may delete any comment (moderation); only the author may edit.

Likes live in `comment_likes` (unique per `comment_id + user_id`); the toggle and the `likes_count`
counter update in one transaction so a double-tap can't drift the count. Writes are rate limited to
**20/min/user** (`commentWriteLimiter`).

**Errors:** `EVENT_NOT_FOUND`, `COMMENT_NOT_FOUND`, `CANNOT_COMMENT` (403 — not an approved player),
`NOT_COMMENT_AUTHOR`, `COMMENT_EMPTY`, `COMMENT_TOO_LONG` (2000 chars), `RATE_LIMITED`.

**Notifications:** a reply notifies the parent's author (`comment_reply`, priority `medium`); a new
top-level comment notifies the organizer (`comment_added`, priority `low`). Neither toasts — see below.

**Frontend hooks:** `useGetCommentsQuery`, `useCreateCommentMutation`, `useUpdateCommentMutation`,
`useDeleteCommentMutation`, `useToggleCommentLikeMutation` (the like is optimistic and self-reverting).

### Notification policy — bell vs toast

One rule, decided by the `priority` the backend already sets on every notification. The client never
guesses from the type string.

| surface | what | why |
| --- | --- | --- |
| **Bell only** | every persisted notification (`priority: medium`/`low`) — comment replies, event reminders, connection accepted, ratings, announcements | matters, but interrupting is rude |
| **Bell + toast** | `priority: high` — join request accepted/rejected, payment confirmed/rejected, your unpaid slot got taken, cancellation requested/accepted, a new join request (for admins) | you did not cause it and must act now |
| **Toast only** (never persisted) | the result of the user's *own* action — "Booking placed", "Comment posted", and all errors | you already have the context; a bell entry would be noise |

Implemented in `frontend-engine/src/lib/notify.js`. Live notifications arrive over the Socket.IO
`notification:new` stream (`apiSlice` `onCacheEntryAdded`), which adds every one to the bell and calls
`toastIncomingNotification` — that function is the single place the high-priority filter is applied.
`notifySuccess` / `notifyError` / `notifyInfo` are the toast-only helpers; they replaced every blocking
`window.alert()` in the app. Toast surface is `sonner`, mounted once in the root layout
(`components/Toaster.jsx`, themed off the design tokens).

### Bookings (`/bookings`)

| method | path | auth | body / query | success `data` |
| --- | --- | --- | --- | --- |
| GET | `/available-slots` | public | q `ground`, `date` (YYYY-MM-DD) | `200` — slot availability row for that ground/date |
| GET | `/quote` | public | q `ground_id`, `slot`, `booking_date`, `promo_code?` | `200` — `{ isAvailable, slot, booking_date, base_rate, discount, final_price, is_peak, is_weekend, promotion }` |
| POST | `/create` | **required** | `{ ground_id, booking_date, slot, paid?, transaction_id?, payment_proof_url?, event_id?, promo_code?, payment_method?, notes? }` | `201` — created booking |
| GET | `/my` | **required** | — | `200` — `{ bookings:[...] }` (caller's bookings) |
| GET | `/manage` | **required, turf_admin/super_admin** | q `status?` | `200` — `{ bookings:[ {...,event_trust,users_bookings_user_idTousers} ] }` (own turfs; super_admin = all) |
| GET | `/dashboard-stats` | **required, turf_admin/super_admin** | — | `200` — overview roll-up: `kpis`, 30-day `series`, `status_breakdown`, `top_grounds`, recent/upcoming/pending lists (own turfs; super_admin = all) |
| GET | `/:booking_id` | **required, owner or admin** | — | `200` — booking + owner + `event_trust` (if event attached) |
| GET | `/verify-lookup` | **required, turf_admin/super_admin** | q `code` (`FT-XXXXXXXX`) | `200` — booking resolved from a printed reference (manual verify, turf-scoped) |
| POST | `/:booking_id/confirm-payment` | **required, turf_admin/super_admin** | `{ admin_notes? }` | `200` — booking → confirmed/completed |
| POST | `/:booking_id/reject-payment` | **required, turf_admin/super_admin** | `{ admin_notes? }` | `200` — booking → reverts to unpaid hold (proof cleared, slot unlocked) |
| POST | `/:booking_id/cancel` | **required, owner or admin** | `{ reason? }` | `200` — cancelled OR mutual-cancel request opened |
| POST | `/:booking_id/cancel/respond` | **required, counterparty** | `{ accept: boolean }` | `200` — cancellation accepted (cancel + refund flag) or declined |
| POST | `/:booking_id/check-in` | **required, turf_admin/super_admin** | — | `200` — sets `check_in_time` (gate check-in via ticket QR) |

**Slot model:** 90-minute discrete grid — the 16 boolean columns on `slots` (`t0000`…`t2230`).
The boolean = **admin master enable + paid-lock**: `false` means admin-disabled OR paid-locked, so
it's not bookable; `true` means enabled (and possibly held by an *unpaid* booking, see below).

A `slots` row is an **exceptions record, not a precondition**. Every column defaults to `true`, so
**no row for a (ground, date) = the whole day is open** — a newly created ground is bookable with no
seeding step. Rows are created lazily, only to *close* a slot (paid-lock). `GET /available-slots`
returns a virtual all-open grid when no row exists; it never 404s. (`getSlotGrid` / `lockSlot` /
`unlockSlot` in `utils/bookingService.js` are the only way slot state is read or written.)

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

### Spam-proofing & concurrency

**`slot_locks` is the concurrency referee.** Every active claim — unpaid hold *and* paid claim —
owns a `slot_locks` row, whose DB-level `@@unique([ground_id, date, slot_code])` is what makes
double-booking impossible. `createBooking` does the claim, the supersede-cancel and the booking
INSERT in **one `$transaction`**: if a concurrent request claims the slot first, our INSERT raises
P2002, the whole transaction rolls back, and the caller gets `SLOT_UNAVAILABLE`. There is no window
where a slot is sold twice, and no state where a paid booking exists with an unlocked slot.
Notifications are sent only *after* the transaction commits.

**Unpaid holds expire.** An unpaid booking costs nothing but blocks every other unpaid user, so:

| lever | value | where |
| --- | --- | --- |
| hold TTL | **2 hours** (`slot_locks.locked_until`) | `UNPAID_HOLD_TTL_MS` |
| max concurrent unpaid holds **per turf, per user** | **4** | `MAX_UNPAID_HOLDS_PER_TURF` → `TOO_MANY_UNPAID_HOLDS` (429) |
| booking writes | **10 / min / user** | `bookingWriteLimiter` → `RATE_LIMITED` (429) |
| availability + quote reads | **120 / min** | `bookingReadLimiter` |

Expiry is keyed on `locked_until`, **not** `created_at` — so a payment rejected hours later restarts
a fresh 2h hold instead of dying instantly. Stale holds are reaped lazily on the availability/create/
`/my` paths *and* by a background sweeper (`jobs/holdSweeper.js`, every 10 min).

**Other gates on `POST /create`:** date must be ≥ today (`BOOKING_DATE_IN_PAST`) and within the
turf's `advance_booking_days` (`BOOKING_TOO_FAR_AHEAD`); a `transaction_id` may back only one active
booking (`DUPLICATE_TRANSACTION`); `payment_proof_url` must be an https imgbb URL we hosted
(`INVALID_PAYMENT_PROOF` — the admin clicks that link, so an arbitrary URL is a phishing vector);
one booking per user per slot (`ALREADY_BOOKED_SLOT`, makes a double-click safe).

**RBAC:** `authorizeRoles` only gates who may *reach* the admin endpoints. Confirm/reject/cancel and
`GET /:booking_id` are further scoped to **the admin of that specific turf** (`isBookingAdmin`) —
previously any `turf_admin` could verify payments and read payment proofs on a competitor's turf.
`super_admin` stays global.

`GET /available-slots` also returns **`held_slots: string[]`** — slot codes held by an unpaid
booking. Their grid boolean is still `true` (unpaid doesn't lock), so the client needs this to show
"held — pay to take it". `GET /my` returns **`hold_expires_at`** on unpaid bookings for the countdown.

### Booking ticket & gate check-in

A **confirmed** booking is a printable, invoice-style receipt on the player's side
(`/bookings/:id/ticket`). The booking `id` (a random UUID) *is* the ticket identity — there is **no new
column and no token table**. The receipt shows a QR plus a human-readable reference `FT-XXXXXXXX`
(first 8 hex of the id).

**The QR encodes the booking DATA** (compact JSON `{ v, id, ref, date, slot, ground, turf, amount }`),
not a URL — so a scan identifies the exact booking. The encoded snapshot is for instant display only;
it is **never trusted for the decision**. The turf admin scans it in the dashboard **Verify** tab
(`/dashboard/bookings/verify`), which pulls the `id` out and re-resolves the booking server-side before
offering check-in. So a hand-crafted QR resolves to nothing (or someone else's booking they don't own)
and can't check anyone in.

Two ways for the turf to verify, both landing on the same check-in action:
- **Scan** — camera reads the QR → `id` → `GET /:booking_id`.
- **Manual** — type the printed reference → `GET /verify-lookup?code=FT-XXXXXXXX`, which prefix-matches
  the 8 hex against the booking id **scoped to the caller's turfs** (raw SQL; refuses with
  `BOOKING_REF_AMBIGUOUS` on the astronomically unlikely double match).

Check-in is `POST /:booking_id/check-in`:
- scoped to **that turf's** admin (or super_admin) via `isBookingAdmin`, like every other admin action;
- booking must be `confirmed` (`BOOKING_NOT_CONFIRMED`) — an unpaid hold / unverified claim has no ticket;
- **single-use**: sets `check_in_time`; a second scan is rejected with `ALREADY_CHECKED_IN`, so a
  screenshot of a used ticket can't re-enter.

Reuses the existing `bookings.check_in_time` column — **no migration**. `GET /:booking_id` and
`/verify-lookup` include the booking owner (`users_bookings_user_idTousers`: id + name + avatar) so the
verify screen can show who the ticket belongs to.

### Dashboard analytics (`GET /dashboard-stats`)

Single roll-up powering the admin **Overview** tab. Turf-scoped (own turfs; super_admin = platform).
Everything is **derived from existing tables** (`bookings` / `reviews` / `grounds` / `turfs`) — no
analytics table, no audit table, no new columns. Returns:

- `kpis` — realized revenue (all-time + this month), bookings (total + month), upcoming,
  `pending_verifications`, unique players, grounds/turfs, `avg_rating`, `occupancy_pct`.
- `series` — 30-day zero-filled `{ date, bookings, revenue }[]` (revenue counts only `completed`).
- `status_breakdown` — booking-status counts; `top_grounds` — top 5 by realized revenue.
- `recent_bookings` / `upcoming_bookings` / `pending_verifications_list` — action lists.

**Realized revenue = `payment_status: completed` only.** A `partial` claim is money awaiting admin
verification — surfaced as an action item, never counted as earned.

**Schema migration required:** adds `bookings.payment_proof_url String?`,
`bookings.cancellation_requested_by String? @db.Uuid`, and the composite index
`@@index([ground_id, booking_date])`. All additive. Run `npm run prisma:push:pgsql` +
`npm run prisma:generate:pg` from `backend-engine/backend/`.

**Errors:** `VALIDATION_ERROR`, `INVALID_SLOT_CODE`, `SLOT_UNAVAILABLE`,
`SLOT_HELD_UNPAID`, `TURF_NOT_VERIFIED`, `GROUND_NOT_AVAILABLE`, `GROUND_NOT_FOUND`,
`PAYMENT_PROOF_REQUIRED`, `EVENT_NOT_FOUND`, `BOOKING_NOT_FOUND`, `NOT_BOOKING_OWNER`,
`NOT_TURF_ADMIN`, `BOOKING_NOT_PAID_CLAIM`, `BOOKING_ALREADY_CANCELLED`,
`CANCELLATION_WINDOW_CLOSED`, `CANCELLATION_NOT_REQUESTED`, `TOO_MANY_UNPAID_HOLDS`,
`BOOKING_DATE_IN_PAST`, `BOOKING_TOO_FAR_AHEAD`, `DUPLICATE_TRANSACTION`, `INVALID_PAYMENT_PROOF`,
`ALREADY_BOOKED_SLOT`, `RATE_LIMITED`.

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
