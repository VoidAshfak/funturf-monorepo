# =============================================================================
# FunTurf API image
# =============================================================================
# Multi-stage build. Stage 1 ("deps") installs everything and runs the codegen
# that needs dev-dependencies; stage 2 ("runner") is the image that actually
# ships, and holds only the runtime + production node_modules + app source.
#
# Why two stages: the build needs the Prisma CLI (a devDependency, plus the
# query-engine binaries it downloads) to generate the clients, but the running
# app does not. Generating in a throwaway stage and copying out only the finished
# node_modules + generated client keeps the shipped image lean and removes build
# tooling from the attack surface.
#
# NOTE: no C toolchain is installed. `bcrypt` is a native addon, and on Alpine
# (musl) it historically had to be compiled from source — needing python3/make/g++.
# Since bcrypt v6 dropped node-pre-gyp for prebuildify, prebuilt musl binaries
# ship inside the package and `npm ci` just unpacks one. Verified: a musl `npm ci`
# with no toolchain installed hashes successfully. If you ever downgrade bcrypt
# below v6, or add another native addon without musl prebuilds, `npm ci` will
# fail here with a node-gyp error — that's the signal to add back:
#   RUN apk add --no-cache python3 make g++
#
# Both stages MUST use the same base image: bcrypt's .node binary is selected for
# that C library + Node ABI. Change one tag, change both.
#
# Used by:
#   - ../docker-compose.yml  (local 3-replica cluster behind nginx)
#   - ../render.yaml         (production, single service)
# =============================================================================


# -----------------------------------------------------------------------------
# Stage 1 — deps: install, compile, generate Prisma clients, drop dev-deps
# -----------------------------------------------------------------------------
# Pinned to Node 22 (current LTS, matches local dev). Never use `node:current` —
# it silently rolls to a new major and can break native addons mid-deploy.
FROM node:22-alpine AS deps

WORKDIR /funturf/app

# openssl only — Prisma's query engine dlopens libssl during generation. See the
# header note on why no compiler is needed here.
RUN apk add --no-cache openssl

# Copy ONLY the manifests first. Docker caches layers by input, so as long as
# these two files don't change, the expensive `npm ci` below is reused across
# builds even when application source changes.
COPY package.json package-lock.json ./

# `npm ci` (not `npm install`) — installs the exact tree in package-lock.json and
# fails if the lockfile is out of sync. `install` can silently resolve new
# versions, which makes builds non-reproducible and defeats the layer cache.
RUN npm ci

# Prisma schemas only — the generators read these to emit the typed clients into
# src/generated/. Copied separately so editing a controller doesn't invalidate
# this layer.
COPY prisma ./prisma

# Generates BOTH clients (pg + mongo) into src/generated/prisma/{pg,mongo}.
# src/generated/ is gitignored AND dockerignored, so it does not exist on a fresh
# clone — the image must build it or `src/prisma.js` crashes on import.
# No database connection is made here; generation is offline, so no secrets are
# needed at build time (important: build args would otherwise leak into layers).
RUN npm run prisma:generate

# Strip devDependencies (prisma CLI, nodemon, prettier, cross-env) now that
# they've done their job. The GENERATED client stays — it lives under src/, not
# node_modules, and is a runtime dependency.
RUN npm prune --omit=dev


# -----------------------------------------------------------------------------
# Stage 2 — runner: the image that actually ships
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /funturf/app

# tini = a real init for PID 1. Node as PID 1 does not get the kernel's default
# signal handlers, so it ignores SIGTERM and `docker stop` / a Render redeploy
# would hang for 10s and then SIGKILL — cutting in-flight requests. tini forwards
# signals properly and reaps zombies.
# openssl is needed again here: Prisma's query engine loads it at runtime.
RUN apk add --no-cache tini openssl

# Signals the app to skip dev-only branches, and makes Express itself faster
# (view caching, terser error output). Overridable per-environment.
ENV NODE_ENV=production

# Application source. .dockerignore keeps .env, node_modules, src/generated/,
# and .git out of the build context — so secrets never enter a layer, and the
# artifacts from stage 1 below are not overwritten by stale host copies.
# --chown so the files are owned by the unprivileged user we drop to below.
COPY --chown=node:node . .

# Bring over the two things stage 1 built. Order matters: these land AFTER the
# source copy so nothing can clobber them.
COPY --from=deps --chown=node:node /funturf/app/node_modules ./node_modules
COPY --from=deps --chown=node:node /funturf/app/src/generated ./src/generated

# Multer streams uploads to public/temp before they're pushed to Cloudinary, so
# that path must be writable by the runtime user (see middlewares/file-upload/).
RUN mkdir -p public/temp && chown -R node:node public

# Drop root. The `node` user ships with the official image (uid 1000). If the
# process is ever compromised, the blast radius is one unprivileged account that
# cannot write to the image or bind privileged ports.
USER node

# Documentation only — publishing the port is the orchestrator's job
# (docker-compose `expose:` / Render's port detection).
EXPOSE 8080

# Container-level liveness. Uses busybox wget, already in the base image, so we
# don't install curl just for this. `${PORT:-8080}` matches src/index.js, which
# reads the same variable — Render injects its own PORT value.
# docker-compose depends_on: service_healthy waits on this before starting nginx.
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/health" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]

# Exec `node` DIRECTLY — not `npm start`. npm would sit between tini and node as
# an extra process and does not reliably forward SIGTERM to its child, which
# reintroduces the exact shutdown problem tini is here to solve.
# Plain node, no nodemon: this image is the production artifact and the local
# cluster runs the same thing, so the two stay honest. For live-reload iteration
# run `npm run dev` on the host instead.
CMD ["node", "src/index.js"]
