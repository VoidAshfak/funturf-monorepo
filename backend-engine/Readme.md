# FunTurf — Backend Engine

Express + Prisma REST API for FunTurf, with a Socket.IO real-time layer.

> **Docker command reference, local-database setup and pgAdmin:** see
> [`docs/DOCKER_GUIDE.md`](../docs/DOCKER_GUIDE.md) at the umbrella repo root.

Two ways to run it, for two different jobs:

| | **Host dev** | **Local cluster** |
|---|---|---|
| Command | `npm run dev` (from `backend/`) | `docker compose up -d --build` (from here) |
| Topology | 1 process | nginx → 3 replicas + redis + postgres |
| Reload | nodemon, instant | rebuild required |
| Use it for | writing code | testing anything multi-replica |

---

## Layout

```
backend-engine/
├── backend/            # the API. package.json + npm scripts live HERE, not at this level
│   ├── Dockerfile      # the production image — used by both compose and Render
│   ├── .env            # gitignored. copy from .env.example
│   └── src/
├── nginx/              # LOCAL-ONLY edge proxy. not deployed.
│   ├── Dockerfile
│   ├── nginx.conf
│   └── proxy_common.conf   # shared forwarded headers — read its header comment
├── docker-compose.yml  # the local cluster
└── render.yaml         # production blueprint (one API service + redis)
```

---

## Local development

### First run

```bash
cd backend
cp .env.example .env      # then fill it in — see the comments in that file
npm install
npm run prisma:generate   # REQUIRED: src/generated/ is gitignored, so a fresh
                          # clone has no Prisma client and src/prisma.js will crash
npm run dev               # http://localhost:8080
```

API docs (Swagger UI): http://localhost:8080/api/v1/docs — hidden when `NODE_ENV=production` unless `DOCS_ENABLED=true`.

Socket.IO runs on the in-memory adapter here and logs a warning about it. That is correct for one process.

### The cluster

Reproduces production's multi-replica shape, so replica-unsafe bugs surface locally.

```bash
docker compose up -d --build         # http://localhost (port 80, via nginx)
docker compose logs -f               # all services
docker compose logs -f app1          # one replica
docker compose ps                    # health of each container
docker compose down                  # stop. -v also wipes the postgres volume
```

Ports: **nginx :80** · **postgres 127.0.0.1:8000** · redis and the replicas are unpublished by design.

Env is read from `backend/.env` — the same file `npm run dev` uses, so the two can't drift. Compose only overrides `REDIS_URL` (the hostname `redis` exists only inside the cluster).

**Code changes need `docker compose up -d --build`.** The replicas run the production image — plain `node`, no nodemon — deliberately: this cluster tests the real artifact. Iterate with `npm run dev` instead.

#### Using the local postgres

It's idle by default — `POSTGRESQL_DATABASE_URL` points at hosted Aiven. To switch:

1. In `backend/.env`, comment the Aiven URL and uncomment the `@db:5432` one.
2. `docker compose up -d`
3. `docker compose exec app1 npx prisma db push --schema=prisma/postgresql/schema.prisma`

Credentials come from `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`. The postgres image only reads them when it **initialises the volume** — changing them later does nothing until `docker compose down -v`.

#### Editing nginx

Config is bind-mounted, so no rebuild:

```bash
docker compose exec nginx nginx -t          # validate FIRST — a bad config kills the reload
docker compose exec nginx nginx -s reload
```

Two things in there are load-bearing:

- **Sticky sessions** (`hash $remote_addr consistent`) — a Socket.IO connection begins as several HTTP polling requests that must all hit the same replica; the handshake `sid` only exists on the one that issued it. Round-robin ⇒ "Session ID unknown" reconnect loops.
- **`proxy_common.conf`** — `proxy_set_header` *replaces* rather than merges across levels, so a location that sets any header of its own loses every inherited one, silently. Every proxying location `include`s this file. Add forwarded headers there, never in one location.

#### Debugging the cluster

```bash
curl localhost/nginx-health   # nginx itself   (200 here + 502 on /health = all replicas down)
curl localhost/health         # proxied to a replica — reports the APP
docker compose exec funturf-redis redis-cli PUBSUB CHANNELS   # 3 response channels = all replicas on the backplane
docker logs funturf-nginx                                     # access log includes upstream= (which replica served it)
```

---

## Production (Render)

`render.yaml` declares **one** Docker web service + a managed Key Value (Redis) instance. Render terminates TLS and load-balances at its own edge, which is why **nginx is not deployed** — a self-managed proxy there would add a hop and duplicate what the platform already does.

```
Internet → Render edge (TLS, LB) → funturf-api  ⇄  funturf-keyvalue (Socket.IO backplane)
                                        ↓
                                   Aiven PostgreSQL
```

### Deploying

1. Push to `main`. Render syncs the blueprint automatically (`autoDeploy: true`).
2. First sync only: set every `sync: false` secret in the Render dashboard (`POSTGRESQL_DATABASE_URL`, `MONGO_DATABASE_URL`, the four token vars, the two Cloudinary keys). The service will not boot without them.
3. Watch the deploy log. Render will not shift traffic until `/health` returns 200, so a broken build leaves the old instance serving.

### Scaling

Uncomment `numInstances` (paid plan). Nothing else changes — the Redis adapter is already wired, which is exactly why it's there on a single instance today.

### Things that will bite you

- **Region lock**: the API and the Key Value instance must share a region (`singapore`). Cross-region private networking doesn't resolve.
- **Build context is `./backend`** — anything outside it doesn't exist at build time. That's why `docs/openapi.yaml` lives under `backend/`.
- **Free tier spins down** after ~15 min idle; the next request pays a cold start.
- **`DOCS_ENABLED=false`** in production on purpose: a full endpoint/param/error-code inventory is free reconnaissance.
- **Secrets never go in `render.yaml`.** `sync: false` means "prompt me, keep it out of git".
