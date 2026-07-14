import { cn } from "@/lib/utils";
import { Hourglass, ShieldCheck, Users } from "lucide-react";

// Booking status -> chip colour. Uses design tokens (green = good, destructive = bad).
const BOOKING_STYLES = {
    pending: "bg-amber-500/15 text-amber-500",
    confirmed: "bg-primary/15 text-primary",
    cancelled: "bg-destructive/15 text-destructive",
    completed: "bg-muted text-muted-foreground",
    no_show: "bg-destructive/15 text-destructive",
};

const PAYMENT_STYLES = {
    pending: "bg-muted text-muted-foreground",
    partial: "bg-amber-500/15 text-amber-500", // paid claim, awaiting verification
    completed: "bg-primary/15 text-primary",
    refunded: "bg-blue-500/15 text-blue-500",
};

const PAYMENT_LABEL = {
    pending: "Unpaid",
    partial: "Awaiting verification",
    completed: "Paid",
    refunded: "Refunded",
};

export function BookingStatusBadge({ status }) {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold capitalize",
                BOOKING_STYLES[status] ?? "bg-muted text-muted-foreground"
            )}
        >
            {status}
        </span>
    );
}

export function PaymentStatusBadge({ status }) {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold",
                PAYMENT_STYLES[status] ?? "bg-muted text-muted-foreground"
            )}
        >
            {PAYMENT_LABEL[status] ?? status}
        </span>
    );
}

/**
 * Countdown on an unpaid hold.
 *
 * An unpaid booking is only a 2-hour soft hold: it never locks the slot, anyone
 * can take it by paying, and it self-cancels when the timer runs out. Showing
 * the deadline is the difference between "my booking vanished" and "I knew I had
 * to pay". `expiresAt` comes from the API as `hold_expires_at`.
 */
export function HoldExpiryBadge({ expiresAt }) {
    if (!expiresAt) return null;

    const msLeft = new Date(expiresAt).getTime() - Date.now();
    if (msLeft <= 0) return null;

    const minutes = Math.round(msLeft / 60000);
    const label =
        minutes >= 60
            ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
            : `${minutes}m`;

    // Under 30 minutes left is worth alarming about.
    const urgent = minutes < 30;

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold",
                urgent ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-500"
            )}
        >
            <Hourglass className="h-3 w-3" />
            Hold expires in {label}
        </span>
    );
}

// Trust snapshot for an event attached to a booking — lets the admin gauge how
// real the game is (squad size vs capacity, approved players, organizer).
export function EventTrustPanel({ trust }) {
    if (!trust) return null;
    const organizer =
        [trust.organizer?.first_name, trust.organizer?.last_name].filter(Boolean).join(" ") ||
        "Organizer";

    return (
        <div className="mt-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-primary">
                <ShieldCheck className="h-3.5 w-3.5" /> Attached event
            </div>
            <p className="truncate text-sm font-semibold text-foreground">{trust.title}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {trust.approved_count} approved · {trust.current_players ?? 0}/{trust.min_players}{" "}
                    min ({trust.max_players} max)
                </span>
                <span>by {organizer}</span>
                {trust.status && <span className="capitalize">· {trust.status}</span>}
            </div>
        </div>
    );
}
