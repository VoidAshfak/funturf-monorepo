import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";
import swaggerUi from "swagger-ui-express";
import { docsLimiter } from "../middlewares/rateLimit.middleware.js";
import { logger } from "../../logs/logger.js";

/**
 * Swagger UI for the FunTurf API.
 *
 * The spec itself is HAND-WRITTEN and lives at `backend/docs/openapi.yaml` — it
 * is the source of truth, not a generated artifact. Nothing here rewrites it;
 * we only read it and serve it.
 *
 * WHY the spec lives under `backend/` and not at the umbrella repo root:
 * `render.yaml` builds each API replica with `rootDir: ./backend`, and the
 * Dockerfile does `COPY . .` from that directory. Anything outside `backend/`
 * simply does not exist at build time. Keep the spec here or the image ships
 * without it.
 *
 * WHY docs are off in production by default: a full endpoint/param/error-code
 * inventory is a free reconnaissance map for an attacker. FunTurf is not a
 * public/partner API, so the docs exist for developers, and developers run
 * locally or against the docker-compose cluster. Set `DOCS_ENABLED=true` to
 * override deliberately (see `isDocsEnabled`).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// src/utils/ -> backend/docs/openapi.yaml
const SPEC_PATH = path.join(__dirname, "..", "..", "docs", "openapi.yaml");

// Mounted under /api/v1 so the docs travel with the API through nginx, which
// proxies `location /` to the backend upstream — no proxy rule to maintain.
const DOCS_ROUTE = "/api/v1/docs";
const SPEC_ROUTE = "/api/v1/docs.json";

/**
 * Is the docs endpoint allowed to mount?
 *
 * `DOCS_ENABLED` wins when set explicitly ("true"/"false"). Unset, it defaults
 * to ON everywhere EXCEPT production — so a dev clone gets docs with zero
 * config, and a prod deploy has to opt in on purpose.
 */
export const isDocsEnabled = () => {
    const flag = process.env.DOCS_ENABLED?.trim().toLowerCase();
    if (flag === "true") return true;
    if (flag === "false") return false;
    return process.env.NODE_ENV !== "production";
};

/**
 * Read + parse the OpenAPI spec from disk.
 *
 * Done ONCE at mount time, never per-request: the spec is ~9k lines, and
 * re-reading it on every hit would turn the docs route into a cheap way to
 * burn server CPU and disk I/O.
 *
 * Returns null (rather than throwing) when the spec is missing or malformed —
 * see `mountDocs` for why that must not be fatal.
 */
const loadSpec = () => {
    try {
        const raw = fs.readFileSync(SPEC_PATH, "utf8");
        const spec = parseYaml(raw);

        // A YAML file can parse cleanly and still not be an OpenAPI document
        // (e.g. truncated to a bare string). Check the one field that proves it.
        if (!spec?.openapi) {
            logger.error(`Swagger: ${SPEC_PATH} parsed but has no "openapi" version field — not mounting docs`);
            return null;
        }

        const pathCount = Object.keys(spec.paths ?? {}).length;
        logger.info(`Swagger: loaded OpenAPI ${spec.openapi} spec — ${pathCount} paths`);
        return spec;
    } catch (error) {
        logger.error(`Swagger: could not load spec at ${SPEC_PATH} — ${error.message}`);
        return null;
    }
};

const swaggerUiOptions = {
    // Keep the Bearer token across page reloads. Without this, every reload
    // means pasting the token again to use "Try it out".
    swaggerOptions: {
        persistAuthorization: true,
        // Collapse the tag sections on load — 75 paths fully expanded is
        // unreadable.
        docExpansion: "none",
        filter: true,
    },
    customSiteTitle: "FunTurf API docs",
};

/**
 * Mount Swagger UI and the raw spec onto the express app.
 *
 * Call BEFORE `errorHandler` in `app.js` (that middleware is terminal).
 *
 * Failure to load the spec is logged and skipped, NOT thrown: documentation is
 * not worth taking the API down for. A replica that can serve bookings but not
 * docs is strictly better than one that serves neither.
 */
export const mountDocs = (app) => {
    if (!isDocsEnabled()) {
        logger.info(`Swagger: docs disabled (NODE_ENV=${process.env.NODE_ENV ?? "unset"}, DOCS_ENABLED=${process.env.DOCS_ENABLED ?? "unset"}) — ${DOCS_ROUTE} not mounted`);
        return;
    }

    const spec = loadSpec();
    if (!spec) return; // loadSpec already logged the reason.

    // Raw spec, for client codegen / Postman import / CI contract checks.
    app.get(SPEC_ROUTE, docsLimiter, (_req, res) => res.json(spec));

    // The interactive UI.
    app.use(DOCS_ROUTE, docsLimiter, swaggerUi.serve, swaggerUi.setup(spec, swaggerUiOptions));

    logger.info(`Swagger: docs mounted at ${DOCS_ROUTE} (raw spec at ${SPEC_ROUTE})`);
};
