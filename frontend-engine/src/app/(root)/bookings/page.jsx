"use client";

import { notifyError } from "@/lib/notify";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { format } from "date-fns";
import {
    Ban,
    CalendarDays,
    Clock,
    Loader2,
    LogIn,
    MapPin,
    Ticket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    BookingStatusBadge,
    PaymentStatusBadge,
    EventTrustPanel,
    HoldExpiryBadge,
} from "@/components/BookingStatus";
import EmptyState from "@/components/EmptyState";
import { getApiErrorMessage } from "@/utils/apiError";
import { slotRangeLabel } from "@/utils/slots";
import {
    useGetMyBookingsQuery,
    useCancelBookingMutation,
    useRespondCancellationMutation,
} from "@/store/api/apiSlice";

// A booking is still actionable (cancellable) while not cancelled/completed.
const isActive = (b) => !["cancelled", "completed"].includes(b.booking_status);

export default function MyBookingsPage() {
    const { data: session, status } = useSession();
    const { data: bookings = [], isLoading } = useGetMyBookingsQuery(undefined, {
        skip: !session,
    });
    const [cancel, cancelState] = useCancelBookingMutation();
    const [respond, respondState] = useRespondCancellationMutation();
    const busy = cancelState.isLoading || respondState.isLoading;

    const run = async (fn, arg) => {
        try {
            await fn(arg).unwrap();
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Something went wrong."));
        }
    };

    if (status === "loading") {
        return (
            <div className="grid min-h-[60vh] place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    if (!session) {
        return (
            <div className="mx-auto max-w-md px-4 py-24 text-center">
                <EmptyState title="Sign in to see your bookings" />
                <Button asChild className="mt-4 green-glow">
                    <Link href="/login">
                        <LogIn className="h-4 w-4" /> Sign in
                    </Link>
                </Button>
            </div>
        );
    }

    const me = session.user?.id;

    return (
        <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 md:px-8 md:pt-24">
            <div className="mb-6 flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
                    <Ticket className="h-5 w-5" />
                </span>
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
                        My Bookings
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {bookings.length} booking{bookings.length === 1 ? "" : "s"}
                    </p>
                </div>
            </div>

            {isLoading ? (
                <div className="grid place-items-center py-24">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : bookings.length === 0 ? (
                <EmptyState title="No bookings yet" />
            ) : (
                <ul className="space-y-4">
                    {bookings.map((b) => {
                        const turf = b.grounds?.turfs;
                        const requestedByOther =
                            b.cancellation_requested_by && b.cancellation_requested_by !== me;
                        const requestedByMe = b.cancellation_requested_by === me;

                        return (
                            <li key={b.id} className="glass-card rounded-2xl p-5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-lg font-bold text-foreground">
                                            {b.grounds?.name}
                                            {turf ? ` · ${turf.name}` : ""}
                                        </p>
                                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                            {turf?.city && (
                                                <span className="inline-flex items-center gap-1.5">
                                                    <MapPin className="h-3.5 w-3.5" /> {turf.city}
                                                </span>
                                            )}
                                            <span className="inline-flex items-center gap-1.5">
                                                <CalendarDays className="h-3.5 w-3.5" />
                                                {b.booking_date
                                                    ? format(new Date(b.booking_date), "EEE, d MMM yyyy")
                                                    : "—"}
                                            </span>
                                            {b.slot?.code && (
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    {slotRangeLabel(b.slot.code)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        <BookingStatusBadge status={b.booking_status} />
                                        <PaymentStatusBadge status={b.payment_status} />
                                        {/* Unpaid holds die after 2h — show the clock. */}
                                        <HoldExpiryBadge expiresAt={b.hold_expires_at} />
                                    </div>
                                </div>

                                <div className="mt-3 flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Amount</span>
                                    <span className="text-lg font-extrabold text-foreground">
                                        BDT {Number(b.final_amount ?? 0).toLocaleString()}
                                    </span>
                                </div>

                                {b.event_trust && <EventTrustPanel trust={b.event_trust} />}

                                {/* Actions */}
                                {isActive(b) && (
                                    <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                                        {requestedByOther ? (
                                            <>
                                                <span className="mr-auto text-sm font-medium text-amber-500">
                                                    Cancellation requested by the turf
                                                </span>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        run(respond, { bookingId: b.id, accept: false })
                                                    }
                                                >
                                                    Decline
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="green-glow"
                                                    disabled={busy}
                                                    onClick={() =>
                                                        run(respond, { bookingId: b.id, accept: true })
                                                    }
                                                >
                                                    Accept cancel
                                                </Button>
                                            </>
                                        ) : requestedByMe ? (
                                            <span className="text-sm font-medium text-muted-foreground">
                                                Cancellation requested — awaiting the turf&apos;s acceptance
                                            </span>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="ml-auto text-destructive"
                                                disabled={busy}
                                                onClick={() => {
                                                    if (confirm("Cancel this booking?")) {
                                                        run(cancel, { bookingId: b.id });
                                                    }
                                                }}
                                            >
                                                <Ban className="h-4 w-4" /> Cancel
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
