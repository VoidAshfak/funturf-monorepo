# FunTurf Docker Guide

Everything you need to run the containerised backend cluster, plus how to point pgAdmin at a
database.

> **You do not need Docker for day-to-day development.** Run `npm run dev` in
> `backend-engine/backend/` and `frontend-engine/` and ignore this file. Docker exists here for
> one job: rehearsing the **multi-replica** production shape before you deploy, so that bugs
> which only appear with more than one server instance surface on your laptop instead of in
> front of users.

All `docker compose` commands run from **`backend-engine/`** unless stated otherwise.

---

## Contents

- [When to use which setup](#when-to-use-which-setup)
- [What the cluster is](#what-the-cluster-is)
- [Command reference](#command-reference)
- [The local database](#the-local-database)
- [pgAdmin](#pgadmin)
- [Troubleshooting](#troubleshooting)
- [Not built yet](#not-built-yet)

---

## When to use which setup

| | **Host dev** | **Docker cluster** |
|---|---|---|
| Command | `npm run dev` | `docker compose up -d --build` |
| Frontend reaches API at | `http://localhost:8080/api/v1` | `http://localhost/api/v1` |
| Topology | 1 API process | nginx → 3 replicas + redis + postgres |
| Reload on code change | instant (nodemon) | needs a rebuild |
| Socket.IO adapter | in-memory (warns on boot) | redis |
| Use it for | writing code | testing before you ship |

**Reach for the cluster when you touch:** notifications, chat, anything using `emitToUser`,
background jobs in `src/jobs/`, in-process caches, nginx config, or the Dockerfile. These are
the things that work on one process and break on three.

---

## What the cluster is

```
browser :80 ──> nginx ──┬──> app1 :8080 ─┐
                        ├──> app2 :8080 ─┼──> redis     (Socket.IO backplane)
                        └──> app3 :8080 ─┘
                                        └──> postgres   (127.0.0.1:8000, optional)
```

Six containers: `nginx`, `app1`, `app2`, `app3`, `redis`, `db`.

**Published ports:** nginx on **:80**, postgres on **127.0.0.1:8000**. The replicas and redis are
deliberately *not* published — all traffic goes through the proxy, which is the point of having
one. Redis has no password, so binding it to a host port is a well-known way to get a machine
compromised.

**Env** comes from `backend-engine/backend/.env` — the same file `npm run dev` reads, so the two
can't drift. See `backend/.env.example` for every variable. Compose only overrides `REDIS_URL`,
because the hostname `redis` exists only inside the cluster.

**nginx is local-only.** It is not deployed. Render terminates TLS and load-balances at its own
edge, so a self-managed proxy there would be a redundant hop. See `backend-engine/render.yaml`.

---

## Command reference

### Start and stop

```bash
docker compose up -d --build     # build + start. use after ANY backend code change
docker compose up -d             # start without rebuilding
docker compose ps                # health of all six containers
docker compose stop              # stop containers, keep them
docker compose down              # stop + remove containers. KEEPS the database
docker compose down -v           # ...and DELETE the postgres volume
```

> `down -v` is the only destructive command here. It permanently wipes local database data.
> Harmless while the local DB is empty; not once you've seeded it.

**Code changes need `--build`.** The replicas run the production image — plain `node`, no
nodemon — on purpose: this cluster's job is to test the real artifact. Iterate with
`npm run dev` instead.

### Logs

```bash
docker compose logs -f             # everything, live
docker compose logs -f app1        # one replica
docker compose logs -f nginx       # includes upstream= — which replica served each request
docker compose logs --tail=50 app1 # last 50 lines
```

Application logs go to stdout (winston's Console transport), so `docker compose logs` *is* the
log. There is no log file to mount.

### Get inside a container

```bash
docker compose exec app1 sh                                 # shell into a replica
docker compose exec app1 node -v                            # one-off command
docker exec -it funturf-db psql -U avnadmin -d defaultdb    # psql, no pgAdmin needed
docker exec funturf-redis redis-cli PUBSUB CHANNELS         # is the socket backplane live?
```

### Prisma against the local database

```bash
docker compose exec app1 npx prisma db push --schema=prisma/postgresql/schema.prisma
```

### nginx config

Bind-mounted, so edits need a reload, not a rebuild:

```bash
docker compose exec nginx nginx -t          # ALWAYS validate first
docker compose exec nginx nginx -s reload
```

> Never run `nginx -t` inside the **image build**. nginx resolves `upstream` hostnames while
> parsing the config, and `app1`/`app2`/`app3` don't exist at build time — a valid config fails
> with `host not found in upstream`. Validate against the running cluster, as above.

### Health checks

```bash
curl localhost/nginx-health   # answered by nginx itself
curl localhost/health         # proxied to a replica — tests the APP
```

The pair is diagnostic:

| `/nginx-health` | `/health` | Meaning |
|---|---|---|
| 200 | 200 | all good |
| 200 | 502 | proxy fine, **all replicas down** |
| fails | fails | nginx itself is down |

### Force things

```bash
docker compose up -d --force-recreate    # replace all containers even if compose thinks nothing changed
docker compose build --no-cache app1     # ignore the layer cache
docker compose restart app1              # bounce one service
```

You will need `--force-recreate` more than you'd expect: `up -d --build` sometimes leaves old
containers running when it decides nothing changed, so replicas end up on **different builds**.
Mismatched uptimes in `docker compose ps` (e.g. `app1` 30 seconds, `app2` 50 minutes) is the
tell. When in doubt, force it.

---

## The local database

**It starts empty, and the app doesn't use it by default.**

`POSTGRESQL_DATABASE_URL` in `backend/.env` points at the hosted **Aiven** database, so the `db`
container just idles and has zero tables. This is deliberate — silently redirecting you to an
empty local database would look exactly like your data vanishing.

### Coordinates

| | Local container | Aiven (hosted) |
|---|---|---|
| Host | `localhost` | `funturf-db-funturf-v1.e.aivencloud.com` |
| Port | **8000** | `26480` |
| Database | `defaultdb` | `defaultdb` |
| User | `avnadmin` | `avnadmin` |
| Password | `POSTGRES_PASSWORD` in `backend/.env` | same |
| SSL | not needed | use `require` (see [pgAdmin](#pgadmin)) |

Port 8000 (not 5432) so the container doesn't clash with a native Postgres install. It's bound to
`127.0.0.1`, so it's reachable from your machine but not from your network — dropping that prefix
would expose it on every interface, café wifi included.

`POSTGRES_USER=avnadmin` / `POSTGRES_DB=defaultdb` look odd for a local container: they're Aiven's
values reused. That's why the local database is `defaultdb` and not something like `funturf-dev`.

### Switching to the local database

1. **Fix the URL in `backend/.env`.** The commented-out line currently reads:

   ```
   POSTGRESQL_DATABASE_URL=postgresql://...@db:5432/funturf-dev
   ```

   That database **does not exist** — the container was created with `POSTGRES_DB=defaultdb`, so
   this fails with `database "funturf-dev" does not exist`. It must end in `/defaultdb`:

   ```
   POSTGRESQL_DATABASE_URL=postgresql://avnadmin:<password>@db:5432/defaultdb
   ```

   `db` is the compose service name, so this URL only resolves **inside** the cluster. From your
   host (Prisma Studio, pgAdmin, psql) use `localhost:8000` instead.

2. Restart and create the schema:

   ```bash
   docker compose up -d
   docker compose exec app1 npx prisma db push --schema=prisma/postgresql/schema.prisma
   ```

3. Confirm:

   ```bash
   docker exec funturf-db psql -U avnadmin -d defaultdb -c "\dt"
   ```

To go back to Aiven, re-comment the line and `docker compose up -d`.

> **Changing `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` later does nothing.** The
> postgres image only reads them when it *initialises an empty data directory*. Editing them
> afterwards has no effect until you wipe the volume with `docker compose down -v`. This
> silently confuses everyone once.

> **Security note:** the local container is currently initialised with your **production Aiven
> password**. It's only bound to `127.0.0.1`, so it isn't exposed — but a throwaway local
> password would be better than reusing the real one.

---

## pgAdmin

The cluster must be running (`docker compose up -d`) to reach the local database.

### Connect to the local container

In pgAdmin: right-click **Servers** → **Register** → **Server…**

**General** tab:
- **Name:** `FunTurf local` (any label you like)

**Connection** tab:

| Field | Value |
|---|---|
| Host name/address | `localhost` |
| Port | `8000` |
| Maintenance database | `defaultdb` |
| Username | `avnadmin` |
| Password | the `POSTGRES_PASSWORD` from `backend/.env` |

Save. Expect it to be **empty** until you've run `prisma db push` (see above).

### Connect to Aiven — where the real data is

This is probably what you actually want to browse.

**Connection** tab:

| Field | Value |
|---|---|
| Host name/address | `funturf-db-funturf-v1.e.aivencloud.com` |
| Port | `26480` |
| Maintenance database | `defaultdb` |
| Username | `avnadmin` |
| Password | the `POSTGRESQL_DATABASE_URL` password from `backend/.env` |

**Parameters** tab — recommended:

| Name | Value |
|---|---|
| SSL mode | `require` |

pgAdmin defaults to `prefer`, which will negotiate TLS with Aiven and connect fine — so this is
not usually needed to get working. Set it to `require` anyway: `prefer` silently *falls back* to
an unencrypted connection if TLS negotiation fails, and these credentials are production. Whether
your traffic is encrypted shouldn't depend on a fallback you never see.

> You are now connected to production data. `DELETE`/`DROP` here is real and unrecoverable.

### Prefer no pgAdmin?

```bash
docker exec -it funturf-db psql -U avnadmin -d defaultdb
```

Then `\dt` to list tables, `\d <table>` to describe one, `\q` to quit.

---

## Troubleshooting

**`docker compose` says the engine isn't running**
```
error during connect: ... dockerDesktopLinuxEngine: The system cannot find the file specified
```
Docker Desktop isn't started. Note `docker compose config` still works while it's down — that's
client-side validation only and proves nothing about the daemon.

**A replica is unhealthy or restarting**
```bash
docker compose logs --tail=50 app1
```
Most likely: a missing env var in `backend/.env` (compare against `.env.example`), or the
database URL is unreachable.

**`docker compose ps` shows different uptimes across app1/app2/app3**

They're running different builds. `docker compose up -d --force-recreate`.

**Port 80 already in use**

Something else (IIS, Skype, another nginx) holds it. Free it, or change the mapping in
`docker-compose.yml` under the `nginx` service — `"8081:80"` gives you `http://localhost:8081`.
If you do, add that origin to `CORS_ORIGINS` in `backend/.env` or the browser will block it.

**Real-time / notifications don't work**

```bash
docker exec funturf-redis redis-cli PUBSUB CHANNELS   # expect several socket.io-* channels
docker compose logs app1 | grep -i "socket\|redis"    # expect "adapter: redis — multi-replica safe"
```
If it says `in-memory — single process only`, `REDIS_URL` isn't reaching the replica and
cross-replica emits will silently vanish.

**Changed `backend/.env` and nothing happened**

Env is read at container start. `docker compose up -d` to re-create with the new values.

**Everything is wedged**

```bash
docker compose down
docker compose up -d --build --force-recreate
```

---

## Not built yet

The **full-stack test** (frontend container + nginx + backend cluster, as one command) is designed
but not implemented. It needs a root-level compose file, a frontend Dockerfile, and a fix for the
fact that `NEXT_PUBLIC_API_BASE_URL` needs *different* values for browser-side and server-side
code inside Docker. This guide will grow a section when that lands.
