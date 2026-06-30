# CLAUDE.md

## Project

FunTurf — turf (sports ground) booking and game-organizing platform. This repo currently holds the **backend only**: an Express REST API (`/api/v1`) backed by Prisma, deployed as 3 replicas behind Nginx. All app code lives in `backend/`.

## About The Platform
Many people in Bangladesh uses turfs for playing sports. Specially in crowded cities where fields are rarely available to play sports. Dhaka, Chittagong, Rajshahi. 

## Commands

Run all of these from `backend/`.

```bash
npm run dev                  # start API with nodemon + dotenv (port 8080)

# Prisma (two separate datasources — see Architecture)
npm run prisma:generate      # regenerate BOTH clients (pg + mongo) — run after any schema edit
npm run prisma:generate:pg   # PostgreSQL client only
npm run prisma:generate:mongo
npm run prisma:migrate       # migrate dev against PostgreSQL schema
npm run prisma:push:mongo    # db push the MongoDB schema
```

There is **no test runner, linter, or build step** configured. Formatting is Prettier (`.prettierrc`).

### Docker / local cluster

`docker-compose.yml` (run from repo root) brings up postgres + 3 backend replicas (`app1/2/3`) + nginx. Prisma against the dockerized DB (`docker_commands.txt`):

```bash
docker compose run --rm app1 npx prisma generate --schema=prisma/postgresql/schema.prisma
docker compose run --rm app1 npx prisma db pull --schema=prisma/postgresql/schema.prisma
docker compose up -d
```

Postgres is exposed to the host at `127.0.0.1:8000`; nginx serves on port 80.

## Architecture

### Prisma datasource

**Use `pgClient` only.** `mongoClient` is deprecated — do not write new code against it, and prefer migrating any remaining usage to `pgClient`.

- **PostgreSQL (active)** — `prisma/postgresql/schema.prisma` → generated to `src/generated/prisma/pg/`, exported as `pgClient` from `src/prisma.js`. The authoritative domain model (~30 models, ~55 enums: users, venues, grounds, bookings, slots, payments, promotions, reviews, events, connections, wallets, …).
- **MongoDB (deprecated)** — `prisma/mongodb/schema.prisma` → `src/generated/prisma/mongo/`, exported as `mongoClient`. Still referenced by `user.controller.js` and `turfmate.controller.js`; treat as legacy.

Clients are singletons in `src/prisma.js`. `src/generated/` is committed and contains Windows query engine binaries; regenerate with the prisma scripts rather than hand-editing.

### Request flow

`src/index.js` (listen + `/health`) → `src/app.js` (express setup, CORS, route mounting, `errorHandler` last) → `routes/` → `middlewares/` → `controllers/`.

Route mounts (`app.js`): `/api/v1/{users, turfmates, events, venues, bookings}`.

### Conventions

- **Async controllers** wrap their body in `asyncHandler` (`utils/asyncHandler.js`) so thrown errors reach `next()`. Don't add manual try/catch for error forwarding.
- **Errors**: throw `new ApiError(statusCode, message, errors?)` (`utils/apiError.js`). The terminal `errorHandler` middleware (`utils/errorHandler.js`) serializes them; never write your own error response in a controller.
- **Success responses**: construct `new ApiResponse(statusCode, message, data)` (`utils/apiResponse.js`).
- **Auth**: `verifyJWT` (`middlewares/auth/auth.middleware.js`) reads a `Bearer` token from the `Authorization` header, verifies with `ACCESS_TOKEN_SECRET`, and sets `req.user = { id, email, ... }`. Apply it per-route in the route file (routes are public unless they add it).
- **Caching**: `utils/cache.js` exports a shared `node-cache` instance (`stdTTL 1000s`). Used for user/auth lookups.
- **DTO shaping**: `utils/dataSerializer.js` (e.g. `VenueSerializer`) converts Prisma rows to API DTOs before responding.
- **File uploads**: `multer` middleware (`middlewares/file-upload/`) + Cloudinary (`utils/mediaUpload.js`).
- **Time/slots**: `utils/timeAndDateFormatting.js` and `middlewares/venue/booking.middleware.js` back slot-availability/pricing logic.

### Layout

Routes, controllers, and middlewares are grouped by domain folder (`auth/`, `event/`, `venue/`, `user/` ~ `user-connection/`). A new endpoint = add to the matching `routes/<domain>/*.route.js`, implement in `controllers/<domain>/*.controller.js`, mount in `app.js` if it's a new resource.

## Deployment

`render.yaml` deploys to Render: an nginx web service (`rootDir: ./nginx`) fronting three identical backend web services (`app1/2/3`, `rootDir: ./backend`), each built from its Dockerfile. Backend listens on `0.0.0.0:8080` and exposes `/health`.

## Notes & data model reference

- `funturf-schema.md`, `postgresql-turf-schema.sql`, and `request-handling.md` (repo root) document the intended data model and request handling in depth — consult them before large schema or flow changes.
- CORS is currently wide open (`origin: '*'`) in `app.js`; the intended whitelist (localhost + Vercel frontend) is commented out.
- Work lands on `main` via PRs (typically from `test-api`/feature branches); active dev branch is `dev`.
