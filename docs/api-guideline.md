# FunTurf API Guideline

Base URL: `http://localhost:8080/api/v1` (dev) · `https://app4-osju.onrender.com/api/v1` (prod).

This document is the **contract between the backend and the frontend**. Update it in the
same change that touches a route, so `frontend-engine` can be kept in sync.

> **Machine-readable spec:** [`backend-engine/backend/docs/openapi.yaml`](../backend-engine/backend/docs/openapi.yaml)
> covers the same surface as an OpenAPI 3.0.3 document — every endpoint, required vs.
> optional fields, error codes and examples. Use it for client generation and mock servers,
> and update it alongside this file when a route changes. It lives under `backend/` because
> that is the Docker build context (`render.yaml` → `rootDir: ./backend`); a spec outside it
> would not exist in the deployed image.
>
> **Swagger UI:** the backend serves that spec interactively at `/api/v1/docs`, with the raw
> JSON at `/api/v1/docs.json`. It is **off when `NODE_ENV=production`** unless `DOCS_ENABLED=true`
> is set — so it is a dev/docker-compose tool, not a public endpoint. See
> `backend/src/utils/swagger.js`.

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
| `INVALID_TOKEN` | 401 | Token tampered/malformed — client should log out |
| `TOKEN_EXPIRED` | 401 | Access token expired — client should refresh via `POST /users/refresh` and retry |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `USER_NOT_FOUND` | 404 | No such user |
| `USER_ALREADY_EXISTS` | 409 | Email/phone already registered |
| `TOKEN_GENERATION_FAILED` | 500 | Could not issue tokens |
| `EVENT_FULL` | 409 | Match already at capacity (join/approve) |
| `ALREADY_JOINED` | 409 | Caller already has a request/participation |
| `NOT_EVENT_PARTICIPANT` | 400 | Caller isn't a participant (leave / promote target) |
| `NOT_EVENT_ADMIN` | 403 | Caller isn't an event admin (organizer/co_organizer) |
| `EVENT_NOT_EDITABLE` | 409 | A completed/cancelled match can no longer be edited |
| `INVALID_PLAYER_LIMITS` | 400 | Player limits invalid (max below current squad, or min > max) |
| `EVENT_SCHEDULE_LOCKED` | 409 | Tried to hand-set the time on a match whose time is set by an attached booking |
| `JOIN_REQUEST_NOT_FOUND` | 404 | No pending join request for that user |
| `INVITATION_NOT_FOUND` | 404 | No pending invitation for the caller on that match |
| `NO_TURF_FOR_ADMIN` | 404 | Caller (turf_admin) doesn't own a turf yet |
| `PROMO_NOT_FOUND` | 404 | Promotion not found / not the caller's |
| `PROMO_CODE_EXISTS` | 409 | Promotion code already in use |
| `PROMO_SCOPE_FORBIDDEN` | 403 | Ground/turf doesn't belong to the caller |
| `ALREADY_ADMIN` | 409 | Target is already an event admin |
| `NOTIFICATION_NOT_FOUND` | 404 | Notification not found / not owned |
| `TEAM_NOT_FOUND` | 404 | Team not found, or disbanded (`is_active: false`) |
| `NOT_TEAM_CAPTAIN` | 403 | Caller isn't the captain (or, on invite routes, not a captain/co-captain) |
| `NOT_TEAM_MEMBER` | 403 | Caller (or the target) isn't an active member of the team |
| `ALREADY_TEAM_MEMBER` | 409 | Invited player is already on the roster |
| `TEAM_INVITE_ALREADY_EXISTS` | 409 | A **pending** invite is already out for that player |
| `TEAM_INVITE_NOT_FOUND` | 404 | No pending invite with that id for the caller / team |
| `CANNOT_REMOVE_CAPTAIN` | 400 | Captain tried to remove themself — transfer captaincy or disband first |
| `CANNOT_INVITE_SELF` | 400 | Tried to invite yourself to a team |

## Auth

Protected routes require `Authorization: Bearer <accessToken>`. The token is issued by
`POST /users/login` and carried by the frontend NextAuth session
(`session.user.access_token`) → RTK Query `prepareHeaders`.

## Object ids (URL masking)

Every id the API accepts or returns — path, query, body, response, Socket.IO payload —
is an **opaque 22-character public id**, never the database key:

```
/venues/ROxl8HkZND7yrL1B59ZocA          not  /venues/f47ac10b-58cc-4372-a567-0e02b2c3d479
```

### Why

Primary keys are `uuid_generate_v4()`, so they were never *guessable* — 122 random bits
is not enumerable, and every route enforces ownership server-side regardless. The problem
masking solves is exposure, not guessing: internal keys were landing in browser history,
`Referer` headers sent to third parties, bookmarks, analytics payloads and support
screenshots. Handing out a value that isn't the database key makes all of that harmless.

**This is not an access control.** It hides the key; it does not authorize anything.
Ownership checks (`isBookingAdmin`, the `admin_user_id` comparison in `updateVenue`, …)
still run after the id is resolved and are what actually guard a row.

### How

`src/utils/publicId.js` — AES-128 over the UUID's 16 raw bytes. Exactly one block, so the
output is 16 bytes → 22 base64url chars, *shorter* than the UUID it replaces. ECB mode is
used deliberately: its usual weakness is that repeated plaintext blocks produce repeated
ciphertext blocks, which needs more than one block to matter, and determinism is required
here — one record must always map to one URL or links and caches break.

Applied globally by `src/middlewares/publicId.middleware.js`, mounted in `app.js`:

```
express.json  →  publicIdTranslation  →  routes  →  errorHandler
```

| direction | what it does | how it decides |
| --- | --- | --- |
| **inbound** | token → UUID in the path, query and body | **key**-driven: `id`, `*_id(s)`, `*Id(s)`, `*_by` |
| **outbound** | UUID → token in every `res.json` body | **value**-driven: anything UUID-shaped, except free-text keys (`message`, `notes`, `description`, …) |

The asymmetry is intentional. Outbound is value-driven so it **fails closed** — a new
id-bearing column is masked the day it is added, with no code change; a key-driven rule
would have leaked the six `*_by` audit columns, which are `@db.Uuid` with no `_id` suffix.
Inbound is key-driven because a 22-char base64url string is not rare (a password, a nonce),
and blindly "decoding" one would corrupt the field.

Path rewriting targets `req.url` rather than `req.params`, because at app level `req.params`
is still empty — it is only populated once a route pattern matches. That is why all ~40
routes were covered without any route file changing.

> **Constraint when adding routes.** A token is any 22-character `[A-Za-z0-9_-]` string, and
> there is no integrity check to distinguish one from a literal (see below). A **static** route
> segment of exactly 22 URL-safe characters would be rewritten into a UUID and stop matching.
> None exists today — the longest are the 23-char `accept|reject|cancel-turfmate-request`
> routes, so the margin is one character. Keep static segments off that length.

There is deliberately no MAC on a token. Any 16 bytes decrypt to 16 bytes, and every 16 bytes
is a syntactically valid UUID, so a forged token resolves to an id that matches no row and the
caller gets a clean `404` — verified. Nothing is lost by that: the id is not a capability, so a
forgery has nothing to gain.

Note the codec is **not** version-locked to UUIDv4. The schema default is `uuid_generate_v4()`,
but most seeded rows are v5; an earlier v4-only check rejected 95 of 108 live rows.

Socket.IO is masked separately (`emitToUser` / `emitToEvent` in `src/socket.js`), since
real-time payloads never pass through `res.json`. Room keys stay internal UUIDs;
`event:subscribe` translates the client's token before deriving the room name.

### Rules for clients

- **Ids are opaque.** Do not parse, slice or derive from them. Anything previously computed
  from a UUID is now sent explicitly — a booking's printable reference arrives as
  `Booking.ref` (`FT-7K3QX9A1`), computed server-side by `withBookingRef`, because it is a
  prefix of the *internal* key the client no longer has.
- **Send back exactly what you received.** No client-side encode/decode exists or is needed.
- A raw UUID is still **accepted** on input (back-compat with printed tickets and older
  clients) but is never returned. It grants nothing — the ownership check is unchanged.

### Key management

| var | notes |
| --- | --- |
| `PUBLIC_ID_SECRET` | Key for the codec. **Permanent** — changing it changes every public URL on the site at once. Must be byte-identical across `app1/2/3`, or a link issued by one replica is unreadable by another. |

If unset it falls back to `ACCESS_TOKEN_SECRET`, which is already identical across replicas
(JWT requires it), so an existing deploy keeps working with no action. Set `PUBLIC_ID_SECRET`
explicitly anyway: otherwise rotating the JWT secret would silently invalidate every link
ever issued.

### Known boundary

The JWT access-token payload still carries the caller's raw UUID (`{ id, email, user_type }`),
because `verifyJWT` and the Socket.IO handshake both read it. A signed-in user can therefore
decode their *own* internal id from their own token. That is deliberate and out of scope for
URL masking — it is not a browser link, is not shared with third parties, and reveals only
the holder's own id.

## CORS & environment

CORS is **whitelisted**, not open. Both the REST layer (`app.js`) and Socket.IO
(`socket.js`) read the same allow-list from `backend-engine/backend/src/utils/corsOrigins.js`,
so they never drift. A blocked browser origin is logged (`CORS blocked origin: ...`)
and rejected. Requests with no `Origin` header (server-to-server, NextAuth's
server-side login POST, curl, mobile) are allowed — the boundary is browser-only.
`credentials: true` is set (auth is a Bearer header today, but cookies stay supported).

**Backend env** (Render — set on each `app1/2/3` service):

| var | example | notes |
| --- | --- | --- |
| `CORS_ORIGINS` | `http://localhost:3000,https://funturf-frontend.vercel.app` | Comma-separated allowed origins. Trailing slashes ignored. If unset, falls back to `localhost:3000` + the Vercel frontend. |
| `PUBLIC_ID_SECRET` | *(32 random bytes, base64url)* | Key for the public-id codec — see [Object ids](#object-ids-url-masking). Identical on all three replicas; permanent. Falls back to `ACCESS_TOKEN_SECRET` if unset. |
| `APP_TZ_OFFSET_MINUTES` | `360` | Minutes offset of the app's local wall-clock from UTC. Used by the event sweeper to decide when a game's naive `event_date`+`end_time` has passed. Default `360` (Bangladesh, UTC+6). |

### Background jobs

Started in `src/index.js`, run in-process on every replica (idempotent, so multi-replica is safe — just redundant):

| job | file | interval | what it does |
| --- | --- | --- | --- |
| hold sweeper | `jobs/holdSweeper.js` | 10 min | Cancels expired unpaid booking holds (see Bookings). |
| event sweeper | `jobs/eventSweeper.js` | 5 min | **Takes down expired games** — flips any live event (`open`/`ready`/`booked`) whose slot end has passed to `completed`, then notifies members (`event_completed`) and emits `event:roster` so open match pages refresh. End instant = `event_date + end_time` (+1 day for slots crossing midnight), compared in local time via `APP_TZ_OFFSET_MINUTES`. `status` already surfaces as `completed`. |

Notifications fire **exactly once across replicas**: the `RETURNING` rows of the completing UPDATE are the claim — only the replica that actually flips a row gets it back, so the other two notify nobody. (This is why plain `setInterval` is kept over a cron dependency — cron schedules, but wouldn't dedupe the 3 replicas.)

**Frontend env** (Vercel — Production):

| var | value |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://app4-osju.onrender.com/api/v1` |
| `NEXT_PUBLIC_BASE_URL` | `https://funturf-frontend.vercel.app` |
| `NEXTAUTH_URL` | `https://funturf-frontend.vercel.app` |
| `NEXTAUTH_SECRET` | *(real secret)* |

Local dev is unaffected — `http://localhost:3000` is in the default allow-list and the
local `.env` keeps `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1`.

## Endpoints

> Filled in route-by-route as each area is reviewed. Each entry documents method,
> path, auth requirement, request body/query, and success `data` shape.

### Users (`/users`)

| method | path | auth | body / params | success `data` |
| --- | --- | --- | --- | --- |
| POST | `/register` | public | `{ first_name, last_name, email, password_hash, phone?, date_of_birth?, gender?, profile_picture_url?, bio?, sports?, division?, district?, latitude?, longitude?, user_type? }` | `201` — user fields + `accessToken`, `refreshToken`, `tokenExpiresIn` |
| POST | `/login` | public | `{ email, password }` | `200` — `{ user: { ...profile, username, accessToken, refreshToken, tokenExpiresIn } }` |
| POST | `/refresh` | public | `{ refresh_token }` | `200` — `{ accessToken, refreshToken, tokenExpiresIn }` |
| GET | `/:user_id` | public | path `user_id` | `200` — full public profile: account fields (`gender`, `division`, `district`, `latitude`, `longitude`, verification, `created_at`, …) + `player_profile` (skill, positions, experience, foot, jersey, height/weight, play time, travel, reliability, games) + **live** `eventsJoined`, `gamesOrganized`, `friends`, flat `rating`, `sports`, `username` |
| PATCH | `/me` | ✅ | any subset of the editable fields (below) | `200` — refreshed profile + recomputed `profile_completion` |
| GET | `/scout` | ✅ | query `q?`, `sport?`, `position?`, `skill?`, `division?`, `district?`, `limit?` | `200` — `{ players: [...], count }`, ranked most-complete-first |
| POST | `/media/signature` | ✅ | — | `200` — `{ signature, timestamp, cloudname, apikey }` (Cloudinary direct-upload signature) |

**Errors:** `VALIDATION_ERROR` (missing fields), `USER_ALREADY_EXISTS` (register, email/phone clash),
`INVALID_CREDENTIALS` (login — same code for unknown email and wrong password, by design),
`USER_NOT_FOUND` (GET by id), `CONFLICT` (`PATCH /me`, phone belongs to another account),
`INVALID_TOKEN` / `MISSING_TOKEN` (protected routes).

#### Edit your own profile (`PATCH /users/me`)

Partial update across **two tables** in one transaction: the account row (`users`) and the sporting
profile (`player_profiles`, created on first save — it's `findFirst` + create/update rather than
`upsert`, because `player_profiles.user_id` is indexed but not unique). Rate limited to 20/min.

**The target is `req.user.id` from the verified JWT — `me` is a literal.** There is deliberately no
id in the path or body: with one, a caller could edit anyone's profile by swapping a uuid.

Editable, allowlisted in `backend/src/utils/profileService.js`:

| Table | Fields |
| --- | --- |
| `users` | `first_name`, `last_name`, `phone`, `date_of_birth`, `gender`, `bio`, `division`, `district`, `profile_picture_url`, `cover_photo_url` |
| `player_profiles` | `preferred_positions`, `sports_played`, `skill_level`, `years_of_experience`, `preferred_foot`, `jersey_number`, `height_cm`, `weight_kg`, `preferred_play_time`, `max_travel_distance_km`, `achievements` |

**Never editable here:** `email`, `user_type`, `status`, `email_verified`, `phone_verified`,
`password_hash`, `refresh_token` (identity/trust boundary — each needs its own verified flow), and
`rating` / `total_games_played` / `total_games_organized` / `reliability_score` (server-derived
reputation; self-editing would make it meaningless). Unlisted keys are **ignored**, not rejected —
it's an allowlist, so adding a schema column never silently makes it user-writable.

**Semantics:** an absent key leaves the field alone; explicit `null` or `""` clears it.
`first_name`/`last_name` cannot be cleared (NOT NULL). Validation: enums matched against the Prisma
enums exactly; integers range-clamped (`years_of_experience` 0–60, `jersey_number` 0–99, `height_cm`
50–260, `weight_kg` 20–250, `max_travel_distance_km` 0–200); `date_of_birth` must imply an age of
10–120; text length-capped; `preferred_positions` ≤6 and `sports_played` ≤12 entries.

**Image URLs are untrusted input.** The client uploads to the image host first and PATCHes the
resulting URL back, so a bare "any string" field would let a user point their avatar or banner at
arbitrary third-party content — a hotlink/tracking surface on our own pages. Both image fields must
be `https` on an allowlisted host (`i.ibb.co`, `ibb.co`, `image.ibb.co`, `res.cloudinary.com`);
extend with the comma-separated `PROFILE_IMAGE_HOSTS` env var.

Saving busts the `userCache` entry for that user, so the next authenticated request sees the edit.

#### Profile completion (`profile_completion`)

`GET /users/:user_id` returns a `profile_completion` object scored server-side against the weighted
checklist in `profileService.js` — the client never recomputes it, so the checklist a player sees can
never drift from what the API counts.

```jsonc
{
  "percent": 65, "earned": 19, "total": 29,
  "filled_count": 11, "total_count": 19,
  "completed": ["profile_picture_url", "bio", "district"],
  "missing": [{ "key": "skill_level", "label": "Skill level",
                "hint": "Gets you matched to the right games",
                "weight": 3, "source": "player" }]
}
```

Weights reflect how much a field helps other people **find and pick you** — a profile photo, sports,
skill level and positions are weight 3; a jersey number or weight is 1. `missing` carries the label
and hint the UI renders, so the checklist is generated entirely from this payload. `source` tells the
client which tab of the edit form holds the field. Returned for every profile (it's derived from
already-public fields); the frontend only renders the nudge card on your own page, and hides it at
100%.

**Completeness is not cosmetic — it ranks you.** `completionBoost()` in `profileService.js` turns the
same weighted percent into a discovery-ranking term, used by two surfaces:

| Surface | Cap | Role in the score |
| --- | --- | --- |
| `GET /users/scout` | 10 | **Dominant.** Every result already matches the filters, so relevance is binary; completeness decides who a captain sees first. |
| `GET /turfmates/recommendations` | 3 | **Tie-break only** — `mutual * 10` still dominates, because mutual turfmates are the stronger signal for a *social* suggestion. |

This is the mechanism behind the "finish your profile" nudge: the percent a player sees on their own
page is literally the number that moves them up these lists. Change the checklist weights and you
change discovery ranking — they are the same numbers, deliberately.

#### Scout players (`GET /users/scout`)

Player search for team recruitment. All filters optional, ANDed; the caller is excluded from their
own results. `sport` and `position` match inside the `sports_played` / `preferred_positions` JSON
arrays via `array_contains`, so filtering on either **implicitly excludes players with no sporting
profile** — they cannot match. Score: completeness (0–10) + district 3 / division 1 + rating (0–5) +
`reliability_score / 100 × 2`. The internal `_score` never leaves the server;
`profile_completion_percent` does, so the UI can badge a full profile.

**Auth required, and no contact details in the response.** This endpoint lists other users: public,
it would be an anonymous directory of the whole platform, and returning `email`/`phone` would make it
a harvesting endpoint. `PUBLIC_PLAYER_SELECT` carries neither — a captain gets contact details only
after a connection or an accepted invite. `phone` *is* read internally (it's a scored checklist
field) and stripped before the response. The candidate pool is capped at 200 rows before ranking so
an unfiltered search can't become a full scan plus sort.

Consumed by the frontend's `TeamInviteDialog` "Scout players" tab, alongside the existing turfmates
pool. The tab only queries once at least one filter is set — an unfiltered "everyone" list isn't a
useful starting point.

Notes:
- **`GET /:user_id` is the full player profile.** It joins `player_profiles` (1:1 sporting profile)
  and computes live aggregates in parallel: `eventsJoined` = approved `event_participants`,
  `gamesOrganized` = `events` where `organizer_id` = user, `friends` = `accepted` `connections` in
  either direction. `sports` comes from `player_profile.sports_played`; the flat `rating` mirrors the
  profile's reputation rating. `player_profile` is `null` for a user who hasn't filled one in yet.
- **`cover_photo_url`** is the wide profile banner. It's stored **already cropped** to the banner
  aspect (4:1) by the client, so the page renders it with a plain `object-cover` — no focal-point
  column, no positioning maths. Re-framing means re-uploading, which is the trade for the simpler
  model. The frontend cropper is `components/ImageCropDialog.jsx` + `utils/cropImage.js`.
- `password_hash` in the register body is the **plaintext** password; the `encryptPassword`
  middleware hashes it before the controller runs (field name is historical).
- **No auth response ever returns credential material.** `register` does not select
  `password_hash` (it used to, and echoed the caller's own bcrypt hash straight back);
  `login` selects it only to `bcrypt.compare` and strips it before responding. If you add a
  field to either `select`, keep it out of the response spread.
- **`login` carries no activity aggregates.** It previously shipped `sports: []` and
  `teamsJoined / eventsJoined / friends: 0` — all hardcoded, so they were wrong for anyone who
  had ever played, and nothing consumed them. Read `GET /:user_id` for the live counts.
- **`POST /media/signature` requires auth.** The signature *is* the upload credential, so a
  public endpoint let anyone upload into our Cloudinary account. It also returns the standard
  `ApiResponse` envelope now (it used to return a bare object — the only endpoint that did).
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
| GET | `/:venue_id` | **optional auth** | path `venue_id` | `200` — full venue DTO with grounds; `rating` (live avg), `rating_count`, and `my_rating` (the caller's own 1–5, or `null`) |
| GET | `/get-venues-by-admin/:admin_id` | public | path `admin_id` | `200` — venues owned by that admin (`[]` if none) |
| POST | `/:venue_id/rating` | **required** | `{ rating (1–5 int), comment? }` | `200` — `{ venue_id, my_rating, rating (avg), rating_count }`. Upsert: one rating per user, re-posting **updates** it |
| POST | `/create-venue` | **turf_admin / super_admin** | venue payload incl. `grounds[]` (see `frontend-engine/src/utils/constants.js`) | `201` — created venue DTO |
| POST | `/create-ground` | **turf_admin / super_admin** | single ground payload (name + ≥1 `sport_type` + `hourly_rate` required) | `201` — created ground |
| PATCH | `/grounds/:ground_id` | **turf_admin / super_admin** | partial ground fields (incl. `status`) | `200` — updated ground (scoped to the ground's owning turf admin) |
| PATCH | `/:venue_id` | **turf_admin / super_admin** | partial turf identity — `name`, `description`, `logo_url`, `images[]`, `theme_color` | `200` — updated venue DTO (scoped to the turf's own admin) |

#### Turf branding (`PATCH /venues/:venue_id`)

Lets a turf owner rename their turf and change its imagery after onboarding — before this,
everything set in the create-turf wizard was frozen.

**Allowlist.** Only `name`, `description`, `logo_url`, `images`, `theme_color` are writable.
Adding a column to `turfs` never makes it client-writable by accident. Explicitly **not** editable:

| field | why |
| --- | --- |
| `slug` | UNIQUE, generated with no collision suffix — re-deriving it on rename could `409` against an unrelated turf. Nothing routes by slug (every route uses the turf id), so a stale slug is harmless while a failed rename is not. |
| `verified`, `status` | Platform decisions, not the owner's. |
| `admin_user_id` | Reassigning ownership is not a self-service action. |
| `rating`, `total_bookings` | Derived from reviews / bookings. |

**Ownership.** The role gate (`turf_admin`/`super_admin`) is only the outer fence — every turf owner
holds the same role, so the controller *also* checks `turf.admin_user_id === req.user.id`.
`super_admin` bypasses that check; a mismatch logs a warning and returns `NOT_TURF_ADMIN` (403).

**Partial semantics.** Absent key = untouched. `null` or `""` = clear the column. That's how
"remove my logo" and "reset to the default palette" are expressed. A body with no editable keys
is a `VALIDATION_ERROR`, not a silent no-op.

**Image URLs are untrusted.** `logo_url` and every entry of `images` must be an **https** URL on an
allowlisted host (`backend/src/utils/imageUrl.js`, extensible via `PROFILE_IMAGE_HOSTS`) — the same
validator the profile write path uses. Without it a turf could point the panel logo at any address on
the internet, making our pages a hotlink/tracking surface for content we never vetted.
Upload via `POST /api/upload` first, PATCH the returned URL.

**`theme_color`** must be a literal `#RRGGBB` triple. It is written into a CSS custom property in the
admin panel, so anything looser (named colours, `rgb()`, shorthand) is a style-injection vector and is
rejected. The frontend samples it from the logo at upload time and lets the owner override it.
`null` means the panel renders in the default FunTurf green.

Rate-limited by `profileWriteLimiter` (20 writes / 60s).

**Turf ratings.** A rating is a `reviews` row with `review_type='turf'`. One per `(reviewer, turf)`:
`POST /:venue_id/rating` looks for the caller's existing turf review and **updates** it, else creates one
(so a user can raise/lower their score but never stack duplicates). The turf's stored `rating` is
recomputed as the average of all `approved` turf reviews after every write, and `GET /:venue_id` returns
that live average plus `rating_count` and (when authenticated) the caller's own `my_rating`.

**Auth change:** `create-venue` / `create-ground` now require `Authorization: Bearer` **and**
a `turf_admin`/`super_admin` role. The owner (`admin_user_id`) is taken from the token —
the old anonymous hardcoded-admin fallback is removed.

### Promotions / coupons (`/promotions`)

Coupon management for a turf manager. **All routes require `turf_admin` / `super_admin`** and are
scoped to the caller's turf (a `turf_admin` owns one turf; a `super_admin` may target any via
`?turf_id` / `turf_id` in the body). Every promotion belongs to a `turf_id`; scope can be narrowed by
`ground_id`, `applicable_users`, and `applicable_days`.

| method | path | body / params | success `data` |
| --- | --- | --- | --- |
| GET | `/promotions` | — | `200` — `{ promotions:[promoDTO] }` (this turf's, newest first; each with `ground_rate`, `is_expired`, `is_exhausted`, `effective_status`) |
| GET | `/promotions/analytics` | `?days` (7–180, default 30) | `200` — `{ range_days, totals:{redemptions,total_discount,unique_users}, status_counts:{active,inactive,expired,exhausted,total}, by_coupon:[{code,title,redemptions,total_discount}], timeseries:[{day,redemptions,discount}] }` |
| POST | `/promotions` | promo payload (below) | `201` — created promoDTO. Dup code → `PROMO_CODE_EXISTS` (409) |
| GET | `/promotions/:promotion_id` | — | `200` — promoDTO. Not yours → `PROMO_NOT_FOUND` (404) |
| PATCH | `/promotions/:promotion_id` | any promo fields | `200` — updated promoDTO. **Reuse a coupon by editing** it — extend `valid_until`, raise `usage_limit`, or flip `status` back to `active` to revive an expired/exhausted code |
| DELETE | `/promotions/:promotion_id` | — | `200` — hard-delete if never redeemed; **deactivates** (status `inactive`) instead when `promotion_usage` exists, to keep analytics history |

**Customer-facing (auth only, not turf-admin):**

| method | path | params | success `data` |
| --- | --- | --- | --- |
| GET | `/coupons/available` | `?ground_id` (req), `?date` | `200` — `{ coupons:[{ code, title, description, discount_type, discount_value, minimum_booking_amount, maximum_discount_amount, is_targeted }] }` — the coupons the **caller** may apply to a booking on that ground/date |

`/coupons/available` filters per user server-side (validity, scope, usage cap, day/**user** targeting) so **private/group coupons never leak** to other users — `is_targeted` flags a user/group-scoped coupon so the UI can badge it "for you".

**Payload:** `{ code, title, description?, discount_type:'percentage'|'fixed_amount', discount_value,
minimum_booking_amount?, maximum_discount_amount?, valid_from, valid_until, usage_limit?, ground_id?,
applicable_users?:[userId], applicable_days?:[0–6], status?:'active'|'inactive' }`.
`code` is **unique per turf** (upper-cased) — the same code may exist on a different turf, but not
twice on one (`@@unique([turf_id, code])`); dup on the same turf → `PROMO_CODE_EXISTS` (409).
`valid_until` must be after `valid_from`; a percentage can't exceed 100. `ground_id` must belong to the
caller's turf (`PROMO_SCOPE_FORBIDDEN`). No turf yet → `NO_TURF_FOR_ADMIN` (404).

**Redemption (booking time).** `computeSlotPricing` (used by the booking preview + create) now matches a
code by scope — the exact `ground_id`, else the whole `turf_id`, else a global (turf-less) promo —
and enforces the **validity window against the BOOKING date** (slots are booked in advance, so a
coupon "valid Jul 17–31" covers any slot *dated* in that range, date-only + TZ-safe), plus
`applicable_days` (the booking date's weekday), `applicable_users` (vs the
booker), the `usage_limit` vs `used_count`, and `minimum_booking_amount`; the discount is capped by
`maximum_discount_amount` and can never exceed the base rate. On a successful discounted booking a
`promotion_usage` row is written and `used_count` is incremented **inside the booking transaction**
(so a rolled-back booking never counts) — this is what the analytics charts read.

**Applying a coupon at booking.** The customer's booking screen shows a **coupon picker** (from
`/coupons/available`) plus manual code entry; the `GET /bookings/quote` response drives a live **price
breakdown** (subtotal → discount → total). On booking, the redemption is recorded and the ticket
(`GET /bookings/:id`, `GET /bookings/my`) carries the applied code via `promotion_usage[].promotions.code`
for the invoice's `Discount (CODE)` line.

**Schema:** adds one nullable column **`promotions.applicable_users`** (JSON array of user UUIDs) and
changes the code constraint from global `@unique` to **`@@unique([turf_id, code])`**. Run
`npx prisma db push` + `npm run prisma:generate:pg`. All other columns (`applicable_days`,
`usage_limit`, `used_count`) and the `promotion_usage` table already existed.

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
  latitude, longitude  // REQUIRED, set from the map picker (powers the events "nearby" ranking)
}
```

- **Required:** `name`, `address_line_1.area`, `address_line_1.city`, `address_line_1.state`,
  a valid `address_line_1.latitude`/`longitude` (map location),
  and at least one ground with `name` + `sport_type` + `hourly_rate`.
- **Optional (nullable in DB):** description, address_line_2 (landmark), postal_code,
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
| GET | `/` | **optional auth** | query `page?`, `limit?`, `sport?`, `timeframe?`, `q?`, `openOnly?`, `joinedOnly?` | `200` — `{ events, pagination, stats? }` (**recommended-ranked** paginated feed; authed → each event carries `my_role`) |
| GET | `/nearby` | public | query `lat`, `lng`, `radius?` (km, 1–100, default 10) | `200` — `{ events:[{…, turf_name, ground_name, distance_km}], search_radius_km, center }` (nearest first, ≤50) |
| POST | `/:event_id/join` | **required** | — | `201` — created **pending** request (status `requested`; does NOT bump `current_players`; notifies all admins + requester) |
| DELETE | `/:event_id/join` | **required, requester** | — | `200` — `{ event_id }` (withdraw own pending request) |
| DELETE | `/:event_id/leave` | **required, approved participant** | — | `200` — `{ event_id }` (decrements only if was approved) |
| POST | `/:event_id/invitation/accept` | **required, invitee** | — | `200` — `{ event_id }` (accept an `invited` row → `approved`, +`current_players`; `INVITATION_NOT_FOUND`/`EVENT_FULL`) |
| POST | `/:event_id/invitation/decline` | **required, invitee** | — | `200` — `{ event_id }` (decline → invite row **deleted**, so they may request later; `INVITATION_NOT_FOUND`) |
| GET | `/:event_id/requests` | **required, admin** | — | `200` — `{ requests:[{id,user_id,joined_at,users}] }` (pending `requested` only — `invited` rows excluded) |
| POST | `/:event_id/requests/:user_id/accept` | **required, admin** | — | `200` — `{ event_id, user_id }` (approve → +`current_players`, notify user + admins, align turfmates) |
| POST | `/:event_id/requests/:user_id/reject` | **required, admin** | — | `200` — `{ event_id, user_id }` (decline) |
| POST | `/:event_id/admins` | **required, organizer** | `{ user_id }` | `200` — `{ event_id, user_id }` (grant admin → role `co_organizer`) |
| DELETE | `/:event_id/admins/:user_id` | **required, organizer** | — | `200` — `{ event_id, user_id }` (revoke admin → role `player`) |
| GET | `/my-events` | **required** | query `status?` | `200` — `{ events: [ { ...event, my_participation:{status,payment_status,joined_at} } ] }` |
| POST | `/create-event` | **required** | event fields + `current_players[]` + optional `booking_id` + optional `team_id` | `200` — created event (organizer = token user; initial roster inserted as `approved`; if `booking_id` given, links it both ways; if `team_id` given, tags the match with that team) |
| PATCH | `/update-event/:event_id` | **required, organizer only** | any editable fields (below) | `200` — updated event |
| POST | `/:event_id/rematch` | **required, match admin** | `{ event_date, start_time, end_time }` | `201` — new cloned event (prior squad re-invited as `invited`; each accepts/declines) |
| DELETE | `/delete-event` | **required, organizer only** | `{ event_id }` | `200` — **soft cancel** (status → `cancelled`, booking detached, squad notified `event_cancelled`; row is NOT deleted). Rejects a settled match (`EVENT_NOT_EDITABLE`) |
| GET | `/:event_id` | public | path `event_id` | `200` — full event DTO (incl. `booking` when one is attached) |
| GET | `/:event_id/messages` | **required, member** | — | `200` — `{ messages:[msgDTO] }` (last 50, oldest→newest; tombstones kept) |
| POST | `/:event_id/messages` | **required, member** | `{ content?, attachment_url?, reply_to_id?, message_type? }` | `201` — message DTO (fans out `chat:new`) |
| PATCH | `/:event_id/messages/:message_id` | **required, sender** | `{ content }` | `200` — edited DTO (`is_edited`; fans out `chat:update`) |
| DELETE | `/:event_id/messages/:message_id` | **required, sender or match admin** | — | `200` — `{ id }` (soft delete; fans out `chat:delete`) |
| POST | `/:event_id/messages/read` | **required, member** | — | `200` — `{ event_id }` (marks the squad chat read for the caller → clears its unread badge) |
| POST | `/:event_id/messages/:message_id/reactions` | **required, member** | `{ emoji }` | `200` — `{ message_id, reactions }` (toggles; fans out `chat:reaction`) |

**Edit a match (`PATCH /update-event/:id`)** — organizer only. Editable: `title`, `description`,
`sport_type`, `event_type`, `ground_id`, `venue_id`, `max_players`, `min_players`,
`skill_level_required`, `age_group`, `gender_preference`, `visibility`, `join_approval_required`,
`entry_fee`, `total_cost`, `cost_split_type`, `rules`, `what_to_bring`, and the schedule
(`event_date`, `start_time`, `end_time`). Not editable: `organizer_id` (no ownership transfer),
`current_players` (derived from the approved roster). Guards: a **completed/cancelled** match is locked
(`EVENT_NOT_EDITABLE`); `max_players` can't drop below the confirmed squad and `min` can't exceed
`max` (`INVALID_PLAYER_LIMITS`); money can't be negative.
**Re-attach a booking:** send `booking_id` — a uuid attaches that booking (must be the caller's, not
tied to another match; the match's ground/venue/date/slot are then **synced from the booking**);
`null`/`""` detaches the current one. Every edit fires a live `event:roster` refresh.

**Edit notifications — every change is announced.** Any field whose value actually changes produces an
`event_reminder` notification that *names what moved* ("the organizer updated the date, start time,
entry fee") and carries the raw column names in `data.changed` plus the tier in `data.high_impact`.
The tier decides priority and audience:

| Tier | Fields | Priority | Audience |
|---|---|---|---|
| **High impact** | schedule (`event_date`/`start_time`/`end_time`), `venue_id`, `ground_id`, booking attach/detach, `sport_type`, `event_type`, `entry_fee`, `total_cost`, `cost_split_type`, `min_players`, `max_players`, `skill_level_required`, `age_group`, `gender_preference`, `visibility`, `join_approval_required` | `eventPriorityByDate` — `urgent` today, `high` ≤3 days, else `medium` | approved squad **+ pending requesters** (`status: requested`) |
| **Cosmetic** | `title`, `description`, `rules`, `what_to_bring` | `low` | approved squad |

The acting organizer is excluded from their own edit. Pending requesters are included on high-impact
changes only — a fee/time/eligibility change is exactly what decides whether they still want in, but
copy edits shouldn't spam the request queue. Booking attach/detach reports as a single `booking`
change: confirmed slot vs. probable time matters even when the clock doesn't move. Schedule fields
count as changed whenever supplied (a `@db.Time` column vs. an `"HH:MM"` body string has no reliable
diff, and over-reporting the *time* is the safe direction). Per the bell/toast policy below, high and
urgent ones also toast; `low`/`medium` land in the bell only.

**Schedule rule (booking = source of truth for time):** a match's time is **either** driven by its
attached booking **or** a **probable** range the organizer set by hand when there's no booking.
- **`PATCH /update-event`:** `event_date`/`start_time`/`end_time` are only accepted when the match will
  have **no** booking after the edit — sending them on a match that stays booked returns
  `EVENT_SCHEDULE_LOCKED`. Attaching a booking syncs the time from it; detaching frees it to be edited.
- **`POST /create-event`:** with a `booking_id`, the time **and** venue/ground are derived from the
  booking (any `event_date`/`start_time`/`end_time`/`venue_id`/`ground_id` in the body are ignored);
  without a booking, those five are **required** and form the probable time.

The DTO exposes `schedule_confirmed` (`true` when a booking backs the time), and the feed rows carry
`booking_id` so cards can tag an unbacked time as "Probable".

**Rematch (`POST /:id/rematch`)** — the low-friction "play again" path. Clones the match into a **new**
event (organizer = caller, auto-joined as the only confirmed player), copying every setting **except**
the booking (a new session needs its own reservation). The prior squad (source organizer + approved
players, minus the caller) is inserted as **`invited`** rows and notified (`event_invitation`) to
confirm for the new date. A finished match is never mutated — reuse is a clone, so
chat/comments/ratings and organiser reputation stay intact.

**Invitation flow (invitee side)** — an `invited` row is the mirror image of a join request: the
organizer pulled the player in, so **the player decides**, not an admin. `POST /:id/invitation/accept`
flips their own row to `approved` (hard capacity check, +`current_players`, notifies admins + aligns
turfmates). `POST /:id/invitation/decline` **deletes** the invite row — leaving no participant row, so
the `joinEvent` "any row blocks" guard clears and the user is free to `POST /:id/join` later on their
own terms. `invited` rows never appear in the admin request queue (`/requests` filters `requested`) and
never consume a slot until accepted.

**Cancel a match (`DELETE /delete-event`)** — organizer-only, and a **soft cancel**, never a physical
delete: the match's status flips to `cancelled`, its booking is detached (the reservation itself is
kept — the organizer may have paid), and the approved squad is notified (`event_cancelled`). The row is
retained so chat/comments/payments/reviews and organiser reputation survive. A hard delete is neither
offered nor possible — `bookings`/`messages`/`payments`/`reviews` reference `events` with
`ON DELETE NO ACTION`. Cancelling a match already `completed`/`cancelled` is rejected
(`EVENT_NOT_EDITABLE`). Cancelled matches drop out of the ranked feed and `/nearby` (both filter
`open`/`ready`/`booked`), and `joinEvent` refuses new requests on a `cancelled`/`completed` match.

**Nearby matches (`GET /nearby`)** — upcoming, **public**, live (`open`/`ready`/`booked`) matches
within `radius` km of `lat`/`lng`, nearest first. Distance is a plain **haversine** on the turf's
coordinates (no PostGIS dependency — same math as the feed ranking); turfs without coordinates are
skipped (they can't exist for new turfs — geolocation is required at creation). Each row carries a
rounded `distance_km`.

**Feed ranking (`GET /`)** — the feed is always **recommended-ranked** (no sort param). Only
**upcoming, live** games are listed (`event_date >= today`, status `open`/`ready`/`booked`); the
filters (`sport`/`timeframe`/`q`/`openOnly`) narrow that set. Ordering is a weighted score
(`utils/eventRanking.js`), computed in SQL so pagination is correct across the infinite scroll; ties
break by soonest kickoff then id. Signals, highest weight first:

| signal | weight | needs |
| --- | --- | --- |
| nearby turf (haversine, 25 km ramp) | 28 | caller's saved home `lat/lng` (optional auth) |
| a turfmate is organising / joined | 22 | optional auth |
| soonest (14-day decay) | 18 | — |
| Friday/Saturday (BD weekend) | 12 | — |
| high-rated turf (`turfs.rating`) | 9 | — |
| popular turf (`total_bookings`, log) | 6 | — |
| experienced organiser (matches organised, log) | 5 | — |

Anonymous callers just lose the first two signals; the rest still rank. Location is read from the
user's stored home coordinates — **no GPS prompt**. Because ranking is server-side, no client sort UI
exists. **Turf geolocation is now required** on `POST /venues/create-venue` (valid `latitude`/`longitude`
in `address_line_1`) so every turf can participate in the nearby signal (`VALIDATION_ERROR` otherwise).

**Squad group chat (`/events/:event_id/messages`)** — private to the match's members
(**approved players + organizer/co-organizers**, same rule as `canCommentOnEvent`). Non-members get
`EVENT_CHAT_FORBIDDEN (403)` on read/write (unlike the public event **comments**). A message needs
**text OR an image attachment** (or both); `attachment_url` must be an `https` URL (from `/api/upload`
→ imgbb; images only). `reply_to_id` must point at a message in the same chat. Max text length 2000.

**Message DTO:**
```
{ id, event_id, content|null, attachment_url|null, message_type, is_edited, is_deleted,
  created_at, edited_at, sender:{id,first_name,last_name,profile_picture_url},
  reply_to: { id, sender_name, content } | null,
  reactions: [ { emoji, count, user_ids:[...] } ] }        // deleted msgs null content + empty reactions
```

**Schema additions** (run `npx prisma db push` + `npm run prisma:generate:pg`): `messages.reply_to_id`
(self-relation) and a new **`message_reactions`** table (`message_id`,`user_id`,`emoji`, unique per
person+emoji).

### Chat (`/chat`) — direct messages + unified conversation list

1:1 DMs reuse the shared `messages` table (`event_id` NULL, `recipient_id` set) — **no new tables**.
The navbar chat box lists **all** the caller's conversations: DM threads **and** the match/squad chats
they belong to.

| method | path | auth | body / params | success `data` |
| --- | --- | --- | --- | --- |
| GET | `/chat/conversations` | **required** | — | `200` — `{ conversations:[{ type:'dm'\|'match', id, title, avatar, sport_type?, unread, last_message:{content,created_at,from_me}\|null }], total_unread }` (activity-sorted) |
| GET | `/chat/dm/:user_id` | **required** | — | `200` — `{ user, messages:[dmDTO] }` (last 50, oldest→newest). Self → `SELF_MESSAGE_FORBIDDEN` |
| POST | `/chat/dm/:user_id` | **required** | `{ content?, attachment_url?, reply_to_id? }` | `201` — dmDTO (fans out `dm:new` to both parties). Self → `SELF_MESSAGE_FORBIDDEN`; empty → `VALIDATION_ERROR`; `reply_to_id` must be in the same thread |
| POST | `/chat/dm/:user_id/messages/:message_id/reactions` | **required, participant** | `{ emoji }` | `200` — `{ message_id, reactions }` (toggles; emits `dm:reaction` to both) |
| POST | `/chat/dm/:user_id/read` | **required** | — | `200` — `{ user_id, count }` (marks partner→me messages read; emits `dm:read`) |

- **A player cannot message themselves** — every DM route rejects `:user_id === caller` with
  `SELF_MESSAGE_FORBIDDEN (400)`; the profile "Message" button is also hidden on your own profile.
- **Conversations** = DM partners you've exchanged messages with (last message + unread count) merged
  with the events you're a member of (their last squad-chat message + **per-user unread**). A DM opened
  from a profile that has no history yet won't appear in the list until the first message is sent.
  `total_unread` sums both kinds.
- **Match-chat unread** is tracked per user via the **`event_chat_reads`** table (one row per
  `(user_id, event_id)`, `last_read_at`). A squad message is unread for a member when it was sent by
  someone else, after their marker (or they've never opened the chat). `POST
  /events/:id/messages/read` upserts the marker; the client calls it whenever the panel is open.
- **DM message DTO:** `{ id, recipient_id, content|null, attachment_url|null, message_type, is_edited,
  is_deleted, created_at, reply_to:{id,sender_name,content}|null,
  reactions:[{emoji,count,user_ids}], sender:{id,first_name,last_name,profile_picture_url} }`. DMs now
  support **replies and emoji reactions** (reusing `messages.reply_to_id` + `message_reactions`); no
  edits/deletes yet.
- **Realtime:** `dm:new` + `dm:reaction` (to both participants' user rooms) and `dm:read` (to the
  reader's own rooms), via the existing `emitToUser` socket channel.
- **Migration:** adds the **`event_chat_reads`** table only (run `npx prisma db push` +
  `npm run prisma:generate:pg`). DM replies/reactions need no schema change — `messages.reply_to_id`
  and `message_reactions` already existed.

**Socket events (Socket.IO)** — client connects to the server origin with `auth:{ token }`; each
socket auto-joins its `user:<id>` room. Additional match-page realtime:
- Client emits **`event:subscribe`** / **`event:unsubscribe`** with an `eventId` to join/leave that
  match's `event:<id>` room.
- Server emits **`event:roster`** `{ eventId }` to the event room on any roster/request change
  (join, accept, reject, cancel, leave) → clients refetch squad + join requests. Non-sensitive.
- Server emits **`chat:new`** (message DTO) / **`chat:update`** (edited DTO) / **`chat:delete`**
  `{ id, event_id }` / **`chat:reaction`** `{ message_id, event_id, reactions }` to each **member's**
  `user:<id>` room → the floating chat appends/updates/tombstones/re-reacts live (private; never
  broadcast to the event room).

**Attaching a booking (`booking_id` on `POST /create-event`)** — optional. Ties the match to a
ground reservation the organizer already made. The booking must be **the caller's own** and **not
already attached** to another event, else `BOOKING_NOT_FOUND` / `VALIDATION_ERROR` /
`BOOKING_ALREADY_ATTACHED (409)`. On success the link is written **both ways** in one transaction:
`events.booking_id` → the reservation, `bookings.event_id` → the match. (Booking-side attach still
works too, via `event_id` on `POST /bookings` — same organizer-owns-event rule.)

**`GET /events/:event_id` `booking` field** — present only when a booking is attached:
```
booking: {
  id, booking_date, slot:{code,start_time,end_time},
  total_amount, discount_amount, final_amount,
  payment_status, booking_status,
  hold_expires_at   // ISO string ONLY while it's an unpaid pending hold (from slot_locks); else null
}
```
The detail page renders this as a "Reserved ground" card with a **live hold countdown** when
`hold_expires_at` is set.

**`GET /events/:event_id` `participants` + `organizer`** — the roster rows carry
`{ id, user_id, status, role, joined_at, users }`, and on this detail read each `users`
(and the `organizer`) also embeds public profile extras: `district`, `division` (home area) and
flattened player stats (`skill_level`, `total_games_played`, `rating`, sourced from
`player_profiles`). The squad list (`EventSquad` → `PlayerItem`) uses these to show a **role badge**
(Organizer/Admin), a **join date**, and at-a-glance skill/games chips. The organizer is synthesized
as an `organizer` role row (they have no `event_participants` row).

**`GET /events` is a paginated, filterable feed** (powers the infinite-scroll `/events` page):

- **Query params (all optional):** `page` (1-based, default 1), `limit` (1–50, default 12),
  `sport` (exact `sport_type`, `"all"` = any), `timeframe` (`all` | `today` | `week` | `month`,
  filters `event_date` forward), `q` (search — matches event title or turf name, case-insensitive),
  `openOnly` (`"true"` = only events still short of `min_players`),
  `joinedOnly` (`"true"` = only matches the **authenticated** caller is already involved in —
  organiser or any participant row; no-op for anonymous callers).
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
- **My-role highlight:** on an authenticated request each event also carries
  `my_role` (`"organizer"` | `"co_organizer"` | `"player"` | `null`) — the caller's own
  relationship to the match. The feed card badges organiser/admin matches and adds a stronger
  ring. The `joinedOnly` filter keeps only events where `my_role` is non-`null`.
- `stats` (global, unfiltered) is returned only on `page === 1` to save queries; the frontend
  caches it for the hero + sport chips. `openOnly` uses a Prisma **field reference**
  (`min_players > current_players`).
- Frontend: `useGetEventsQuery({page,limit,sport,timeframe,q,openOnly,joinedOnly})` accumulates pages via
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

> **Two directions, two statuses.** A **request** (`requested`) is player→match, decided by an admin
> (accept/reject above). An **invitation** (`invited`) is match→player, decided by the invitee
> (`/invitation/accept` | `/invitation/decline`). They never mix: the admin queue shows only
> `requested`; accepting either path lands on `approved`. Decline **deletes** the invite so a later
> self-initiated request is still possible.

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

Score is `mutual * 10 + areaScore + completionBoost(candidate, profile, 3)`. The completeness term is
capped at **3**, not the default 10 used by scouting: for a *social* suggestion a mutual turfmate is
the far stronger signal, so completeness only breaks ties between otherwise-equal candidates. The
scoring query reads `phone`, `date_of_birth`, `gender` and the player profile purely to compute that
term — all four are **stripped before the response**, so the recommendation DTO keeps the exact
public shape it always had.

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

### Teams (`/teams`)

All routes require `Authorization: Bearer` — teams have **no public read surface** in this pass.
Backed by the PostgreSQL `teams` / `team_members` / `team_invites` models.

A team is a **persistent squad**: the durable counterpart to a single match's approved roster.
It is strictly **additive** — an ad-hoc, teamless match behaves exactly as it always has. A team
is an optional organizing layer on top of `events` (`events.team_id`), never a replacement for it.

**Roles.** `captain` (one per team, mirrored on `teams.captain_id`) can do everything;
`co_captain` can send and cancel invites; `member` is roster-only and may leave.

| method | path | body / query | success `data` |
| --- | --- | --- | --- |
| GET | `/sports` | — | `200` — `{ sports:[{id,name,category,icon_url,team_size_min,team_size_max,sport_positions:[…]}] }` (cached reference data) |
| POST | `/` | `{ name, sport_id, home_area?, crest_url?, description? }` | `201` — team + `my_role: "captain"` |
| GET | `/my-teams` | `page?`, `limit?` | `200` — `{ teams:[{…team, member_count, my_role}], pagination }` |
| GET | `/my-invites` | `page?`, `limit?` | `200` — `{ invites:[{inviteId,message,created_at,team,invited_by}], pagination }` |
| GET | `/:teamId` | — | `200` — team + `members:[TeamMember]` + `member_count` + `my_role` (`null` for non-members) |
| PATCH | `/:teamId` | **captain** — `{ name?, home_area?, crest_url?, description?, sport_id? }` | `200` — updated team |
| DELETE | `/:teamId` | **captain** | `200` — `{ teamId }` (**soft** delete, `is_active: false`) |
| GET | `/:teamId/events` | `page?`, `limit?` | `200` — `{ events, pagination }` (matches with `team_id = :teamId`) |
| POST | `/:teamId/invites` | **captain/co-captain** — `{ invitedUserId, message? }` | `201` — created invite |
| GET | `/:teamId/invites` | **captain/co-captain** — `page?`, `limit?` | `200` — `{ invites:[{inviteId,message,created_at,user,invited_by}], pagination }` |
| POST | `/invites/:inviteId/accept` | **invited player** | `200` — the new `team_members` row |
| POST | `/invites/:inviteId/decline` | **invited player** | `200` — invite (status `declined`) |
| POST | `/invites/:inviteId/cancel` | **captain/co-captain** | `200` — invite (status `cancelled`) |
| PATCH | `/:teamId/members/:userId` | **captain** — `{ role?, position_id? }` | `200` — updated `TeamMember` |
| POST | `/:teamId/transfer-captaincy` | **captain** — `{ newCaptainId }` | `200` — `{ teamId, captain_id }` |
| DELETE | `/:teamId/members/:userId` | **captain** (anyone but self) **or the member themself** | `200` — member row (status `removed` or `left`) |

**Production hardening (this pass):**
- **Atomic invite creation** — relies on `@@unique(team_id, invited_user_id)` and catches Prisma
  `P2002` rather than a racy check-then-create (same pattern as turfmate requests). On a duplicate
  the existing row is inspected: still `pending` → `409 TEAM_INVITE_ALREADY_EXISTS`;
  `declined`/`cancelled` → **revived** to `pending` via a status-scoped `updateMany`, so a "no" last
  month doesn't lock a player out forever, and two concurrent invites can't both win and double-notify.
- **Transactional multi-row writes** — team+captain-row on create, roster-row+invite-status on accept,
  and the three writes of transfer-captaincy. A team can never end up with two captains, or none, or a
  captain who isn't on its own roster.
- **Nothing is hard-deleted.** Disbanding a team sets `is_active: false`; leaving/removal sets
  `team_members.status` to `left`/`removed` plus `left_at`. Matches referencing a team must stay readable
  (`events.team_id` is `ON DELETE SET NULL`).
- **Server-side authorization on every write** (`utils/teamService.js` — one place, so "who may do what"
  can't drift between endpoints). The frontend's captain-only UI gating is a UX nicety, **not** the boundary.
- **Rate limiting** — `teamWriteLimiter` (20/min per user) on every team write. An invite pushes a
  high-priority notification to someone else's bell, so an unbounded loop is a spam vector.
- **UUID screening** — path params (`validateUuidParams`, `middlewares/validateUuid.middleware.js`) and
  body ids (`isUuid`) are checked before Prisma sees them. A malformed id raises Prisma `P2023`, which
  the terminal `errorHandler` would otherwise serialize as a **500 carrying the raw Prisma code**;
  it now returns a clean `400 VALIDATION_ERROR` and skips the database round-trip. Auth still runs
  first, so an unauthenticated caller gets `401` and learns nothing about id shapes.
- **`position_id` is validated against the team's sport**, and `sport_id` can only change while the
  captain is still alone on the roster with no positions assigned — otherwise positions would point at
  another sport's rows.

**Notifications** (all via `notificationService.createNotification()` — no parallel path):

| type | priority | to | when |
| --- | --- | --- | --- |
| `team_invite` | `high` | invited player | invite created |
| `team_invite_accepted` | `medium` | captain + co-captains (not the joiner) | invite accepted |
| `team_member_removed` | `medium` | removed player | captain removes them (**not** on self-leave) |
| `team_captaincy_transferred` | `high` / `medium` | new captain / old captain | transfer |

**Errors:** `VALIDATION_ERROR`, `TEAM_NOT_FOUND`, `NOT_TEAM_CAPTAIN`, `NOT_TEAM_MEMBER`,
`ALREADY_TEAM_MEMBER`, `TEAM_INVITE_ALREADY_EXISTS`, `TEAM_INVITE_NOT_FOUND`, `CANNOT_REMOVE_CAPTAIN`,
`CANNOT_INVITE_SELF`, `USER_NOT_FOUND`, `RATE_LIMITED`, `UNAUTHORIZED`/`INVALID_TOKEN`.

**Team-organized matches:** `POST /events/create-event` accepts an optional `team_id`. The caller must be
an **active member** of that team (any role) or it fails with `NOT_TEAM_MEMBER`. It is purely an
organizing tag — the event's join/invite/roster/rematch flow is **unchanged**, and the team roster is
**not** auto-invited (a reasonable fast-follow, deliberately out of scope here; see the `TODO` in
`createEvent`).

**Out of scope this pass** (future work, not built): league/table standings, team-vs-team challenge
matchmaking, a team chat separate from event chat, team payments/wallets.

Frontend hooks: `useGetSportsCatalogueQuery`, `useGetMyTeamsQuery`, `useGetTeamByIdQuery`,
`useCreateTeamMutation`, `useUpdateTeamMutation`, `useDeleteTeamMutation`, `useGetTeamEventsQuery`,
`useGetMyTeamInvitesQuery`, `useGetTeamInvitesQuery`, `useSendTeamInviteMutation`,
`useAcceptTeamInviteMutation`, `useDeclineTeamInviteMutation`, `useCancelTeamInviteMutation`,
`useUpdateTeamMemberMutation`, `useRemoveTeamMemberMutation`, `useTransferCaptaincyMutation`.
Pages: `/teams` (my teams + incoming invites), `/teams/create`, `/teams/[teamId]`.

> **Schema migration required:** this pass adds the `teams`, `team_members` and `team_invites` models,
> the `team_member_role` / `team_member_status` / `team_invite_status` enums, four new
> `notification_type` values (`team_invite`, `team_invite_accepted`, `team_member_removed`,
> `team_captaincy_transferred`), and an optional `events.team_id` column. Run
> `npm run prisma:push:pgsql` **and** `npm run prisma:generate:pg` from `backend-engine/backend/`
> before starting the API. Additive only — no existing column changes type or becomes non-nullable, so
> there is no backfill. The deprecated MongoDB schema is untouched.

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

**`notification_type` enum** also carries the four team values — `team_invite`,
`team_invite_accepted`, `team_member_removed`, `team_captaincy_transferred` (see Teams).

**`notification_type` enum** includes `event_completed` (added for the sweeper): when the event
sweeper auto-completes a finished game it sends this to the organizer + every approved participant
(`action_url` = `/events/:id`). Adding the enum value needs `prisma db push` + client regen.

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
