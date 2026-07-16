
## Commands

```bash
npm run dev      # Dev server (Turbopack) on http://localhost:3000
npm run build    # Production build (Turbopack)
npm run start    # Serve production build
npm run lint     # ESLint (eslint-config-next)
```

## Stack

- **Next.js 15.5.7** App Router, **React 19**, Turbopack for dev and build.
- JavaScript only (no TypeScript). Files mix `.js` and `.jsx` extensions inconsistently — match whatever a directory already uses.
- **Tailwind CSS v4** (CSS-first config via `src/app/globals.css`; there is no `tailwind.config`). PostCSS plugin `@tailwindcss/postcss`.
- **shadcn/ui** ("new-york" style) in `src/components/ui/`, **lucide-react** icons, `cn()` helper (`src/lib/utils.js`) for class merging.
- `@/*` path alias maps to `src/*`.

## Architecture
- **Use server components by default**

### Backend API
The frontend talks to the backend at the base URL in **`NEXT_PUBLIC_API_BASE_URL`** (`.env`), defaulting to `http://localhost:8080/api/v1` — the local backend dev server (`npm run dev` from `backend-engine/backend/`). Read via `process.env.NEXT_PUBLIC_API_BASE_URL` in `src/utils/getData.js`, the NextAuth route, and the RTK Query base query (`src/store/api/apiSlice.js`); the `NEXT_PUBLIC_` prefix is required because `apiSlice` runs client-side. Point it at the deployed API `https://app4-osju.onrender.com/api/v1` for production. When adding API calls, follow the same pattern — do not hardcode the host.

**Browsable API docs:** run the backend with `npm run dev:docs` (from `backend-engine/backend/`) and open `http://localhost:8080/api/v1/docs` for interactive Swagger UI covering every endpoint, payload and error code — the fastest way to check a request/response shape before wiring an RTK Query endpoint. Raw spec: `/api/v1/docs.json`. It is not exposed on the deployed API.

**Hybrid data strategy** (server reads + client RTK Query):
- **Server components** still fetch initial page data via `src/utils/getData.js` (`getAllVenues`, `getIndividualVenueByVenueId`, `getAllEvents`, `getUserByUserId`, etc.) so SSR/streaming/`loading.jsx` keep working. These `fetch` server-side and swallow errors into empty-shape fallbacks (`{ data: [] }` / `{ data: {} }`).
- **Client components** use **RTK Query** (`src/store/api/apiSlice.js`) for interaction-driven reads and all writes. Hooks: `useGetVenuesQuery`, `useGetVenueByIdQuery`, `useGetEventsQuery`, `useGetEventByIdQuery`, `useGetUserByIdQuery`, and mutations `useCreateVenueMutation`, `useCreateEventMutation`, `useRegisterUserMutation`. `transformResponse` unwraps `res.data`; tags (`Venues`/`Venue`/`Events`/`Event`/`User`) drive cache invalidation.

### State management (Redux Toolkit)
- Store assembled in `src/store/store.js` (`makeStore`): `apiSlice` reducer + `auth` + `filters` slices, `apiSlice.middleware`, `setupListeners`.
- `src/providers/ReduxProvider.jsx` ("use client") creates a per-instance store via `useRef` and wraps the app **inside** `NextAuthSessionProvider` in the root `layout.js`.
- `src/providers/AuthSync.jsx` bridges the NextAuth session into `authSlice` (`setCredentials`) so RTK Query's `prepareHeaders` attaches the bearer token — client write components no longer pass `Authorization` manually.
- `src/store/slices/filtersSlice.js` holds the `events`/`venues` filter + pagination state consumed by `EventsExplorer`/`VenuesExplorer` (changing any filter auto-resets `page` to 1).

### Auth (NextAuth)
- Config in `src/app/api/auth/[...nextauth]/route.js`: Credentials provider, JWT session strategy. `authorize` POSTs to the backend `/users/login`; the backend `accessToken` is carried on the JWT as `token.access_token` and exposed via `session.user.access_token`.
- `src/providers/NextAuthSessionProvider.js` wraps the app in the root `layout.js`.
- Server components read auth with `getServerSession(authOptions)`; client components use `useSession()`.
- `src/app/dashboard/layout.js` gates the dashboard — redirects to `/login` when there is no session.

### Route groups (`src/app`)
- **`(root)`** — public site (home, `venues`, `venues/[venueId]`, `events`, `events/[eventId]`, `profile/[userId]`). Layout renders `Navbar` (desktop) / `SmallScreenMenu` (mobile) and passes the server session down.
- **`(auth)`** — `login`, `signup`.
- **`dashboard`** — admin area (sidebar via `SidebarProvider`/`AppSidebar`); manage `turfs`, `turfs/[venueId]`, `turfs/add-new-turf`, `bookings`.
- **`api`** — `auth/[...nextauth]` and `upload`.
- Route-local components live in `_components/` folders next to the page that uses them; shared components are in `src/components/`.

### Image upload flow
Client calls `src/utils/image-upload.js` (`uploadSingleImageObj`, `uploadImageObjArray`), which POSTs the file to the internal `/api/upload` route. That route (`src/app/api/upload/route.js`) forwards to **imgbb** using `IMGBB_API_KEY` and returns the hosted `display_url`. Components hold images as `{ file }` objects in form state and convert them to URLs at submit time.

### Multi-step turf form
`dashboard/turfs/add-new-turf/page.js` drives a 5-step wizard. A single `formdata` object (seeded from `venuedata` in `src/utils/constants.js`) plus `step` state are passed to `StepOne`–`StepFive`; `ProgressSteps` shows progress. The expected venue/ground payload shape is defined by `venuedata` and `groundData` in `src/utils/constants.js` — keep these in sync with the backend schema. `StepFive` uploads images, assembles the final payload, and POSTs to `create-venue`.

### Shared data & constants
- `src/utils/constants.js` — domain enums (`SPORTS`, `FACILITIES`, `AMENITIES`, `GROUND_TYPES`, `SURFACE_TYPES`, `STATUS_TYPES`), wizard steps, and the `venuedata`/`groundData` form shapes.
- `src/utils/utility-functions.js` — `getStatusColor`, `getLocationString`.
- Mock/seed data in `src/lib/users.js` and `public/data/` is still used in places (e.g. `getAllUser`) alongside the real API.

### Images
`next.config.mjs` allows remote images from any host (http/https) — needed because venue/ground images come from imgbb and arbitrary backend URLs.

## Notes
- `.env` holds `IMGBB_API_KEY`, `NEXT_PUBLIC_BASE_URL` (the frontend's own origin), `NEXT_PUBLIC_API_BASE_URL` (backend API base), and `NEXTAUTH_SECRET`. It is committed with a real imgbb key but a placeholder `NEXTAUTH_SECRET` — set a real secret for auth to work.

