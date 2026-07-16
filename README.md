<div align="center">

# ⚽ FunTurf

### Find players. Book the ground. Play the match.

**The go-to platform for turf sports in Bangladesh** — organize games, fill your squad with players who actually show up, book grounds, and settle up. All in one place.

<br>

[![Next.js](https://img.shields.io/badge/Next.js-15.5-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.7-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-realtime-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

</div>

---

## 🎯 The Problem

In Bangladesh, we play a lot of matches on turf grounds — football above all. Friends from school, college, the office fix a date and arrange a match. The hard part is never the ground. **It's the players.**

- The organizer books a ground but can't fill all the spots.
- People spam Facebook groups and personal contacts asking *"anyone free tonight?"*
- And the flip side: *"I want to play today, but I have no team."*

**FunTurf closes that gap.** A player looking for a game and a team short one striker find each other — both sides' demand met, on a platform built for exactly this.

---

## ✨ What You Can Do

### 🏟️ For Players
- **Discover & join matches** near you — filter by sport, date, location, skill.
- **Request to join** a squad, or **get invited** — with a proper accept / reject flow, not a group-chat scramble.
- **Real-time match chat** for every game you're in, plus **direct messages** to any player (replies + reactions included).
- **Player profiles** with sports played, games organized, connections, and turf ratings.
- **Rate the turfs** you play on — one honest rating per ground, editable anytime.

### 📅 For Organizers
- **Create a match**, set player limits, attach a booking, and manage your roster live.
- **Rematch** in one tap — bring the same squad back with invitations sent automatically.
- **Soft-cancel** a match without losing its history.
- **QR check-in** for players at the ground.

### 🏢 For Turf Managers
- **List & manage grounds** through a guided multi-step wizard.
- **Smart slot pricing** — peak hours, weekends, and per-ground rates handled for you.
- **Coupons & promotions** — percentage or flat discounts, scoped to a turf, a ground, specific users, specific days, with usage limits and validity windows. Applied at booking with a live price breakdown on the ticket.
- **Business analytics** — revenue, redemption trends, and coupon performance in visual charts.

---

## 🏗️ Architecture

FunTurf is an **umbrella repository** that stitches together two independently-developed codebases via `git subtree`. Treat them as separate projects that share a history.

```
project-funturf/
├── backend-engine/          # Express + Prisma REST API
│   ├── backend/             # ← app code, package.json, npm scripts live HERE
│   │   ├── src/
│   │   │   ├── controllers/ # auth · event · venue · user-connection · chat
│   │   │   ├── routes/      # domain-grouped route files
│   │   │   ├── middlewares/ # auth · file-upload · venue
│   │   │   ├── utils/       # bookingService · errorCodes · dataSerializer · …
│   │   │   ├── jobs/        # eventSweeper (scheduled cleanup)
│   │   │   ├── socket.js    # Socket.IO realtime layer
│   │   │   └── prisma.js    # pgClient (active) · mongoClient (deprecated)
│   │   └── prisma/postgresql/schema.prisma   # ~27 models, authoritative domain
│   ├── docker-compose.yml   # postgres + 3 API replicas + nginx
│   ├── nginx/               # load balancer
│   └── render.yaml          # Render deploy (nginx → app1/2/3)
│
├── frontend-engine/         # Next.js 15 App Router client (flat layout)
│   └── src/
│       ├── app/             # (root) public · (auth) · dashboard · api
│       ├── components/      # shared UI (shadcn/ui + lucide)
│       ├── store/           # Redux Toolkit + RTK Query
│       └── providers/       # NextAuth · Redux · AuthSync
│
└── docs/api-guideline.md    # single source of truth for the REST API
```

### How the halves connect
The frontend calls the backend at **`NEXT_PUBLIC_API_BASE_URL`** (`http://localhost:8080/api/v1` locally, the Render service in production). One env change switches environments — the base URL is read at every call site, never hardcoded.

### Realtime
Socket.IO powers live rosters, match chat, DMs, and notifications. Each user auto-joins a `user:{id}` room on connect; the backend emits targeted events, and RTK Query streams them straight into the cache via `onCacheEntryAdded`.

### Built for scale
The API runs as **3 identical replicas behind Nginx**. Writes are idempotent and use `RETURNING` as an exactly-once claim, so nothing double-processes across replicas.

---

## 🧰 Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 15 (App Router, Turbopack) · React 19 · Tailwind CSS v4 · shadcn/ui · lucide-react · Redux Toolkit + RTK Query · NextAuth · GSAP · Recharts · react-leaflet |
| **Backend** | Node.js · Express 4 · Prisma 6 · Socket.IO · JWT (jsonwebtoken) · bcrypt · Multer + Cloudinary · Winston · express-rate-limit · node-cache |
| **Database** | PostgreSQL (primary, via Prisma) |
| **Infra** | Docker Compose · Nginx (3-replica cluster) · Render · imgbb (image hosting) |

---

## 🚀 Getting Started

> ⚠️ **No tooling at the umbrella root.** Every command runs inside one of the two subtrees. The backend has an extra nesting level — scripts live in `backend-engine/backend/`, **not** `backend-engine/`.

### Prerequisites
- Node.js 18+
- A PostgreSQL database
- Cloudinary + imgbb API keys (image upload)

### 1️⃣ Backend

```bash
cd backend-engine/backend
npm install

# generate the Prisma client (src/generated/ is NOT committed — required!)
npm run prisma:generate

# push the schema to your database
npm run prisma:push:pgsql

# start the API (nodemon, port 8080)
npm run dev
```

Create a `.env` in `backend-engine/backend/` with your `DATABASE_URL`, `ACCESS_TOKEN_SECRET`, Cloudinary credentials, etc.

### 2️⃣ Frontend

```bash
cd frontend-engine
npm install

# start the dev server (Turbopack, port 3000)
npm run dev
```

Create a `.env` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1`, `NEXTAUTH_SECRET`, and `IMGBB_API_KEY`.

Open **http://localhost:3000** 🎉

### 🐳 Docker (optional)
Bring up the full cluster — postgres + 3 API replicas + nginx — from `backend-engine/`:

```bash
docker compose up -d      # nginx serves on port 80, postgres on 127.0.0.1:8000
```

---

## 📚 API Documentation

The full REST API reference lives in [`docs/api-guideline.md`](docs/api-guideline.md) — endpoints, request/response shapes, auth requirements, and centralized error codes. Keep it in sync when the API changes.

---

## 🔒 Security & Conventions

- **Role-based access control** — players, organizers, turf managers, and admins each see only what they should.
- **JWT auth** via `verifyJWT` middleware; bearer tokens attached automatically on the client.
- **Centralized error handling** — every error is an `ApiError.fromCode(...)` from a single `errorCodes.js` registry; no ad-hoc error responses.
- **Rate limiting**, input validation, and TZ-safe date handling (Bangladesh UTC+6) throughout.
- **Structured logging** with Winston at every important checkpoint.
- Guiding principles: **DRY · KISS · SOLID**.

---

## 🤝 Contributing

The two subtrees are separate codebases with their own detailed `CLAUDE.md` — **read the one for the area you're touching** before making changes:

- [`backend-engine/CLAUDE.md`](backend-engine/CLAUDE.md) — API commands, Prisma dual-datasource model, request flow, conventions, deploy.
- [`frontend-engine/CLAUDE.md`](frontend-engine/CLAUDE.md) — Next.js commands, data strategy, route groups, image-upload flow.

**Golden rule:** if the backend changes, the frontend gets the update — and vice versa. Keep request/response shapes in sync across the two halves.

---

<div align="center">

Built with ⚽ for the turf sports community of Bangladesh.

**Fix a date. Arrange the match. Play.**

</div>
