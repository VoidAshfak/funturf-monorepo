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
| POST | `/register` | public | `{ first_name, last_name, email, password_hash, phone?, date_of_birth?, gender?, profile_picture_url?, bio?, sports?, user_type? }` | `201` — user fields + `accessToken`, `refreshToken`, `tokenExpiresIn` |
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
| GET | `/` | public | query `page?`, `limit?`, `sport?`, `timeframe?`, `q?`, `openOnly?` | `200` — `{ events, pagination, stats? }` (paginated feed) |
| GET | `/my-events` | **required** | query `status?` | `200` — `{ events: [ { ...event, my_participation:{status,payment_status,joined_at} } ] }` |
| POST | `/create-event` | **required** | event fields + `current_players[]` | `200` — created event (organizer = token user) |
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
- `stats` (global, unfiltered) is returned only on `page === 1` to save queries; the frontend
  caches it for the hero + sport chips. `openOnly` uses a Prisma **field reference**
  (`min_players > current_players`).
- Frontend: `useGetEventsQuery({page,limit,sport,timeframe,q,openOnly})` accumulates pages via
  RTK Query `merge` (cache key excludes `page`); the server component pre-fetches `page 1` only
  for `stats`.

**Auth changes:** create/update/delete now require `Authorization: Bearer`. Organizer identity
is taken from the token on create (client no longer sends `organizer_id`); `organizer_id` is not
editable. Update/delete enforce organizer ownership.

**Route ordering:** static paths (`/my-events`) are declared before the dynamic `/:event_id`.

**Errors:** `VALIDATION_ERROR`, `BAD_REQUEST` (missing id), `EVENT_NOT_FOUND`,
`NOT_EVENT_ORGANIZER` (edit/delete by non-owner), `UNAUTHORIZED`/`INVALID_TOKEN`.

> `GET /events/nearby` (geo-search) is implemented in the controller but **not routed** —
> it needs PostGIS + verified status enums. Do not rely on it yet.

### Bookings (`/bookings`)

| method | path | auth | query | success `data` |
| --- | --- | --- | --- | --- |
| GET | `/available-slots` | public | `ground`, `date` (YYYY-MM-DD) | `200` — slot availability row for that ground/date |
| GET | `/quote` | public | `ground_id`, `slot`, `booking_date`, `promo_code?` | `200` — `{ isAvailable, slot, booking_date, base_rate, discount, final_price, is_peak, is_weekend, promotion }` |

**Errors:** `VALIDATION_ERROR` (missing query params — was wrongly a 405/500),
`SLOT_NOT_FOUND`, `SLOT_UNAVAILABLE` (409, slot already booked), `GROUND_NOT_FOUND`.

Frontend hooks: `useGetAvailableSlotsQuery`, `useGetBookingQuoteQuery`.

> `POST /bookings/create` is a stub (`createBooking` is empty) and **not routed**. Booking
> creation is not implemented yet.

### Turfmates (`/turfmates`)

All routes require `Authorization: Bearer`. Backed by the PostgreSQL `connections`
model (migrated off the deprecated mongoClient). A "turfmate" is an **accepted** connection.

| method | path | body / query | success `data` |
| --- | --- | --- | --- |
| POST | `/turfmate-request` | `{ receiverId }` | `201` — created pending connection |
| GET | `/get-pending-requests` | — | `200` — incoming pending requests (with requester profile) |
| POST | `/accept-turfmate-request` | `{ requestId }` | `200` — accepted connection |
| GET | `/get-turfmates` | — | `200` — array of turfmate **user ids** |
| GET | `/get-mutual-turfmates` | query `userTwo` | `200` — array of mutual turfmate ids |

**Errors:** `VALIDATION_ERROR` (missing `receiverId`/`requestId`/`userTwo`),
`CANNOT_CONNECT_SELF`, `USER_NOT_FOUND` (receiver), `CONNECTION_ALREADY_EXISTS`
(request/connection already exists in either direction), `CONNECTION_NOT_FOUND`
(accept a non-pending/foreign request), `UNAUTHORIZED`/`INVALID_TOKEN`.

Frontend hooks: `useSendTurfmateRequestMutation`, `useGetTurfmateRequestsQuery`,
`useAcceptTurfmateRequestMutation`, `useGetTurfmatesQuery`, `useGetMutualTurfmatesQuery`.

**Behaviour note:** `get-mutual-turfmates` was changed from reading a request body to a
`userTwo` **query param** (GET requests carry no body).
