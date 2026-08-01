import nodemailer from "nodemailer";
import { logger } from "../../logs/logger.js";

/**
 * Outbound email (SMTP).
 *
 * WHY SMTP AND NOT A VENDOR SDK: every provider we might plausibly use from
 * Bangladesh — Brevo, Mailgun, Gmail (app password), Mailtrap for staging,
 * Resend's SMTP bridge — speaks SMTP. Keeping the transport generic means
 * switching provider is an .env change, not a code change.
 *
 * CONFIG (backend/.env):
 *   SMTP_HOST   e.g. smtp-relay.brevo.com     (REQUIRED to actually send)
 *   SMTP_PORT   587 (STARTTLS, default) or 465 (implicit TLS)
 *   SMTP_USER   optional — omit for a local relay like MailHog that takes no auth
 *   SMTP_PASS   optional — see above
 *   MAIL_FROM   "FunTurf <no-reply@funturf.app>"
 *   MAIL_REPLY_TO optional support address
 *
 * DEV MODE: with SMTP_HOST unset the transport is disabled and every message is
 * dumped to the log instead, so a new developer can exercise the whole
 * forgot-password flow with zero credentials — copy the link out of the terminal.
 * This is deliberately NOT done when NODE_ENV=production: printing reset links
 * into a production log file would turn log access into account takeover.
 *
 * The local `.env` in this repo sets NODE_ENV=production even on a laptop (same
 * quirk that makes DOCS_ENABLED necessary for Swagger), so log-only mode has the
 * same style of explicit escape hatch: MAIL_DEV_LOG=true. NEVER set it on a real
 * deployment — it writes live reset links into the log.
 */

const SMTP_HOST = (process.env.SMTP_HOST ?? "").trim();
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = (process.env.SMTP_USER ?? "").trim();
const SMTP_PASS = process.env.SMTP_PASS ?? "";
const MAIL_FROM = (process.env.MAIL_FROM ?? "").trim() || "FunTurf <no-reply@funturf.app>";
const MAIL_REPLY_TO = (process.env.MAIL_REPLY_TO ?? "").trim();

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * May an undeliverable message have its BODY written to the log? Only outside
 * production, or when an operator explicitly opts in (see the note above about
 * this repo's local .env). Off by default in every other case.
 */
const DEV_LOG_ALLOWED = !IS_PRODUCTION || process.env.MAIL_DEV_LOG === "true";

/** True when a real SMTP host is configured; false => log-only dev transport. */
export const mailerEnabled = SMTP_HOST.length > 0;

// Built on first use, then reused. A pooled transporter holds its TCP/TLS
// connections open, so a burst of mail doesn't pay a fresh TLS handshake each
// time. maxConnections is small on purpose — this app sends transactional mail in
// ones and twos, and shared relays throttle aggressive senders.
let transporter = null;

const getTransporter = () => {
    if (!mailerEnabled) return null;
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

if (!mailerEnabled) {
    if (DEV_LOG_ALLOWED) {
        logger.warn(
            "mailer: SMTP_HOST not set — running in LOG-ONLY mode. Emails (and reset links) are printed to this log instead of being sent."
        );
        if (IS_PRODUCTION) {
            logger.warn(
                "⚠ MAIL_DEV_LOG=true with NODE_ENV=production — password reset links are being written to the log. Never do this on a real deployment."
            );
        }
    } else {
        logger.error(
            "mailer: SMTP_HOST is not set — transactional email (password reset) CANNOT be delivered. Set SMTP_* in the environment."
        );
    }
}

/**
 * Send one transactional email.
 *
 * NEVER THROWS. Callers are auth flows where a mail failure must not become the
 * user's error: the forgot-password endpoint has to return the same generic
 * response whether or not the account exists (see password.controller.js), and a
 * "your password changed" notice failing must not roll back the password change
 * that already succeeded. Failures are logged and reported in the return value.
 *
 * @param {{to:string, subject:string, html:string, text:string}} message
 * @returns {Promise<{delivered:boolean, messageId?:string, error?:string}>}
 */
export const sendMail = async ({ to, subject, html, text }) => {
    if (!to || !subject) {
        logger.error("mailer: sendMail called without a recipient or subject");
        return { delivered: false, error: "missing recipient or subject" };
    }

    const tx = getTransporter();

    // --- log-only dev transport -------------------------------------------
    if (!tx) {
        if (!DEV_LOG_ALLOWED) {
            // Body withheld on purpose — it contains the reset link.
            logger.error(`mailer: DROPPED mail to=${to} subject="${subject}" (no SMTP configured)`);
            return { delivered: false, error: "mailer not configured" };
        }
        logger.warn(
            `mailer[log-only] to=${to} subject="${subject}"\n${"-".repeat(60)}\n${text}\n${"-".repeat(60)}`
        );
        return { delivered: false, error: "mailer not configured (log-only mode)" };
    }

    try {
        const info = await tx.sendMail({
            from: MAIL_FROM,
            to,
            subject,
            text, // plaintext part — required for deliverability and text-only clients
            html,
            ...(MAIL_REPLY_TO ? { replyTo: MAIL_REPLY_TO } : {}),
        });

        logger.info(`mailer: sent to=${to} subject="${subject}" id=${info.messageId}`);
        return { delivered: true, messageId: info.messageId };
    } catch (error) {
        // Message body is never logged here: it may carry a single-use token.
        logger.error(`mailer: FAILED to=${to} subject="${subject}" err=${error.message}`);
        return { delivered: false, error: error.message };
    }
};

/**
 * Optional boot-time connectivity check. Not called automatically — a dead relay
 * must not stop the API from booting. Useful from a script or a health probe.
 */
export const verifyMailer = async () => {
    const tx = getTransporter();
    if (!tx) return { ok: false, error: "mailer not configured" };
    try {
        await tx.verify();
        logger.info("mailer: SMTP connection verified");
        return { ok: true };
    } catch (error) {
        logger.error(`mailer: SMTP verification failed — ${error.message}`);
        return { ok: false, error: error.message };
    }
};
