#!/usr/bin/env node
/**
 * Print a readable summary of an Artillery JSON run.
 *
 * Why this exists: `artillery report` (which turned a JSON log into an HTML
 * page) was REMOVED in Artillery v2 — the command still exists but only prints a
 * deprecation notice, and the official replacement is the hosted Artillery
 * Cloud dashboard. This script keeps a local, offline way to read a run.
 *
 * Usage:
 *   node scripts/summarize.js [path-to-report.json]
 *
 * Defaults to ./artillery-report.json, which is what the npm scripts write via
 * `artillery run --output`.
 *
 * Exit code is 0 for a readable report and 1 when the file is missing or
 * unparseable — it deliberately does NOT fail on a bad run, because pass/fail is
 * the `ensure` plugin's job and it already sets the exit code of `artillery run`.
 */

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_REPORT = path.join(__dirname, '..', 'artillery-report.json');
const reportPath = path.resolve(process.argv[2] || DEFAULT_REPORT);

if (!fs.existsSync(reportPath)) {
  console.error(`No report at ${reportPath}`);
  console.error('Run a test first — e.g. `npm run smoke` — then re-run this.');
  process.exit(1);
}

let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
} catch (err) {
  console.error(`Could not parse ${reportPath}: ${err.message}`);
  process.exit(1);
}

const aggregate = report.aggregate || {};
const counters = aggregate.counters || {};
const summaries = aggregate.summaries || {};
const rates = aggregate.rates || {};

// ── Small formatting helpers ────────────────────────────────────────────────

const line = (char = '─') => console.log(char.repeat(72));
const heading = (text) => {
  console.log('');
  console.log(text);
  line();
};
/** Right-pad so columns line up regardless of label length. */
const pad = (text, width) => String(text).padEnd(width);
const ms = (value) => (value == null ? '—' : `${Math.round(value)}ms`);

/** Sum every counter whose key starts with `prefix`. */
const sumByPrefix = (prefix) =>
  Object.entries(counters)
    .filter(([key]) => key.startsWith(prefix))
    .reduce((total, [, value]) => total + value, 0);

// ── Overview ────────────────────────────────────────────────────────────────

const requests = counters['http.requests'] || 0;
const responses = counters['http.responses'] || 0;
const vusersCreated = counters['vusers.created'] || 0;
const vusersFailed = counters['vusers.failed'] || 0;
const durationSec =
  aggregate.firstCounterAt && aggregate.lastCounterAt
    ? (aggregate.lastCounterAt - aggregate.firstCounterAt) / 1000
    : null;

// Everything under `errors.*` is a transport-level failure (ECONNREFUSED,
// ETIMEDOUT, ...) — these never produced an HTTP status at all.
const transportErrors = sumByPrefix('errors.');
// 4xx and 5xx responses did reach the server; count them separately, because
// the two failure modes point at completely different problems.
const clientErrors = sumByPrefix('http.codes.4');
const serverErrors = sumByPrefix('http.codes.5');
const failed = transportErrors + clientErrors + serverErrors;
const errorRate = responses + transportErrors > 0
  ? (failed / (responses + transportErrors)) * 100
  : 0;

console.log('');
line('═');
console.log(`  FunTurf load test summary — ${path.basename(reportPath)}`);
line('═');

heading('Overview');
console.log(`  ${pad('Duration', 24)} ${durationSec ? `${durationSec.toFixed(1)}s` : '—'}`);
console.log(`  ${pad('Virtual users', 24)} ${vusersCreated} created, ${vusersFailed} failed`);
console.log(`  ${pad('Requests', 24)} ${requests}`);
console.log(`  ${pad('Responses', 24)} ${responses}`);
if (rates['http.request_rate'] != null) {
  console.log(`  ${pad('Throughput', 24)} ${rates['http.request_rate']} req/sec`);
}
console.log(`  ${pad('Error rate', 24)} ${errorRate.toFixed(2)}%`);

// ── Latency ─────────────────────────────────────────────────────────────────

const responseTime = summaries['http.response_time'];
if (responseTime) {
  heading('Latency (http.response_time)');
  console.log(
    `  ${pad('min', 8)}${pad('p50', 10)}${pad('p75', 10)}${pad('p95', 10)}${pad('p99', 10)}${pad('max', 10)}`
  );
  console.log(
    `  ${pad(ms(responseTime.min), 8)}${pad(ms(responseTime.p50 ?? responseTime.median), 10)}` +
      `${pad(ms(responseTime.p75), 10)}${pad(ms(responseTime.p95), 10)}` +
      `${pad(ms(responseTime.p99), 10)}${pad(ms(responseTime.max), 10)}`
  );
}

// ── Status codes ────────────────────────────────────────────────────────────

const codeEntries = Object.entries(counters)
  .filter(([key]) => key.startsWith('http.codes.'))
  .map(([key, value]) => [key.replace('http.codes.', ''), value])
  .sort((a, b) => Number(a[0]) - Number(b[0]));

if (codeEntries.length) {
  heading('HTTP status codes');
  for (const [code, count] of codeEntries) {
    // 429 gets called out: on this API it almost always means the rate-limit
    // bypass token is missing rather than that the service is overloaded.
    const note =
      code === '429'
        ? '  ← rate limited (is LOAD_TEST_BYPASS_TOKEN set on BOTH sides?)'
        : '';
    console.log(`  ${pad(code, 8)} ${pad(count, 10)}${note}`);
  }
}

// ── Transport errors ────────────────────────────────────────────────────────

const errorEntries = Object.entries(counters).filter(([key]) => key.startsWith('errors.'));
if (errorEntries.length) {
  heading('Errors (no HTTP response)');
  for (const [key, count] of errorEntries) {
    const name = key.replace('errors.', '');
    const note =
      name === 'ECONNREFUSED' ? '  ← backend not running?' : '';
    console.log(`  ${pad(name, 28)} ${pad(count, 8)}${note}`);
  }
}

// ── Envelope validation (emitted by checkSuccess in helpers.js) ─────────────

if (counters['envelope.invalid'] || counters['envelope.unparseable']) {
  heading('Response envelope problems');
  console.log(`  ${pad('valid', 20)} ${counters['envelope.valid'] || 0}`);
  console.log(`  ${pad('success !== true', 20)} ${counters['envelope.invalid'] || 0}`);
  console.log(`  ${pad('unparseable', 20)} ${counters['envelope.unparseable'] || 0}`);
}

// ── Per-endpoint breakdown (metrics-by-endpoint plugin) ─────────────────────

const ENDPOINT_PREFIX = 'plugins.metrics-by-endpoint.response_time.';
const endpointSummaries = Object.entries(summaries)
  .filter(([key]) => key.startsWith(ENDPOINT_PREFIX))
  .map(([key, value]) => [key.replace(ENDPOINT_PREFIX, ''), value])
  // Slowest first — the top row is where to start investigating.
  .sort((a, b) => (b[1].p95 || 0) - (a[1].p95 || 0));

if (endpointSummaries.length) {
  heading('Slowest endpoints (p95)');
  console.log(`  ${pad('endpoint', 46)}${pad('p95', 10)}${pad('count', 8)}`);
  for (const [endpoint, stats] of endpointSummaries) {
    console.log(
      `  ${pad(endpoint.slice(0, 44), 46)}${pad(ms(stats.p95), 10)}${pad(stats.count, 8)}`
    );
  }
} else {
  console.log('');
  console.log('  (No per-endpoint breakdown — enable the metrics-by-endpoint plugin.)');
}

console.log('');
line('═');
console.log('  Reading this: p95 is the number users feel. A p95 that climbs');
console.log('  across a soak run points at a leak; a sudden error-rate jump');
console.log('  points at a limit being hit (pool, rate limiter, or a crash).');
line('═');
console.log('');
