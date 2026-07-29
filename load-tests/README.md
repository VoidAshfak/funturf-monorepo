# FunTurf Load Testing Suite

## What is this?

Load tests for the FunTurf API, built with **[Artillery](https://www.artillery.io) v2**.
They simulate real user traffic — browsing venues, registering, creating events, checking
availability — so you can measure how the API behaves under load.

## Quick Start

```bash
# 1. Install dependencies (once)
cd load-tests
npm install

# 2. Mint a rate-limit bypass token and put it on the BACKEND
npm run token                       # prints a 64-char hex string
# → add to backend-engine/backend/.env:
#     LOAD_TEST_BYPASS_TOKEN=<that value>
# (see "Rate limits" below — without this the run measures the rate limiter)

# 3. Start the backend (separate terminal)
cd backend-engine/backend
npm run dev

# 4. Export the SAME token in the shell you run tests from
cd load-tests
export LOAD_TEST_BYPASS_TOKEN=<that value>     # PowerShell: $env:LOAD_TEST_BYPASS_TOKEN="<value>"

# 5. Run the smoke test, then read the summary
npm run smoke
npm run report
```

## Rate limits — read this before your first run

The API rate-limits aggressively (`middlewares/rateLimit.middleware.js`), keyed by user id
or IP. A load test drives everything from **one host**, so those buckets drain instantly:

| endpoint | limit | virtual users before it walls off |
| --- | --- | --- |
| `POST /users/register` | 3 / hour / IP | 3 |
| `POST /users/login` | 10 / 15 min / IP | 10 |
| `PATCH /users/me` | 20 / min | 20 |

Without a bypass, a run is a measurement of `express-rate-limit`, not of FunTurf.

So the backend supports an opt-in bypass. It is off unless **both** halves are present:

1. `LOAD_TEST_BYPASS_TOKEN` set on the backend to a value of **at least 32 characters**
   (shorter values are refused and the bypass stays off).
2. The request carries that value in an `x-loadtest-token` header.

`targets/local.yml` attaches that header from `$env.LOAD_TEST_BYPASS_TOKEN`, so exporting
the variable in your shell is all the test side needs.

> ⚠ **Never set `LOAD_TEST_BYPASS_TOKEN` in production.** `targets/prod.yml` deliberately
> sends no bypass header, so `:prod` runs are subject to the real limiters — a wave of 429s
> there is correct behaviour, not a defect.

If you see a pile of `http.codes.429`, one of the two halves is missing or they don't match.

## Available Tests

| Command | Test | What it does | Duration | Best for |
|---------|------|-------------|----------|----------|
| `npm run smoke` | Smoke | 1 user walks every endpoint | ~10s | **First check** after a deploy |
| `npm run smoke:prod` | Smoke (prod) | Same, against production | ~10s | Verifying production is alive |
| `npm run load` | Load | ramp to 10 VUs/sec, hold 5 min | ~7.5 min | **Daily baseline** — catch regressions |
| `npm run load:prod` | Load (prod) | Same, against production | ~7.5 min | ⚠ Coordinate with the team first |
| `npm run stress` | Stress | Ramp 1 → 50 VUs/sec | ~10 min | **Find the breaking point** |
| `npm run soak` | Soak | 15 VUs/sec steady for 30 min | ~33 min | **Memory leaks & DB issues** |
| `npm run report` | — | Print a summary of the last run | instant | Reading results |
| `npm run token` | — | Generate a bypass token | instant | Setup |

> 💡 **Start with `npm run smoke`.** If it fails, the others will only produce noise.

Every test writes `artillery-report.json` (via `--output`), which `npm run report` reads.

## How Load Testing Works (for beginners)

### Concepts

| Term | Meaning |
|------|---------|
| **VU** (Virtual User) | A simulated user running one scenario start to finish |
| **Arrival rate** | How many NEW VUs start per second — not how many are concurrently active. Long scenarios mean concurrency climbs well above the arrival rate |
| **Ramp-up** | Gradually increasing load, so you measure steady state rather than cold start |
| **Steady state** | Holding load constant to observe behaviour over time |
| **p95** | 95% of requests finished within X ms. p95 = 2000ms means 5% of users waited over 2s |
| **Error rate** | Share of requests that failed (4xx/5xx, or no response at all) |

### What each test type is for

```
Smoke  →  "Is the API alive and responding correctly?"
Load   →  "Can the API handle normal daily traffic?"
Stress →  "At what load does it break?"
Soak   →  "Does it leak memory or connections over time?"
```

### Reading the results

```bash
npm run report
```

`artillery report` (the old HTML generator) was **removed in Artillery v2** — the command
still exists but only prints a deprecation notice pointing at the hosted Artillery Cloud
dashboard. `scripts/summarize.js` replaces it with an offline summary: overview, latency
percentiles, status-code breakdown, transport errors, and a per-endpoint p95 table sorted
slowest-first.

**What to look for:**

1. **p95 > 5000ms** → users notice. Investigate the slowest endpoints in the table.
2. **Error rate jumps suddenly** → an endpoint crashed, or a limit was hit.
3. **Latency trends upward across a soak** → leak, or a query degrading as tables grow.
4. **p95 fine but max huge** → GC pauses or a background sweeper colliding with traffic.
5. **Any `http.codes.429`** → the rate-limit bypass isn't configured (see above).
6. **`errors.ECONNREFUSED`** → the backend isn't running.

Pass/fail is decided by the `ensure` plugin, and `artillery run` exits non-zero on a breach —
that is what makes `npm run smoke` usable as a CI gate.

## Test Definitions

### `smoke-test.yml`

A single VU through the whole API surface in order:

1. Public reads (venues, events, nearby, slots, quote)
2. Register + login
3. Authenticated reads (profile, my-events, notifications, bookings)
4. Writes (create event, rate venue)

Thresholds: p95 < 2000ms, **zero** errors. Run it after every deployment.

### `load-test.yml`

Everyday traffic, three weighted scenarios:

| Scenario | Weight | Simulates |
|----------|--------|-----------|
| Browse & Read | 60% | Anonymous users browsing venues and events |
| Auth & Social | 25% | Logged-in users checking profile, notifications, bookings |
| Write Operations | 15% | Users creating events and submitting ratings |

Ramps over 2 minutes (so the Prisma pool and caches warm up), holds 5 minutes, cools down.
Thresholds: p95 < 3000ms, error rate < 1%.

### `stress-test.yml`

A continuous ramp from 1 to 50 VUs/sec over 10 minutes, with no steady state. Reveals the
maximum concurrency the API sustains, which endpoint folds first, and whether it recovers.

The traffic mix uses per-step `probability` rather than branching — Artillery flows have no
if/then/else, and independent per-VU choices model real navigation better anyway.

Expect this test to **fail** its thresholds. That is the point: the breach locates your
capacity ceiling. Set production alerts around 70% of it.

### `soak-test.yml`

15 VUs/sec for 30 minutes. The goal is duration, not throughput. Catches:

- **Memory leaks** — heap growing with request count
- **Connection pool exhaustion** — connections not returned
- **Slow query accumulation** — the run's own writes grow the tables
- **Cache degradation** — TTL evictions causing repeated DB hits
- **Background job interference** — the hold/event sweepers competing with traffic

Run it before a major release or after schema changes.

## Project Structure

```
load-tests/
├── README.md                       ← You are here
├── package.json                    ← Install + run scripts
├── targets/
│   ├── local.yml                   ← Local dev (port 8080) + bypass header
│   └── prod.yml                    ← Production (Render), no bypass header
├── helpers/
│   └── helpers.js                  ← Payload generators, step guards, hooks
├── scripts/
│   └── summarize.js                ← Offline replacement for `artillery report`
├── smoke-test.yml                  ← Quick sanity check
├── load-test.yml                   ← Daily baseline
├── stress-test.yml                 ← Breaking point finder
└── soak-test.yml                   ← Endurance test
```

### `helpers/helpers.js`

One file, three kinds of export. Artillery resolves `config.processor` **relative to the
`--config` file**, which is why the test scripts reference `"../helpers/helpers.js"`.

| Kind | Used as | Examples |
|------|---------|----------|
| Flow functions | `- function: "name"` | `registerAndLogin`, `setBookingDate`, `generateEvent`, `generateRating`, `generateProfileUpdate`, `generateBooking` |
| Step guards | `ifTrue: "name"` | `hasVenueId`, `hasGroundId`, `hasEventId`, `hasUserId`, `hasToken`, `canQuoteSlot`, `canRateVenue`, `canCreateEvent` |
| Response hooks | `afterResponse: "name"` | `checkSuccess` (validates the `{success, statusCode, message, data}` envelope), `pickOpenSlot` |

Three things worth knowing before you edit it:

- **Payloads are objects, never `JSON.stringify()` strings.** Artillery's `json:` serialises
  what it is given; a string gets double-encoded and the API answers 400.
- **Guards exist because seeded data varies.** An empty venue table would otherwise turn
  every dependent request into a 400/404 and bury the real signal. A step whose id was never
  captured is skipped rather than sent.
- **`pickOpenSlot` reads the availability grid** to choose a slot the turf is actually open
  for. Each turf has its own opening hours, so a hardcoded slot earns a correct-but-useless
  409 from `/bookings/quote`.

Payload field names mirror the controllers exactly, including two easy traps:
`createEvent` destructures **`min_Players`** (capital P), and its **`current_players` is an
array** of `{ value: <user id> }` for the hand-picked starting squad, not a count.

## Customization

### Changing the base URL

```bash
npm run smoke:prod                                    # use targets/prod.yml
artillery run --config targets/local.yml \
  --overrides '{"config":{"target":"https://staging.example.com/api/v1"}}' smoke-test.yml
```

### Changing load levels

Edit `phases` in the test file, or override without editing:

```bash
artillery run --config targets/local.yml \
  --overrides '{"config":{"phases":[{"duration":30,"arrivalRate":5}]}}' load-test.yml
```

That override form is also the quickest way to sanity-check a change to a long test without
sitting through the full 30-minute soak.

### Adding a new endpoint

1. Add a request step to the relevant test file.
2. If it needs auth: `headers: { authorization: "Bearer {{ token }}" }`.
3. If it depends on a captured id, add `ifTrue:` with a guard so it is skipped when the id
   is missing rather than failing.
4. If it needs a body, add a generator to `helpers.js` that assigns a plain **object**.
5. Add `expect:` blocks in `smoke-test.yml` to pin the response shape.

## Troubleshooting

### `errors.ECONNREFUSED`

The backend isn't running:

```bash
cd backend-engine/backend && npm run dev
```

### Lots of `http.codes.429`

The rate-limit bypass isn't working. Check that `LOAD_TEST_BYPASS_TOKEN` is set on the
**backend** `.env`, is at least 32 characters, is exported in the **shell running the test**,
and that the two values match. The backend logs a warning at boot when the bypass is live:

```
⚠ RATE LIMIT BYPASS ENABLED — requests carrying a valid x-loadtest-token header ...
```

No warning means the backend never enabled it.

### `401 Unauthorized` on authenticated routes

Register or login failed, so no token was captured. Check that the backend's
`ACCESS_TOKEN_SECRET` is set, and that the register payload still matches the controller
(`docs/api-guideline.md`). Note register returns the user flat on `data` (`data.accessToken`,
`data.id`) while login nests it (`data.user.accessToken`).

### `409 Conflict` on register

Email or phone already exists. The helpers generate a unique email (uuid + timestamp) and a
random phone per VU, so this should be rare; a burst of them means the generator changed or
the same payload is being replayed.

### Prisma connection errors

```
Invalid `prisma.$transaction()` invocation: ... connection pool timeout
```

The pool is exhausted. Raise `PG_CONNECTION_LIMIT` in `backend/.env` for the test session —
the default of 2 per replica is deliberately tight for production and far too tight for load
testing. See `docs/api-guideline.md` → Database connections.

## Best Practices

1. **Run smoke tests in CI/CD.** `npm run smoke` exits non-zero on a threshold breach, so a
   broken API never reaches production.
2. **Benchmark before and after.** Run `npm run load`, make the change, run it again, compare.
3. **Don't load test production.** The `:prod` scripts exist for smoke checks. `stress` or
   `soak` against production will exhaust the connection pool and degrade real users.
4. **Isolate the database.** These tests write real rows (users, events, ratings). Use a
   dedicated test database or restore a snapshot between sessions.
5. **Monitor during the test.** Watch backend logs and process memory. If your own machine
   saturates, you are measuring your laptop — lower the rate or add `think:` delays.
6. **Test from outside your network** for stress and soak. Local latency is unrealistically
   low and hides slow queries that remote users would feel.

---

*Built with [Artillery](https://www.artillery.io) — the load testing tool for modern applications.*
