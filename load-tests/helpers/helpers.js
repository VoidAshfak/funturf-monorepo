/**
 * Helper functions for FunTurf load tests.
 *
 * Artillery loads this file via the `processor` config property. Every export
 * becomes callable from a YAML flow as `- function: "<name>"`.
 *
 * ── Two kinds of export ──────────────────────────────────────────────────────
 *
 *  1. Flow functions — `(context, events, done)`. They read/write
 *     `context.vars`, which is what `{{ mustache }}` placeholders in the YAML
 *     resolve against. Always call `done()`.
 *
 *  2. `ifTrue` predicates — `(vars) => boolean`. Artillery looks up the string
 *     given to a step's `ifTrue:` on the processor FIRST, and only falls back to
 *     parsing it as a filtrex expression if there is no such export. Exporting
 *     them keeps the "skip this step when we never captured an id" logic in JS
 *     where it can be read and tested, instead of in an expression language.
 *
 * ── Payloads are OBJECTS, never JSON strings ─────────────────────────────────
 * Artillery's `json:` field serialises whatever it is given. Handing it a string
 * produced by JSON.stringify() double-encodes the body — the API then receives a
 * quoted string where it expected an object and rejects it with a 400. Every
 * generator below therefore assigns a plain JS object.
 *
 * ── Payload shapes are pinned to the real API ────────────────────────────────
 * Field names here mirror the backend controllers exactly (including the
 * inconsistent `min_Players` capitalisation that `createEvent` destructures, and
 * `password_hash` carrying the PLAINTEXT password — the `encryptPassword`
 * middleware hashes it in place). Changing a controller's expected body means
 * changing the matching generator here.
 */

// ────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────────────────────────────────

// `events.sport_type` is a free-text varchar, not an enum — these are just the
// values the app actually uses.
const SPORTS = ['football', 'cricket', 'badminton', 'basketball', 'tennis'];

// Must be members of the `event_type` enum (prisma/postgresql/schema.prisma).
// "casual" is NOT one of them and makes the insert fail.
const EVENT_TYPES = ['friendly', 'practice', 'pickup'];

// Must be members of the `skill_level_type` enum.
const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'any'];

// The fixed 90-minute slot grid used by the booking endpoints.
const SLOT_CODES = [
  't0600', 't0730', 't0900', 't1030',
  't1200', 't1330', 't1500', 't1630',
  't1800', 't1930', 't2100', 't2230',
  't0000', 't0130', 't0300', 't0430',
];

// Every virtual user registers with this password and logs in with it again.
const TEST_PASSWORD = 'TestPass123!';

// ────────────────────────────────────────────────────────────────────────────
// SMALL UTILITIES (not exported as flow functions)
// ────────────────────────────────────────────────────────────────────────────

/** Pick a random element from an array. */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** A date `daysFromNow` days ahead, as YYYY-MM-DD. */
function futureDate(daysFromNow = 1) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

/**
 * True when `value` looks like a UUID.
 *
 * Used by the `ifTrue` guards. A capture that found nothing leaves the variable
 * either undefined or as the literal template string (`"{{ venueId }}"`), and
 * both must count as "no id". Sending either to the API produces a 400/404 that
 * pollutes the error rate with a defect in the TEST, not in the service.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** A unique email per virtual user, so registration never collides. */
function uniqueEmail(vars) {
  const idx = vars.$uuid || Math.floor(Math.random() * 1e9);
  return `loadtest_${idx}_${Date.now()}@funturf.test`;
}

// ────────────────────────────────────────────────────────────────────────────
// AUTH
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build a fresh registration payload for this virtual user.
 *
 * Call BEFORE the POST /users/register step. Sets:
 *   - registerPayload  → body for POST /users/register
 *   - registerEmail    → email to log in with afterwards
 *   - registerPassword → password to log in with afterwards
 *
 * NOTE: `password_hash` carries the PLAINTEXT password on purpose. The
 * `encryptPassword` middleware on the register route bcrypts `req.body
 * .password_hash` in place before the controller sees it.
 */
function registerAndLogin(context, events, done) {
  const { vars } = context;
  const email = uniqueEmail(vars);

  vars.registerPayload = {
    first_name: 'LoadTest',
    last_name: 'User',
    email,
    password_hash: TEST_PASSWORD,
    // Unique per user: `phone` is individually unique in the DB, so a repeated
    // number collides and the register returns 409 instead of 201.
    phone: `+8801${String(Math.floor(100000000 + Math.random() * 900000000))}`,
    // Full ISO-8601 datetime, NOT a bare "1995-06-15". The column is a Prisma
    // DateTime and the controller passes the value straight through, so a
    // date-only string is rejected at the driver with
    // "premature end of input. Expected ISO-8601 DateTime".
    date_of_birth: '1995-06-15T00:00:00.000Z',
    gender: 'male',
    division: 'Dhaka',
    district: 'Dhaka',
    user_type: 'player',
  };

  vars.registerEmail = email;
  vars.registerPassword = TEST_PASSWORD;

  return done();
}

// ────────────────────────────────────────────────────────────────────────────
// DATE / QUERY-PARAM HELPERS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Set `bookingDate` to tomorrow (YYYY-MM-DD).
 *
 * The availability and quote endpoints take a DATE. Artillery's built-in
 * `$isoTimestamp` is a full ISO-8601 timestamp and is rejected, so every
 * `?date=` / `?booking_date=` uses this variable instead.
 *
 * `slotCode` is seeded with a mid-evening default so a flow that quotes without
 * first reading the grid still sends something valid; `pickOpenSlot` overwrites
 * it with a genuinely open slot whenever the grid has been fetched.
 */
function setBookingDate(context, events, done) {
  context.vars.bookingDate = futureDate(1);
  context.vars.slotCode = 't1800';
  return done();
}

/**
 * Choose a slot the turf is actually OPEN for, from the availability response.
 *
 * Attach as `afterResponse` on GET /bookings/available-slots.
 *
 * Why this is not just `pick(SLOT_CODES)`: the slot grid is fixed at 16 codes,
 * but each turf has its own opening hours and the grid masks the rest. A seeded
 * turf open 06:00–02:00 closes t0130/t0300/t0430, so blind picking sent an
 * out-of-hours slot to /bookings/quote roughly 1 request in 6 and got a
 * perfectly correct 409 back. Those 409s are the TEST's fault, and they inflate
 * the error rate that the run is supposed to be measuring.
 *
 * The response body carries one boolean per slot code plus a `closed_slots`
 * list, so the open-and-free set is derivable directly from it.
 */
function pickOpenSlot(requestParams, response, context, events, done) {
  const { vars } = context;

  try {
    const body =
      typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
    const grid = body && body.data;

    if (grid) {
      const closed = new Set(grid.closed_slots || []);
      // `true` means bookable; anything closed is excluded even if the flag says
      // true, since the quote endpoint rejects on opening hours independently.
      const open = SLOT_CODES.filter((code) => grid[code] === true && !closed.has(code));

      vars.slotCode = open.length ? pick(open) : null;
      vars.hasOpenSlotFlag = open.length > 0;
      return done();
    }
  } catch {
    /* fall through to the no-slot case below */
  }

  vars.slotCode = null;
  vars.hasOpenSlotFlag = false;
  return done();
}

// ────────────────────────────────────────────────────────────────────────────
// PAYLOAD GENERATORS
// ────────────────────────────────────────────────────────────────────────────

/** Rating payload for POST /venues/:venue_id/rating. Score must be an int 1–5. */
function generateRating(context, events, done) {
  const { vars } = context;
  const rating = Math.floor(Math.random() * 5) + 1;
  vars.ratingPayload = {
    rating,
    comment: rating >= 4 ? 'Great turf!' : 'Needs improvement.',
    title: 'Load test review',
  };
  return done();
}

/** Booking payload for POST /bookings/create. Requires `groundId`. */
function generateBooking(context, events, done) {
  const { vars } = context;
  vars.bookingPayload = {
    ground_id: vars.groundId,
    booking_date: futureDate(1),
    slot: vars.slotCode || pick(SLOT_CODES),
    paid: false,
    notes: 'Load test booking',
  };
  return done();
}

/**
 * Event payload for POST /events/create-event.
 *
 * Every field in the controller's required set must be present or it throws a
 * validation error before touching the DB:
 *   title, sport_type, event_type, max_players, min_Players, current_players,
 *   skill_level_required, total_cost, cost_split_type
 *
 * Two shapes are easy to get wrong:
 *   - `min_Players` — capital P, matching the controller's destructure.
 *   - `current_players` — an ARRAY of `{ value: <user id> }` for the hand-picked
 *     starting squad, NOT a count. The controller does `.length + 1` (the
 *     organizer plays too) and `.map()`s it into participant rows. An empty
 *     array is valid and means "just me".
 *
 * Without a `booking_id`, the date/time and venue/ground come from the body, so
 * `venueId`/`groundId` must have been captured from GET /venues first.
 */
function generateEvent(context, events, done) {
  const { vars } = context;
  vars.eventPayload = {
    title: `Load Test Match ${Date.now()}`,
    description: 'Auto-generated match for load testing.',
    sport_type: pick(SPORTS),
    event_type: pick(EVENT_TYPES),
    event_date: futureDate(1),
    start_time: '18:00',
    end_time: '19:30',
    venue_id: vars.venueId,
    ground_id: vars.groundId,
    max_players: 10,
    min_Players: 2,
    current_players: [], // organizer only — no hand-picked squad
    skill_level_required: pick(SKILL_LEVELS),
    total_cost: 3000,
    cost_split_type: 'equal',
  };
  return done();
}

/** Profile patch payload for PATCH /users/me. */
function generateProfileUpdate(context, events, done) {
  const { vars } = context;
  vars.profileUpdatePayload = {
    bio: `Load test bio updated at ${Date.now()}`,
    division: 'Dhaka',
    district: pick(['Dhaka', 'Gazipur', 'Narayanganj']),
  };
  return done();
}

// ────────────────────────────────────────────────────────────────────────────
// STEP GUARDS  (used as `ifTrue: "<name>"`)
// ────────────────────────────────────────────────────────────────────────────
// A guard runs a step only when the id it needs was actually captured. Seeded
// data varies between environments — an empty venue table would otherwise turn
// every dependent request into a 400/404 and bury the real results.

const hasVenueId = (vars) => isUuid(vars.venueId);
const hasGroundId = (vars) => isUuid(vars.groundId);
const hasEventId = (vars) => isUuid(vars.eventId);
const hasUserId = (vars) => isUuid(vars.userId);
/** Auth steps: skip unless login actually handed us a token. */
const hasToken = (vars) => typeof vars.token === 'string' && vars.token.length > 20;
/** Price quote: needs a ground AND a slot the turf is actually open for. */
const canQuoteSlot = (vars) => hasGroundId(vars) && vars.hasOpenSlotFlag === true;
/** Writes that need both a token and a venue. */
const canRateVenue = (vars) => hasToken(vars) && hasVenueId(vars);
/** Event creation needs a token plus the venue/ground the match runs on. */
const canCreateEvent = (vars) => hasToken(vars) && hasVenueId(vars) && hasGroundId(vars);

// ────────────────────────────────────────────────────────────────────────────
// RESPONSE VALIDATION
// ────────────────────────────────────────────────────────────────────────────

/**
 * Verify a response carries the FunTurf success envelope
 * (`{ success, statusCode, message, data }`) and emit a counter for it.
 *
 * MUST be attached as `afterResponse: "checkSuccess"` on a request, NOT called
 * as a `- function:` step. A standalone flow step has no response attached to
 * its context, so calling it that way reports "no response" for every request.
 * Hence the 5-argument hook signature.
 *
 * The `expect` plugin already asserts status codes per step; this covers the
 * case the status code cannot catch — a 200 whose body says `success: false`.
 * Failures surface as the `envelope.invalid` counter in the summary instead of
 * aborting the flow, so one bad response doesn't hide the rest of the run.
 */
function checkSuccess(requestParams, response, context, events, done) {
  const { vars } = context;

  if (!response) {
    vars.validationError = 'No response received';
    events.emit('counter', 'envelope.invalid', 1);
    return done();
  }

  try {
    const body =
      typeof response.body === 'string' ? JSON.parse(response.body) : response.body;

    if (body && body.success === true) {
      vars.validationError = null;
      events.emit('counter', 'envelope.valid', 1);
    } else {
      vars.validationError = `Expected success=true, got ${body && body.success}. Body: ${JSON.stringify(body).slice(0, 200)}`;
      events.emit('counter', 'envelope.invalid', 1);
    }
  } catch (err) {
    vars.validationError = `Failed to parse response: ${err.message}`;
    events.emit('counter', 'envelope.unparseable', 1);
  }

  return done();
}

module.exports = {
  // flow functions
  registerAndLogin,
  setBookingDate,
  pickOpenSlot,
  generateRating,
  generateBooking,
  generateEvent,
  generateProfileUpdate,
  checkSuccess,
  // ifTrue guards
  hasVenueId,
  hasGroundId,
  hasEventId,
  hasUserId,
  hasToken,
  canQuoteSlot,
  canRateVenue,
  canCreateEvent,
  // utilities (exported for reuse / unit checks)
  futureDate,
  isUuid,
};
