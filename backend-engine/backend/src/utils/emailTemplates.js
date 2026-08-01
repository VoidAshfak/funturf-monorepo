/**
 * Transactional email bodies.
 *
 * Every template returns `{ subject, html, text }`. The plaintext part is not
 * optional: spam filters score HTML-only mail worse, and a text-only client would
 * otherwise show an empty message.
 *
 * STYLING RULES for email (not the same as the web app):
 *   - Inline styles only. Gmail strips <style> blocks, so a class-based layout
 *     collapses to unstyled text.
 *   - Tables for layout, not flex/grid — Outlook renders neither.
 *   - No external CSS, webfonts or images: they are blocked by default in most
 *     clients and make the mail look broken before the user opts in.
 */

const BRAND_NAME = "FunTurf";
const BRAND_TAGLINE = "Book turfs. Find players. Play more.";
const BRAND_TEAL = "#0f766e";
const INK = "#111827";
const MUTED = "#6b7280";

/**
 * Escape a value before it goes into the HTML body.
 *
 * `first_name` is user-controlled, so interpolating it raw would let a registered
 * user put markup (or a link) into an email that WE send from our own domain —
 * i.e. a phishing vector wearing our branding.
 */
const escapeHtml = (value) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

/**
 * Shared shell: header, white card, footer. `bodyHtml` is already-escaped markup.
 */
const layout = ({ title, bodyHtml }) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f5f4;margin:0;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="background-color:${BRAND_TEAL};padding:22px 28px;">
            <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">${BRAND_NAME}</div>
            <div style="color:#c7f0ea;font-size:12px;margin-top:2px;">${BRAND_TAGLINE}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <h1 style="margin:0 0 16px;font-size:19px;line-height:1.35;color:${INK};font-weight:700;">${escapeHtml(title)}</h1>
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px;border-top:1px solid #f0f1f2;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">
              This is an automated message from ${BRAND_NAME} — please do not reply to it.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

const button = (href, label) => `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;">
  <tr>
    <td style="border-radius:999px;background-color:${BRAND_TEAL};">
      <a href="${href}" style="display:inline-block;padding:13px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;

const paragraph = (html) =>
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${INK};">${html}</p>`;

const greeting = (firstName) =>
    firstName ? `Hi ${escapeHtml(firstName)},` : "Hi there,";

/**
 * Password reset request — carries the single-use link.
 *
 * The raw URL is repeated as plain text under the button because some clients
 * (and most corporate mail gateways) rewrite or strip anchor hrefs, leaving the
 * user with a button that goes nowhere.
 *
 * @param {{firstName?:string, resetUrl:string, ttlMinutes:number}} params
 */
export const passwordResetEmail = ({ firstName, resetUrl, ttlMinutes }) => {
    const subject = `Reset your ${BRAND_NAME} password`;

    const html = layout({
        title: "Reset your password",
        bodyHtml: `
            ${paragraph(greeting(firstName))}
            ${paragraph(`We got a request to reset the password for your ${BRAND_NAME} account. Click the button below to choose a new one.`)}
            ${button(resetUrl, "Choose a new password")}
            ${paragraph(`<span style="color:${MUTED};font-size:13px;">Or paste this link into your browser:</span><br><span style="font-size:12px;word-break:break-all;color:${BRAND_TEAL};">${escapeHtml(resetUrl)}</span>`)}
            ${paragraph(`<strong>This link expires in ${Number(ttlMinutes)} minutes</strong> and can only be used once.`)}
            ${paragraph(`<span style="color:${MUTED};font-size:13px;">Didn't ask for this? You can safely ignore this email — your password stays as it is, and nobody can see it.</span>`)}
        `,
    });

    const text = [
        greeting(firstName),
        "",
        `We got a request to reset the password for your ${BRAND_NAME} account.`,
        "Open this link to choose a new one:",
        resetUrl,
        "",
        `This link expires in ${Number(ttlMinutes)} minutes and can only be used once.`,
        "",
        "Didn't ask for this? Ignore this email — your password stays as it is.",
        "",
        `— ${BRAND_NAME}`,
    ].join("\n");

    return { subject, html, text };
};

/**
 * Post-change confirmation.
 *
 * This is a SECURITY notice, not a courtesy: if an attacker resets a password,
 * this mail is how the real owner finds out. That is why it is sent even though
 * the user just performed the change themselves and "already knows".
 *
 * @param {{firstName?:string, loginUrl:string, when?:Date}} params
 */
export const passwordChangedEmail = ({ firstName, loginUrl, when = new Date() }) => {
    const subject = `Your ${BRAND_NAME} password was changed`;
    const stamp = when.toISOString().replace("T", " ").slice(0, 16) + " UTC";

    const html = layout({
        title: "Your password was changed",
        bodyHtml: `
            ${paragraph(greeting(firstName))}
            ${paragraph(`The password on your ${BRAND_NAME} account was changed on <strong>${escapeHtml(stamp)}</strong>. You've been signed out everywhere, so log in again with your new password.`)}
            ${button(loginUrl, "Log in")}
            ${paragraph(`<strong>Wasn't you?</strong> Reset your password immediately and contact us — someone else may have access to your email inbox.`)}
        `,
    });

    const text = [
        greeting(firstName),
        "",
        `The password on your ${BRAND_NAME} account was changed on ${stamp}.`,
        "You've been signed out everywhere, so log in again with your new password:",
        loginUrl,
        "",
        "Wasn't you? Reset your password immediately and contact us.",
        "",
        `— ${BRAND_NAME}`,
    ].join("\n");

    return { subject, html, text };
};
