## Project Goal
In Bangladesh, we play mathces in turf grounds a lot. People from school, college, office. Specially football. Fix a date, arrange a match. If enough players are confirmed, they book the ground and arrange the match event. But the deficulties come when arrange the players. Sometimes there are not enough players to arrange the event. People reach out to facebook groups and personal contacts to see if someone is available to arrange the match. Another take on this is from an individual one's perspective. Suppose I am willing to play today. But i don't have a team. I am willing to play with a team as a player of their's. This way each side demand is fulfilled. Funturf solve this and with some extra features, this can be the go to platform for sport enthusiasts.  

## What this repo is

FunTurf — a turf (sports ground) booking and game-organizing platform for Bangladesh. This is an **umbrella repository** that combines two independently-developed projects pulled in via `git subtree` (see the "Add '<dir>/' from commit ..." commits on `main`):

- **`backend-engine/`** — the Express + Prisma REST API, its Docker/Nginx cluster, and Render deploy config.
- **`frontend-engine/`** — the Next.js 15 (App Router, React 19) web client.

There is **no build, test, or tooling at the umbrella root** — every command runs inside one of the two subtrees. Treat the two as separate codebases that happen to share a git history.

## Project Structure
funturf-monorepo/
├── backend-engine/
│   ├── CLAUDE.md
│   ├── backend/
│   │   ├── .dockerignore
│   │   ├── Dockerfile
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
│   ├── docker-compose.yml
│   ├── nginx/
│   │   ├── Dockerfile
│   │   └── nginx.conf
│   └── render.yaml
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


## Where the real instructions live

Each subtree has its own detailed `CLAUDE.md`. **Read the one for the area you're working in before making changes — it is authoritative for that codebase:**

- `backend-engine/CLAUDE.md` — API commands (run from `backend-engine/backend/`), Prisma dual-datasource model (use `pgClient`, `mongoClient` is deprecated), request flow, controller/error/auth conventions, Docker cluster, Render deploy.
- `frontend-engine/CLAUDE.md` — Next.js commands, stack (Tailwind v4, shadcn/ui, RTK Query + NextAuth), hybrid server-read / client-RTK-Query data strategy, route groups, image-upload flow.

## Nesting gotcha

The backend has an extra level: app code is `backend-engine/backend/src/`, and the backend `package.json` / npm scripts live in `backend-engine/backend/`, **not** in `backend-engine/`. This is for running the project locally. The Docker/Nginx/Render files (`docker-compose.yml`, `nginx/`, `render.yaml`) sit one level up in `backend-engine/`. The frontend is flat: code and `package.json` are both directly under `frontend-engine/`.

## How the two halves connect

The frontend calls the backend at the base URL in **`NEXT_PUBLIC_API_BASE_URL`** (`frontend-engine/.env`), defaulting to `http://localhost:8080/api/v1` — the local backend dev server (`npm run dev` from `backend-engine/backend/`). It's read via `process.env.NEXT_PUBLIC_API_BASE_URL` at every call site (`src/utils/getData.js`, the NextAuth route `src/app/api/auth/[...nextauth]/route.js`, and the RTK Query base query `src/store/api/apiSlice.js`) — so switching environments is a one-line env change. Point it at the deployed API (`https://app4-osju.onrender.com/api/v1`, served by the Render service in `backend-engine/render.yaml`) for production. Keep request/response shapes in sync manually between the two subtrees (notably the venue/ground payload — `frontend-engine` `src/utils/constants.js` vs. the backend Prisma schema). 


## Additional Instructions (Very Important)

- **ALWAYS ENSURE IF BACKEND IS UPDATED, THEN FRONTEND GETS THOSE UPDATES AND ALSO VICE VERSA. FIRST SUGGEST THEN CODE. DO NOT JUMP INTO CODING**
- ensure proper all security mesures
- role based access
- write good comments for new developers
- add logging to important checkpoints
- Install any secured (npm) packages to execute any task and take it to the next level. The service should be security tight and feature rich.


## Coding Rules (Very Important)

- DRY
- KISS
- SOLID
- Consistent error handling
