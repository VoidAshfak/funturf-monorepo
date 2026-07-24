"use client";

import { notifyError, notifySuccess } from "@/lib/notify";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import {
    Ban,
    CalendarDays,
    Check,
    Clock,
    ExternalLink,
    Loader2,
    MapPin,
    User,
    X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    BookingStatusBadge,
    PaymentStatusBadge,
    EventTrustPanel,
} from "@/components/BookingStatus";
import ConfirmDialog from "@/components/ConfirmDialog";
import { getApiErrorMessage } from "@/utils/apiError";
import { cancelBookingCopy } from "@/utils/bookingCancel";
import { slotRangeLabel } from "@/utils/slots";
import {
    useGetManageBookingsQuery,
    useConfirmBookingPaymentMutation,
    useRejectBookingPaymentMutation,
    useCancelBookingMutation,
    useRespondCancellationMutation,
} from "@/store/api/apiSlice";

const FILTERS = [
    { key: "", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "confirmed", label: "Confirmed" },
    { key: "cancelled", label: "Cancelled" },
];

const fullName = (u) =>
    [u?.first_name, u?.last_name].filter(Boolean).join(" ") || "User";

export default function DashboardBookingsPage() {
    const { data: session } = useSession();
    const me = session?.user?.id;
    const [filter, setFilter] = useState("");

    const {
        data: bookings = [],
        isLoading,
        isError,
        error,
    } = useGetManageBookingsQuery(filter ? { status: filter } : undefined);
    const [confirmPayment, confirmState] = useConfirmBookingPaymentMutation();
    const [rejectPayment, rejectState] = useRejectBookingPaymentMutation();
    const [cancel, cancelState] = useCancelBookingMutation();
    const [respond, respondState] = useRespondCancellationMutation();
    const busy =
        confirmState.isLoading ||
        rejectState.isLoading ||
        cancelState.isLoading ||
        respondState.isLoading;

    const run = async (fn, arg) => {
        try {
            await fn(arg).unwrap();
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Something went wrong."));
        }
    };

    // The booking the confirm modal is asking about (null = closed). One dialog
    // for the whole list, not one per row.
    const [cancelTarget, setCancelTarget] = useState(null);
    const cancelCopy = cancelBookingCopy(cancelTarget);

    // Same gate as the user-facing /bookings page: cancelling is destructive and
    // hits someone else's booking here, so it must not fire on a stray click.
    // Errors re-throw so ConfirmDialog stays open behind the error toast.
    const confirmCancel = async () => {
        try {
            const res = await cancel({ bookingId: cancelTarget.id }).unwrap();
            notifySuccess(res?.message || "Booking cancelled");
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Could not cancel this booking."));
            throw err;
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                    Bookings
                </h1>
                <p className="text-sm text-muted-foreground">
                    Verify payments and manage bookings for your turfs.
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                            filter === f.key
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {isError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                    {getApiErrorMessage(error, "Could not load bookings. Turf-admin access required.")}
                </div>
            ) : isLoading ? (
                <div className="grid place-items-center py-24">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : bookings.length === 0 ? (
                <p className="rounded-xl bg-muted/50 p-6 text-center text-sm text-muted-foreground">
                    No bookings{filter ? ` with status "${filter}"` : ""}.
                </p>
            ) : (
                <ul className="space-y-4">
                    {bookings.map((b) => {
                        const turf = b.grounds?.turfs;
                        const user = b.users_bookings_user_idTousers;
                        const isPaidClaim = b.payment_status === "partial";
                        const requestedByOther =
                            b.cancellation_requested_by && b.cancellation_requested_by !== me;
                        const requestedByMe = b.cancellation_requested_by === me;
                        const active = !["cancelled", "completed"].includes(b.booking_status);

                        return (
                            <li key={b.id} className="glass-card rounded-2xl p-5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    {/* who + where */}
                                    <div className="flex items-start gap-3">
                                        <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                                            <AvatarImage
                                                src={user?.profile_picture_url || undefined}
                                                alt={fullName(user)}
                                            />
                                            <AvatarFallback>
                                                <User className="h-4 w-4" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <p className="font-bold text-foreground">{fullName(user)}</p>
                                            <p className="truncate text-sm text-muted-foreground">
                                                {b.grounds?.name}
                                                {turf ? ` · ${turf.name}` : ""}
                                            </p>
                                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                {turf?.city && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <MapPin className="h-3.5 w-3.5" /> {turf.city}
                                                    </span>
                                                )}
                                                <span className="inline-flex items-center gap-1">
                                                    <CalendarDays className="h-3.5 w-3.5" />
                                                    {b.booking_date
                                                        ? format(new Date(b.booking_date), "d MMM yyyy")
                                                        : "—"}
                                                </span>
                                                {b.slot?.code && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        {slotRangeLabel(b.slot.code)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                        <BookingStatusBadge status={b.booking_status} />
                                        <PaymentStatusBadge status={b.payment_status} />
                                        <span className="text-lg font-extrabold text-foreground">
                                            BDT {Number(b.final_amount ?? 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                {/* payment evidence */}
                                {(b.transaction_id || b.payment_proof_url) && (
                                    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
                                        {b.transaction_id && (
                                            <span className="text-muted-foreground">
                                                Txn:{" "}
                                                <span className="font-mono font-semibold text-foreground">
                                                    {b.transaction_id}
                                                </span>
                                            </span>
                                        )}
                                        {b.payment_proof_url && (
                                            <a
                                                href={b.payment_proof_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" /> View payment proof
                                            </a>
                                        )}
                                    </div>
                                )}

                                {b.event_trust && <EventTrustPanel trust={b.event_trust} />}

                                {/* actions */}
                                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                                    {isPaidClaim && (
                                        <>
                                            <Button
                                                size="sm"
                                                className="green-glow"
                                                disabled={busy}
                                                onClick={() => run(confirmPayment, { bookingId: b.id })}
                                            >
                                                <Check className="h-4 w-4" /> Confirm payment
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={busy}
                                                onClick={() => run(rejectPayment, { bookingId: b.id })}
                                            >
                                                <X className="h-4 w-4" /> Reject
                                            </Button>
                                        </>
                                    )}

                                    {requestedByOther && (
                                        <>
                                            <span className="mr-auto text-sm font-medium text-amber-500">
                                                Cancellation requested by the user
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
                                    )}

                                    {requestedByMe && (
                                        <span className="text-sm font-medium text-muted-foreground">
                                            Cancellation requested — awaiting the user&apos;s acceptance
                                        </span>
                                    )}

                                    {active && !requestedByOther && !requestedByMe && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="ml-auto text-destructive"
                                            disabled={busy}
                                            onClick={() => setCancelTarget(b)}
                                        >
                                            <Ban className="h-4 w-4" /> Cancel
                                        </Button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* Cancel gate — copy adapts to the target booking's state. */}
            <ConfirmDialog
                open={Boolean(cancelTarget)}
                onOpenChange={(next) => !next && setCancelTarget(null)}
                title={cancelCopy.title}
                description={cancelCopy.description}
                confirmLabel={cancelCopy.confirmLabel}
                cancelLabel="Keep booking"
                Icon={Ban}
                onConfirm={confirmCancel}
            />
        </div>
    );
}
