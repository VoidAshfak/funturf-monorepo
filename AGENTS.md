# FunTurf AGENTS.md

## Repo structure (umbrella — two subtrees on `main`)

This is **not** a monorepo with shared tooling. Two independent projects co-exist via `git subtree`:

```
backend-engine/backend/   ← Express + Prisma REST API (extra nesting level!)
frontend-engine/          ← Next.js 15 App Router client
```

**No root-level build, test, lint, or dev scripts exist.** Every command runs inside one subtree.

- Backend `package.json` is at `backend-engine/backend/package.json` (not `backend-engine/`).
- Frontend `package.json` is at `frontend-engine/package.json`.

## Authoritative instruction files

- `backend-engine/CLAUDE.md` — backend conventions (asyncHandler, ApiError, verifyJWT, caching, DTO serializers, public-id masking)
- `frontend-engine/CLAUDE.md` — frontend conventions (server components by default, RTK Query, NextAuth, image upload via imgbb, multi-step turf form)
- `docs/api-guideline.md` — **contract between backend and frontend**: response envelopes, error codes, every endpoint. **Update in the same change as the route.**

## Commands you will guess wrong

### Backend (run from `backend-engine/backend/`)

```bash
npm run dev                  # nodemon + dotenv, port 8080
npm run dev:docs             # same but forces Swagger UI on
npm run prisma:generate      # regenerate BOTH Prisma clients
```

- `src/generated/` is **not committed** — run `prisma:generate` before `dev` or imports crash.
- `.env` sets `NODE_ENV=production`, so Swagger is **off** by default locally. Use `npm run dev:docs` to see it.
- No test runner, no linter.

### Frontend (run from `frontend-engine/`)

```bash
npm run dev      # Turbopack on :3000
npm run build    # Turbopack
npm run lint     # ESLint
```

- JavaScript only (no TypeScript). Files mix `.js`/`.jsx` — match whatever the directory uses.
- Tailwind v4: CSS-first config in `src/app/globals.css`, no `tailwind.config` file.

## Project Structure
funturf-monorepo/
├── backend-engine/
│   ├── CLAUDE.md
│   ├── backend/
│   │   ├── logs/
│   │   │   └── logger.js
│   │   ├── package-lock.json
│   │   ├── package.json
│   │   ├── prisma/
│   │   │   ├── mongodb/
│   │   │   │   ├── schema.prisma
│   │   │   │   └── seed.js
│   │   │   └── postgresql/
│   │   │       └── schema.prisma
│   │   ├── public/
│   │   │   └── temp/
│   │   │       └── .gitkeep
│   │   └── src/
│   │       ├── app.js
│   │       ├── constants.js
│   │       ├── controllers/
│   │       │   ├── auth/
│   │       │   ├── event/
│   │       │   ├── user-connection/
│   │       │   └── venue/
│   │       ├── index.js
│   │       ├── middlewares/
│   │       │   ├── auth/
│   │       │   ├── file-upload/
│   │       │   └── venue/
│   │       ├── prisma.js
│   │       ├── routes/
│   │       │   ├── auth/
│   │       │   ├── event/
│   │       │   ├── user/
│   │       │   └── venue/
│   │       └── utils/
└── frontend-engin
    ├── .gitignore
    ├── CLAUDE.md
    ├── README.md
    ├── components.json
    ├── docs/
    │   └── DESIGN.md
    ├── eslint.config.mjs
    ├── jsconfig.json
    ├── next.config.mjs
    ├── package-lock.json
    ├── package.json
    ├── postcss.config.mjs
    ├── public/
    │   ├── assets/
    │   │   ├── avatars/
    │   │   ├── icons/
    │   │   └── images/
    │   └── data/
    └── src/
        ├── app/
        │   ├── (auth)/
        │   │   ├── layout.js
        │   │   ├── login/
        │   │   │   └── page.jsx
        │   │   └── signup/
        │   │       └── page.jsx
        │   ├── (root)/
        │   │   ├── events/
        │   │   │   ├── [eventId]/
        │   │   │   │   └── page.jsx
        │   │   │   ├── _components/
        │   │   │   ├── create/
        │   │   │   │   └── page.jsx
        │   │   │   ├── loading.jsx
        │   │   │   └── page.jsx
        │   │   ├── layout.jsx
        │   │   ├── page.jsx
        │   │   ├── profile/
        │   │   │   └── [userId]/
        │   │   │       └── page.jsx
        │   │   └── venues/
        │   │       ├── [venueId]/
        │   │       │   ├── _components/
        │   │       │   └── page.jsx
        │   │       ├── loading.jsx
        │   │       └── page.jsx
        │   ├── api/
        │   │   ├── auth/
        │   │   │   └── [...nextauth]/
        │   │   │       └── route.js
        │   │   └── upload/
        │   │       └── route.js
        │   ├── dashboard/
        │   │   ├── _components/
        │   │   ├── bookings/
        │   │   │   └── page.js
        │   │   ├── layout.js
        │   │   ├── page.js
        │   │   └── turfs/
        │   │       ├── [venueId]/
        │   │       │   ├── _components/
        │   │       │   └── page.js
        │   │       ├── _components/
        │   │       ├── add-new-turf/
        │   │       │   ├── _components/
        │   │       │   └── page.js
        │   │       └── page.js
        │   ├── favicon.ico
        │   ├── globals.css
        │   ├── layout.js
        │   └── loading.jsx
        ├── components/
        │   ├── auth/
        │   ├── forms/
        │   └── ui/
        ├── hooks/
        ├── lib/
        ├── providers/
        ├── sections/
        ├── store/
        │   ├── api/
        │   ├── slices/
        │   └── store.js
        └── utils/

## Key architecture facts

### Backend

- **Two Prisma datasources:** Use `pgClient` (PostgreSQL) only. `mongoClient` is deprecated.
- **Auth:** `verifyJWT` middleware reads `Bearer` token, sets `req.user`. Apply per-route.
- **Errors:** Throw `ApiError(status, message)`. Never write error responses in controllers.
- **Success:** Return `new ApiResponse(status, message, data)`.
- **Public ID masking:** Every ID in URLs/payloads is a 22-char opaque token, not a UUID. Never send raw UUIDs to clients. Handled globally by `publicId.middleware.js`.
- **Swagger spec** is hand-written at `backend/docs/openapi.yaml` — edit it alongside route changes.
- **Background jobs** (`jobs/holdSweeper.js`, `eventSweeper.js`): run in-process on all replicas (idempotent). Started in `src/index.js`.
- **Connection pool:** Budgeted for 3 replicas × 2 connections each (17 total DB connections). Configured via env vars in `src/prisma.js`.
- **CORS:** Whitelist-based, shared between REST and Socket.IO via `corsOrigins.js`.

### Frontend

- **Hybrid data strategy:** Server components fetch initial data via `src/utils/getData.js` (`fetch` SSR). Client components use RTK Query (`src/store/api/apiSlice.js`) for interaction-driven reads and all writes.
- **RTK Query** hooks: `useGetVenuesQuery`, `useGetEventsQuery`, `useGetUserByIdQuery`, mutations `useCreateVenueMutation`, `useCreateEventMutation`, `useRegisterUserMutation`. `transformResponse` unwraps `res.data`. Tags: `Venues`/`Venue`/`Events`/`Event`/`User`.
- **NextAuth** credentials provider + JWT sessions. `session.user.access_token` → RTK Query `prepareHeaders` via `AuthSync.jsx`.
- **Images upload via imgbb** (not Cloudinary on frontend). Client POSTs file to `/api/upload` route, which forwards to imgbb. Backend uses Cloudinary for its own uploads.
- **No TypeScript.** Path alias `@/*` → `src/*`.
- **Constants must stay in sync** between `frontend-engine/src/utils/constants.js` (`venuedata`, `groundData`) and the backend Prisma schema + `docs/api-guideline.md`.

## Always do before coding

1. Read the relevant subtree's `CLAUDE.md` first.
2. If touching an API route, check `docs/api-guideline.md` + `backend/docs/openapi.yaml` and update both.
3. If changing a payload shape (venue, ground, event, user), update **both** frontend constants and backend schema — they must match. also update that shape for `docs/api-guideline.md` + `backend/docs/openapi.yaml`.
4. **Suggest before coding** — the repo convention is to discuss the change plan before writing code.

## repo-specific conventions

- `_components/` folders next to pages = route-local components.
- `src/components/ui/` = shadcn/ui components.
- Route groups: `(root)` public site, `(auth)` login/signup, `dashboard` admin area.
- No `.env` files committed with real secrets (frontend `.env` has a placeholder `NEXTAUTH_SECRET`; set a real one).
- Work lands on `main` via PRs; active dev branch is `dev`.
- Formatting: Prettier (backend `.prettierrc`: double quotes, trailing commas es5, semicolons).
