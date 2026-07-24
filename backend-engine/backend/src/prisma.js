import { PrismaClient as MongoClient } from "./generated/prisma/mongo/client.js";
import { PrismaClient as PostgresClient, Prisma } from "./generated/prisma/pg/client.js";
import { logger } from "../logs/logger.js";

/**
 * Prisma clients — created once per process and shared by every controller.
 *
 * CONNECTION POOLING
 * Prisma keeps its own pool of PostgreSQL connections per PrismaClient. Left
 * unconfigured that pool is `num_physical_cpus * 2 + 1`, sized for a machine
 * that owns its database. This API does not: it runs as THREE replicas
 * (app1/2/3 behind nginx — see render.yaml / docker-compose.yml) against one
 * small managed Postgres, and a container reports the HOST's cpu count, so each
 * replica was happily opening 9–17 connections. The managed instance allows:
 *
 *     max_connections               20
 *     superuser_reserved_connections 3
 *     ---------------------------------
 *     usable by this app            17
 *
 * One replica could therefore exhaust the server on its own, and the next
 * connection attempt — from any replica, psql, or a migration — died with
 * "FATAL: remaining connection slots are reserved for roles with the SUPERUSER
 * attribute". Hence an explicit, deliberately small per-replica limit.
 *
 * THE BUDGET (why the default is 2)
 *   3 replicas x 2                      =  6 steady state
 *   x2 during a rolling deploy, when the
 *   old container is still up            = 12 worst case
 *   + pgAdmin / psql / prisma migrate    ~ 15
 *                                          -- still under 17.
 *
 * Raise PG_CONNECTION_LIMIT if the replica count drops or the plan grows; the
 * rule from Prisma's docs is (pool size) / (number of app instances). If you
 * ever put a real pooler in front (Aiven's built-in PgBouncer, PgBouncer of your
 * own, Prisma Accelerate), point the URL at the pooler and raise this — the
 * pooler then owns the real connections and this becomes a client-side cap.
 */
const POOL_SETTINGS = {
    // Max concurrent PostgreSQL connections THIS process may hold.
    connection_limit: process.env.PG_CONNECTION_LIMIT || "2",
    // Seconds a query waits for a free connection from the pool before failing
    // with P2024. Queueing briefly is much better than hammering the server.
    pool_timeout: process.env.PG_POOL_TIMEOUT || "20",
    // Seconds to wait for the initial TCP/TLS connect before giving up.
    connect_timeout: process.env.PG_CONNECT_TIMEOUT || "10",
};

/**
 * Append the pool parameters to a database URL without touching anything else.
 *
 * Done by string surgery rather than `new URL()` on purpose: the WHATWG parser
 * re-encodes userinfo, which would corrupt a password containing reserved
 * characters and turn a pooling change into an auth failure. Any parameter
 * already present in the URL wins, so an operator can override a single value
 * straight from the connection string.
 */
function withPoolParams(rawUrl) {
    if (!rawUrl) return rawUrl;

    const [base, existingQuery = ""] = rawUrl.split("?");
    const params = new URLSearchParams(existingQuery);

    for (const [key, value] of Object.entries(POOL_SETTINGS)) {
        if (!params.has(key)) params.set(key, String(value));
    }
    return `${base}?${params.toString()}`;
}

const pgUrl = withPoolParams(process.env.POSTGRESQL_DATABASE_URL);

/**
 * Reuse the client across module reloads.
 *
 * `import` caching already gives one instance per process, but nodemon and any
 * future hot-reload path re-evaluate modules in the SAME process — each reload
 * would then build a fresh pool while the old one still holds its connections.
 * On a 17-connection budget that is enough to exhaust the server by saving a
 * file a few times.
 */
const globalForPrisma = globalThis;

const pgClient =
    globalForPrisma.__funturfPgClient ??
    new PostgresClient(pgUrl ? { datasources: { db: { url: pgUrl } } } : {});

// `mongoClient` is DEPRECATED — see CLAUDE.md. Kept only for the legacy paths in
// user.controller.js / turfmate.controller.js. Write new code against pgClient.
const mongoClient = globalForPrisma.__funturfMongoClient ?? new MongoClient();

globalForPrisma.__funturfPgClient = pgClient;
globalForPrisma.__funturfMongoClient = mongoClient;

if (!pgUrl) {
    // Not fatal here — Prisma will read the datasource env var itself and fail
    // with its own message — but the pool caps above are then NOT applied.
    logger.warn(
        "POSTGRESQL_DATABASE_URL is not set; connection pool limits could not be applied"
    );
} else {
    // Checkpoint log: the single most useful line when connection errors return.
    // Never log the URL itself — it carries credentials.
    logger.info(
        `postgres pool: connection_limit=${POOL_SETTINGS.connection_limit} ` +
        `pool_timeout=${POOL_SETTINGS.pool_timeout}s connect_timeout=${POOL_SETTINGS.connect_timeout}s`
    );
}

/**
 * Release every database connection this process holds.
 *
 * Called from the shutdown handler in index.js. Without it, a replaced replica
 * keeps its sockets open until the server's own timeout reaps them, so a rolling
 * deploy briefly needs DOUBLE the budget above — exactly when three containers
 * are restarting at once.
 */
export async function disconnectPrisma() {
    const results = await Promise.allSettled([
        pgClient.$disconnect(),
        mongoClient.$disconnect(),
    ]);

    for (const result of results) {
        if (result.status === "rejected") {
            logger.error(`prisma disconnect failed: ${result.reason?.message ?? result.reason}`);
        }
    }
    logger.info("prisma clients disconnected");
}

export {
    mongoClient,
    pgClient,
    // Prisma namespace (pg) — needed for building parameterised raw SQL with
    // Prisma.sql / Prisma.join / Prisma.empty (e.g. the events ranking query).
    Prisma,
};
