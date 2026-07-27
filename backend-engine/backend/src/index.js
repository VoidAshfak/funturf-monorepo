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

// --- Global error handlers ---
// Without these, Node >=15 crashes the process on any unhandled rejection
// with no useful log message, and a replica disappears silently.

process.on("unhandledRejection", (reason) => {
    logger.error(`unhandledRejection: ${reason instanceof Error ? reason.message : reason}`);
});

process.on("uncaughtException", (err) => {
    logger.error(`uncaughtException: ${err.message}`);
    // Re-throw so the process exits with a non-zero code — the process state
    // may be corrupted after an uncaught exception, and running is unsafe.
    // The logger flush + exit happens in the default handler after this.
    // We do NOT call shutdown() here because the corrupted state could hang it.
    process.exit(1);
});

// --- Graceful shutdown ---
// The platform (Render, Docker, K8s) sends SIGTERM then a hard kill after its
// own grace period (~30s). Our job is to release resources, not to race the
// kill timer with process.exit(). Letting the event loop drain naturally is
// safer: in-flight DB transactions finish, Prisma disconnects cleanly, and
// the process dies when nothing keeps it alive.

let shuttingDown = false;

async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received — shutting down`);

    // Stop accepting new connections. In-flight requests finish; the platform's
    // own kill timer will force-exit if anything hangs past its grace period.
    server.close(() => {
        logger.info("http server closed");
    });

    try {
        getIo().close();
    } catch {
        /* socket layer not initialized */
    }

    try {
        await disconnectPrisma();
        logger.info("shutdown complete");
    } catch (err) {
        logger.error(`shutdown failed: ${err.message}`);
    }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
