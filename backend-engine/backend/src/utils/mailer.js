import nodemailer from "nodemailer";
import { logger } from "../../logs/logger.js";

/**
 * Outbound email. Two transports, picked automatically:
 *
 *   1. HTTP API (production) — a plain HTTPS POST to the provider.
 *      Enabled by setting MAIL_API_KEY.
 *   2. SMTP (fine locally) — nodemailer over port 587/465. Enabled by SMTP_HOST.
 *   3. Neither — log-only dev mode, see below.
 *
 * WHY AN HTTP TRANSPORT EXISTS AT ALL
 * Render (our host) BLOCKS OUTBOUND TRAFFIC ON THE COMMON SMTP PORTS on free web
 * services — documented at https://render.com/docs/free. The connection is not
 * refused, it hangs until it times out, which looks like a broken relay:
 *
 *   mailer: FAILED to=… err=Connection timeout
 *
 * Most PaaS providers do the same to keep spammers off their IP ranges, so this
 * is not a Render quirk to wait out. Port 443 is never blocked, so the API path
 * is the one that actually works on a deployment. SMTP is kept because it is
 * handy locally (MailHog/Mailpit take no credentials) and because it keeps us one
 * env change away from any provider if we ever leave Brevo.
 *
 * CONFIG (backend/.env, and the Render dashboard for the deployed service):
 *   MAIL_API_KEY   Brevo API key, starts "xkeysib-"  <- NOT the SMTP key
 *                  (Brevo -> SMTP & API -> API Keys). Set this in production.
 *   MAIL_API_URL   override the endpoint; defaults to Brevo's transactional API
 *   SMTP_HOST      e.g. smtp-relay.brevo.com — used only when MAIL_API_KEY is unset
 *   SMTP_PORT      587 (STARTTLS, default) or 465 (implicit TLS)
 *   SMTP_USER      optional — omit for a local relay that takes no auth
 *   SMTP_PASS      optional — see above. Brevo's SMTP key starts "xsmtpsib-"
 *   MAIL_FROM      "FunTurf <no-reply@funturf.app>" — must be a sender the
 *                  provider has verified, or it rejects the message
 *   MAIL_REPLY_TO  optional support address
 *
 * DEV MODE: with neither transport configured every message is dumped to the log
 * instead, so a new developer can exercise the whole forgot-password flow with
 * zero credentials — copy the link out of the terminal. This is deliberately NOT
 * done when NODE_ENV=production: printing reset links into a production log file
 * would turn log access into account takeover.
 *
 * The local `.env` in this repo sets NODE_ENV=production even on a laptop (same
 * quirk that makes DOCS_ENABLED necessary for Swagger), so log-only mode has the
 * same style of explicit escape hatch: MAIL_DEV_LOG=true. NEVER set it on a real
 * deployment — it writes live reset links into the log.
 */

const MAIL_API_KEY = (process.env.MAIL_API_KEY ?? "").trim();
const MAIL_API_URL = (process.env.MAIL_API_URL ?? "https://api.brevo.com/v3/smtp/email").trim();

const SMTP_HOST = (process.env.SMTP_HOST ?? "").trim();
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = (process.env.SMTP_USER ?? "").trim();
const SMTP_PASS = process.env.SMTP_PASS ?? "";
const MAIL_FROM = (process.env.MAIL_FROM ?? "").trim() || "FunTurf <no-reply@funturf.app>";
const MAIL_REPLY_TO = (process.env.MAIL_REPLY_TO ?? "").trim();

/** Give up on the HTTP call rather than holding a socket open indefinitely. */
const API_TIMEOUT_MS = 15000;

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * May an undeliverable message have its BODY written to the log? Only outside
 * production, or when an operator explicitly opts in (see the note above about
 * this repo's local .env). Off by default in every other case.
 */
const DEV_LOG_ALLOWED = !IS_PRODUCTION || process.env.MAIL_DEV_LOG === "true";

/** HTTP API configured? Takes precedence over SMTP — it works everywhere. */
export const apiTransportEnabled = MAIL_API_KEY.length > 0;

/** SMTP configured? Only consulted when the API transport is not. */
export const smtpTransportEnabled = SMTP_HOST.length > 0;

/** True when mail can actually leave the process by either route. */
export const mailerEnabled = apiTransportEnabled || smtpTransportEnabled;

/**
 * Split "FunTurf <no-reply@funturf.app>" into the {name, email} shape the HTTP
 * API wants. A bare "no-reply@funturf.app" is also accepted (no display name).
 */
const parseAddress = (value) => {
    const match = /^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/.exec(value);
    if (match) return { name: match[1] || undefined, email: match[2] };
    return { email: value.trim() };
};

const FROM_ADDRESS = parseAddress(MAIL_FROM);

// --- SMTP transport ----------------------------------------------------------

// Built on first use, then reused. A pooled transporter holds its TCP/TLS
// connections open, so a burst of mail doesn't pay a fresh TLS handshake each
// time. maxConnections is small on purpose — this app sends transactional mail in
// ones and twos, and shared relays throttle aggressive senders.
let transporter = null;

const getTransporter = () => {
    if (!smtpTransportEnabled) return null;
    if (transporter) return transporter;

    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        // Port 465 is implicit TLS ("secure" from the first byte); 587 connects in
        // the clear and upgrades via STARTTLS. requireTLS makes that upgrade
        // mandatory, so we never fall back to sending credentials in plaintext.
        secure: SMTP_PORT === 465,
        requireTLS: SMTP_PORT !== 465,
        pool: true,
        maxConnections: 2,
        maxMessages: 100,
        // Auth is optional so a credential-less local relay (MailHog/Mailpit) works.
        ...(SMTP_USER ? { auth: { user: SMTP_USER, pass: SMTP_PASS } } : {}),
    });

    logger.info(
        `mailer: SMTP ${SMTP_HOST}:${SMTP_PORT} (${SMTP_PORT === 465 ? "implicit TLS" : "STARTTLS"}, auth=${SMTP_USER ? "on" : "off"})`
    );

    return transporter;
};

// --- boot-time reporting -----------------------------------------------------
// One line at startup saying exactly how mail will leave this process, so a
// misconfigured deploy is obvious in the first screen of logs.

if (apiTransportEnabled) {
    logger.info(`mailer: HTTP API transport -> ${MAIL_API_URL} (from ${FROM_ADDRESS.email})`);
    if (smtpTransportEnabled) {
        logger.info("mailer: SMTP_HOST is also set but unused — the API transport wins.");
    }
} else if (smtpTransportEnabled) {
    if (IS_PRODUCTION) {
        // Loud, because the failure it predicts is a silent two-minute hang.
        logger.warn(
            "⚠ mailer: SMTP transport with NODE_ENV=production. Hosts such as Render block outbound SMTP ports on free plans — if mail times out, set MAIL_API_KEY to switch to the HTTPS transport."
        );
    }
} else if (DEV_LOG_ALLOWED) {
    logger.warn(
        "mailer: no MAIL_API_KEY and no SMTP_HOST — running in LOG-ONLY mode. Emails (and reset links) are printed to this log instead of being sent."
    );
    if (IS_PRODUCTION) {
        logger.warn(
            "⚠ MAIL_DEV_LOG=true with NODE_ENV=production — password reset links are being written to the log. Never do this on a real deployment."
        );
    }
} else {
    logger.error(
        "mailer: no transport configured — transactional email (password reset) CANNOT be delivered. Set MAIL_API_KEY (or SMTP_*) in the environment."
    );
}

// --- HTTP API transport ------------------------------------------------------

/**
 * POST the message to the provider's transactional endpoint. Brevo's shape:
 * https://developers.brevo.com/docs/send-a-transactional-email — 201 with a
 * `messageId` on success, 4xx with `{ code, message }` on failure.
 *
 * Throws on failure; the caller turns that into the never-throws contract.
 */
const sendViaApi = async ({ to, subject, html, text }) => {
    const response = await fetch(MAIL_API_URL, {
        method: "POST",
        headers: {
            accept: "application/json",
            "content-type": "application/json",
            "api-key": MAIL_API_KEY,
        },
        body: JSON.stringify({
            sender: FROM_ADDRESS,
            to: [{ email: to }],
            subject,
            htmlContent: html,
            textContent: text,
            ...(MAIL_REPLY_TO ? { replyTo: { email: MAIL_REPLY_TO } } : {}),
        }),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    // Read the body either way: on an error it names the real cause (unverified
    // sender, bad key, quota exhausted) instead of a bare status code.
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(`${response.status} ${payload.message ?? response.statusText}`);
    }

    return payload.messageId ?? "(no id)";
};

// --- public API --------------------------------------------------------------

/**
 * Send one transactional email.
 *
 * NEVER THROWS. Callers are auth flows where a mail failure must not become the
 * user's error: a "your password changed" notice failing must not roll back the
 * password change that already succeeded, and the forgot-password endpoint must
 * stay indistinguishable across its outcomes. Failures are logged and reported in
 * the return value.
 *
 * @param {{to:string, subject:string, html:string, text:string}} message
 * @returns {Promise<{delivered:boolean, messageId?:string, error?:string}>}
 */
export const sendMail = async ({ to, subject, html, text }) => {
    if (!to || !subject) {
        logger.error("mailer: sendMail called without a recipient or subject");
        return { delivered: false, error: "missing recipient or subject" };
    }

    // --- HTTP API (production) ----------------------------------------------
    if (apiTransportEnabled) {
        try {
            const messageId = await sendViaApi({ to, subject, html, text });
            logger.info(`mailer: sent via API to=${to} subject="${subject}" id=${messageId}`);
            return { delivered: true, messageId };
        } catch (error) {
            // The request body is never logged: it carries the reset link.
            logger.error(`mailer: API send FAILED to=${to} subject="${subject}" err=${error.message}`);
            return { delivered: false, error: error.message };
        }
    }

    const tx = getTransporter();

    // --- log-only dev transport ---------------------------------------------
    if (!tx) {
        if (!DEV_LOG_ALLOWED) {
            // Body withheld on purpose — it contains the reset link.
            logger.error(`mailer: DROPPED mail to=${to} subject="${subject}" (no transport configured)`);
            return { delivered: false, error: "mailer not configured" };
        }
        logger.warn(
            `mailer[log-only] to=${to} subject="${subject}"\n${"-".repeat(60)}\n${text}\n${"-".repeat(60)}`
        );
        return { delivered: false, error: "mailer not configured (log-only mode)" };
    }

    // --- SMTP (local) --------------------------------------------------------
    try {
        const info = await tx.sendMail({
            from: MAIL_FROM,
            to,
            subject,
            text, // plaintext part — required for deliverability and text-only clients
            html,
            ...(MAIL_REPLY_TO ? { replyTo: MAIL_REPLY_TO } : {}),
        });

        logger.info(`mailer: sent via SMTP to=${to} subject="${subject}" id=${info.messageId}`);
        return { delivered: true, messageId: info.messageId };
    } catch (error) {
        logger.error(`mailer: SMTP send FAILED to=${to} subject="${subject}" err=${error.message}`);
        return { delivered: false, error: error.message };
    }
};

/**
 * Optional connectivity check. Not called automatically — a dead relay must not
 * stop the API from booting. Useful from a script or a health probe.
 *
 * For the API transport this only asserts a key is present: there is no free
 * no-op call on the provider side, and a probe email would cost send quota.
 */
export const verifyMailer = async () => {
    if (apiTransportEnabled) return { ok: true, transport: "api" };

    const tx = getTransporter();
    if (!tx) return { ok: false, error: "mailer not configured" };
    try {
        await tx.verify();
        logger.info("mailer: SMTP connection verified");
        return { ok: true, transport: "smtp" };
    } catch (error) {
        logger.error(`mailer: SMTP verification failed — ${error.message}`);
        return { ok: false, error: error.message };
    }
};
