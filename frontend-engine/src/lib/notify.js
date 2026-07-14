import { toast } from "sonner";

/**
 * Notification policy — one place that decides bell vs toast.
 *
 * Three surfaces, three jobs:
 *
 *   BELL ONLY  — everything the server persists. The bell is the archive; nothing
 *                is ever dropped from it.
 *   BELL+TOAST — `priority: "high"` only. These are events you did NOT cause and
 *                need to act on now: your join request was accepted, your payment
 *                was verified, someone took the slot you were holding. Anything
 *                lower (a comment reply, an event reminder, a rating) belongs in
 *                the bell but must not interrupt what you're doing.
 *   TOAST ONLY — the result of an action YOU just took ("Booking placed",
 *                "Comment posted", or the error). You already have the context, so
 *                persisting it to the bell would be pure noise.
 *
 * The high/medium/low split is set by the backend when it creates the
 * notification, so the client never has to guess from the type string.
 */

/** Priorities that are worth interrupting the user for. */
const TOAST_PRIORITIES = new Set(["high", "urgent"]);

/**
 * A live notification arrived over the socket. Decide whether it also deserves a
 * toast. (It is ALWAYS added to the bell — that happens at the call site.)
 */
export function toastIncomingNotification(notification, { onAction } = {}) {
    if (!notification || !TOAST_PRIORITIES.has(notification.priority)) return;

    toast(notification.title, {
        description: notification.message,
        // Give the toast the same jump the bell entry has, so a toast is never a
        // dead end the user has to go hunting after.
        action: notification.action_url
            ? {
                  label: "View",
                  onClick: () => onAction?.(notification.action_url),
              }
            : undefined,
    });
}

// --- Toast-only helpers: feedback for the user's OWN actions. --------------
// These deliberately do NOT create a notification record.

export const notifySuccess = (message, description) =>
    toast.success(message, { description });

export const notifyError = (message, description) =>
    toast.error(message, { description });

export const notifyInfo = (message, description) => toast(message, { description });
