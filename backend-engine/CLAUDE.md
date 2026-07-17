## Project

FunTurf — turf (sports ground) booking and game-organizing platform. This repo currently holds the **backend only**: an Express REST API (`/api/v1`) backed by Prisma, deployed as 3 replicas behind Nginx. All app code lives in `backend/`.

## Commands

Run all of these from `backend/`.

```bash
npm run dev                  # start API with nodemon + dotenv (port 8080)
npm run dev:docs             # same, but forces Swagger UI on at /api/v1/docs

# Prisma (two separate datasources — see Architecture)
npm run prisma:generate      # regenerate BOTH clients (pg + mongo) — run after any schema edit
npm run prisma:generate:pg   # PostgreSQL client only
npm run prisma:generate:mongo
npm run prisma:migrate       # migrate dev against PostgreSQL schema
npm run prisma:push:mongo    # db push the MongoDB schema
```

There is **no test runner, linter, or build step** configured. Formatting is Prettier (`.prettierrc`).

### Docker / local cluster

> Full command reference, local-DB switching and pgAdmin setup: **`docs/DOCKER_GUIDE.md`** (umbrella root, one level above `backend-engine/`).

`docker-compose.yml` (run from `backend-engine/`) brings up postgres + redis + 3 backend replicas (`app1/2/3`) + nginx. It exists to reproduce **multi-replica** behaviour locally — anything replica-unsafe (in-process socket state, in-process caches, the `src/jobs/` sweepers) breaks here rather than in production.

```bash
docker compose up -d --build   # build + start the cluster
docker compose logs -f app1    # follow one replica (winston logs to stdout)
docker compose down            # stop; add -v to also wipe the postgres volume
```

- nginx serves on **:80**, postgres on **127.0.0.1:8000**, redis is not published to the host.
- Env comes from `backend/.env` — the **same file** `npm run dev` uses. See `backend/.env.example`.
- Replicas run the production image (plain `node`, no nodemon), so **code changes need `up -d --build`**. For a fast edit-reload loop use `npm run dev` on the host instead.
- The postgres container is **idle by default**: `POSTGRESQL_DATABASE_URL` points at hosted Aiven. To use it, switch to the `@db:5432` URL commented in `.env`, then `docker compose exec app1 npx prisma db push --schema=prisma/postgresql/schema.prisma`.
- nginx config edits don't need a rebuild (it's bind-mounted): `docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload`.

**nginx is local-only.** It is not deployed — Render terminates TLS and load-balances at its own edge. Two things in `nginx/nginx.conf` are load-bearing and easy to break:
- **Sticky sessions** (`hash $remote_addr consistent`) — Socket.IO's polling handshake must reach the same replica every time, or clients reconnect-loop on "Session ID unknown".
- **The forwarded-header snippet** (`nginx/proxy_common.conf`) — `proxy_set_header` *replaces* rather than merges across levels, so every proxying location must `include` it. Read that file's header before editing.

### Real-time / Socket.IO scaling

`src/socket.js` attaches `@socket.io/redis-adapter` when `REDIS_URL` is set, so an `emitToUser()` on one replica reaches a socket held by another. Unset (host dev) it falls back to the in-memory adapter and logs a warning — correct for a single process, silently lossy for more than one. Sticky sessions do **not** replace this; both are required.



### Prisma datasource

**Use `pgClient` only.** `mongoClient` is deprecated — do not write new code against it, and prefer migrating any remaining usage to `pgClient`.

- **PostgreSQL (active)** — `prisma/postgresql/schema.prisma` → generated to `src/generated/prisma/pg/`, exported as `pgClient` from `src/prisma.js`. The authoritative domain model (~27 models, ~35 enums: users, venues, grounds, bookings, slots, payments, promotions, reviews, events, connections, wallets, …).
- **MongoDB (deprecated)** — `prisma/mongodb/schema.prisma` → `src/generated/prisma/mongo/`, exported as `mongoClient`. Still referenced by `user.controller.js` and `turfmate.controller.js`; treat as legacy.

Clients are singletons in `src/prisma.js`. `src/generated/` is **not** committed — it's absent on a fresh clone, so run `npm run prisma:generate` before `npm run dev` or the `prisma.js` client imports crash. Never hand-edit the generated output; regenerate with the prisma scripts.

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
- **API docs**: Swagger UI at `/api/v1/docs`, raw spec at `/api/v1/docs.json`, mounted by `utils/swagger.js`. The spec is the **hand-written** `backend/docs/openapi.yaml` — nothing generates it, so **edit it in the same change as the route**. It must stay under `backend/` (the Docker build context). Docs are off when `NODE_ENV=production` unless `DOCS_ENABLED=true`; note the local `.env` already sets `NODE_ENV=production`, so use `DOCS_ENABLED=true npm run dev` to see them.
- 


### Layout

Routes, controllers, and middlewares are grouped by domain folder (`auth/`, `event/`, `venue/`, `user/` ~ `user-connection/`). A new endpoint = add to the matching `routes/<domain>/*.route.js`, implement in `controllers/<domain>/*.controller.js`, mount in `app.js` if it's a new resource.

## Deployment

`render.yaml` deploys **one** Docker web service (`funturf-api`, `rootDir: ./backend`) plus a managed Key Value/Redis instance (`funturf-keyvalue`) for the Socket.IO backplane. Region `singapore` (closest to Dhaka); both services must share it. The app listens on `0.0.0.0:8080` and Render gates deploys on `healthCheckPath: /health`.

No nginx in production, and no hand-cloned `app1/2/3`: Render already load-balances across instances of a single service. Scale by uncommenting `numInstances` (paid plan) — the Redis adapter is already wired for that.

Secrets are `sync: false` (set once in the Render dashboard, never in git). Non-secret config (`PORT`, `NODE_ENV`, `CORS_ORIGINS`, `DOCS_ENABLED`, `APP_TZ_OFFSET_MINUTES`) is declared inline.

Build context is `./backend`, so **anything outside `backend/` does not exist at build time** — that's why `docs/openapi.yaml` must stay under `backend/`.

## Notes & data model reference

- The authoritative data model lives in `backend/prisma/postgresql/schema.prisma` — consult it before large schema or flow changes.
- CORS is currently wide open (`origin: '*'`) in `app.js`; the intended whitelist (localhost + Vercel frontend) is commented out.
- Work lands on `main` via PRs (typically from `test-api`/feature branches); active dev branch is `dev`.


# Additional Instructions

- Always use best practices convention
- Write comments
- Each change should reflect on the website (Real-Time)
- keep an api documentation in the repo-root `docs/api-guideline.md` file (umbrella root, one level above `backend-engine/`)
- Use centralized error codes