import "dotenv/config"
import { createServer } from "http";
import { app } from "./app.js";
import { initSocket, getIo } from "./socket.js";
import { startHoldSweeper } from "./jobs/holdSweeper.js";
import { startEventSweeper } from "./jobs/eventSweeper.js";
import { disconnectPrisma, pgClient } from "./prisma.js";
import { logger } from "../logs/logger.js";

const PORT = process.env.PORT || 8080;

// Wrap express in a raw HTTP server so Socket.IO can share the same port.
const server = createServer(app);

// Health endpoint — checks DB connectivity so load balancers / orchestrators
// see a real failure, not a process that is listening but cannot serve.
app.get('/health', async (req, res) => {
  try {
    await pgClient.$queryRaw`SELECT 1`;
    res.status(200).send('OK');
  } catch {
    res.status(503).send('DB unavailable');
  }
});

// Attach the real-time layer (JWT-authed notification sockets).
initSocket(server);

// Reap expired unpaid booking holds in the background.
startHoldSweeper();

// Auto-complete games whose slot has ended.
startEventSweeper();

// Bootstrap — verify the database is reachable before accepting traffic.
// A deploy with a bad connection string, rotated credentials or a still-
// restarting Postgres will fail here instead of passing health probes and
// serving 500s to every real request.
async function main() {
  try {
    await pgClient.$connect();
    logger.info("postgres connected — starting server");
  } catch (err) {
    logger.error(`postgres connection failed: ${err.message}`);
    process.exit(1);
  }

  server.listen(PORT, '0.0.0.0', () => console.log('up on', PORT));
}

main();

/**
 * Graceful shutdown.
 *
 * Render (and `docker compose down`) stop a container by sending SIGTERM and
 * killing it hard some seconds later. Without a handler the process dies with
 * its PostgreSQL connections still open, and the database only reclaims them
 * when its own timeout fires — so during a rolling deploy the retiring replica
 * and its replacement hold connections AT THE SAME TIME. On a 17-connection
 * budget shared by three replicas (see prisma.js) that overlap is enough to
 * exhaust the server. Closing the pool explicitly removes the overlap.
 *
 * Order matters: stop accepting new work, then drop the connections.
 */
let shuttingDown = false;

async function shutdown(signal) {
    // A second SIGTERM (or SIGINT from an impatient Ctrl-C) must not start a
    // parallel teardown while the first is still draining.
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received — shutting down`);

    // Force-exit guard: if a hung socket or in-flight query stops `close()` from
    // ever calling back, the platform's own kill timer is far less graceful.
    const forceExit = setTimeout(() => {
        logger.error("shutdown timed out after 10s — forcing exit");
        process.exit(1);
    }, 10_000);
    forceExit.unref?.();

    try {
        // `getIo` throws if the socket layer never came up — that is not a
        // reason to skip releasing the database pool below.
        try {
            getIo().close(); // hang up live sockets
        } catch {
            /* socket layer not initialized */
        }

        await new Promise((resolve) => server.close(resolve)); // finish in-flight HTTP
        await disconnectPrisma();                          // release the DB pool
        logger.info("shutdown complete");
        process.exit(0);
    } catch (err) {
        logger.error(`shutdown failed: ${err.message}`);
        process.exit(1);
    }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
