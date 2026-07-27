# Route Cache Tracking

Each cached route records: **cache key pattern**, **TTL**, **controller**, and **cache-busting triggers**.

## Venues (`/api/v1/venues`)

| Route | Cache Key | TTL | Controller | Bust On |
|---|---|---|---|---|
| `GET /venues/list` | `venue:names` | 300s (env: `CACHE_TTL_VENUE_NAMES`) | `getVenueList` | `updateVenue` |
| `GET /venues` | `venue:list` | 300s (env: `CACHE_TTL_VENUE_LIST`) | `getVenues` | `updateVenue`, `rateTurf` |
| `GET /venues/:venue_id` | `venue:{venue_id}` | 300s (env: `CACHE_TTL_VENUE_DETAIL`) | `getVenueById` | `updateVenue`, `rateTurf` |
| `GET /venues/get-venues-by-admin/:admin_id` | `venue:admin:{admin_id}` | 120s (env: `CACHE_TTL_ADMIN_VENUES`) | `getVenueByAdminId` | `updateVenue` |

## Events (`/api/v1/events`)

| Route | Cache Key | TTL | Controller | Bust On |
|---|---|---|---|---|
| `GET /events` | `events:feed:{page}:{limit}:{sport}:{timeframe}:{q}:{openOnly}:{joinedOnly}:{userId}` | 120s (env: `CACHE_TTL_EVENTS_FEED`) | `getEvents` | — |
| `GET /events/:event_id` | `event:{event_id}` | 300s (env: `CACHE_TTL_EVENT_DETAIL`) | `getEventById` | — |

## Users (`/api/v1/users`)

| Route | Cache Key | TTL | Controller | Bust On |
|---|---|---|---|---|
| `GET /users/:user_id` | `user:profile:{user_id}` | 300s (env: `CACHE_TTL_USER_PROFILE`) | `getUserById` | — |

## TTL Config Reference

| Env Var | Default | Used By |
|---|---|---|
| `CACHE_TTL_VENUE_NAMES` | 300 | `venue:names` |
| `CACHE_TTL_VENUE_LIST` | 300 | `venue:list` |
| `CACHE_TTL_VENUE_DETAIL` | 300 | `venue:{venue_id}` |
| `CACHE_TTL_ADMIN_VENUES` | 120 | `venue:admin:{admin_id}` |
| `CACHE_TTL_EVENTS_FEED` | 120 | `events:feed:*` |
| `CACHE_TTL_EVENT_DETAIL` | 300 | `event:{event_id}` |
| `CACHE_TTL_USER_PROFILE` | 300 | `user:profile:{user_id}` |
