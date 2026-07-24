"use client";

import { format } from "date-fns";
import {
    CalendarDays,
    CheckCircle2,
    Clock,
    Loader2,
    MapPin,
    ShieldAlert,
    UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/BookingStatus";
import { notifyError, notifySuccess } from "@/lib/notify";
import { getApiErrorMessage } from "@/utils/apiError";
import { slotRangeLabel } from "@/utils/slots";
import { bookingRef } from "@/utils/ticket";
import { useCheckInBookingMutation } from "@/store/api/apiSlice";

// Shared verify/check-in card for a resolved booking. Rendered by the deep-link
// verify page and by the admin Verify tab (scan + manual). All authority is
// server-side — check-in rejects anyone who isn't this turf's admin.
export default function BookingVerifyCard({ booking }) {
    const [checkIn, checkInState] = useCheckInBookingMutation();

    if (!booking) return null;

    const owner = booking.users_bookings_user_idTousers;
    const ownerName =
        [owner?.first_name, owner?.last_name].filter(Boolean).join(" ") || "Player";
    const turf = booking.grounds?.turfs;
    const checkedIn = Boolean(booking.check_in_time);
    const isConfirmed = booking.booking_status === "confirmed";

    const doCheckIn = async () => {
        try {
            await checkIn(booking.id).unwrap();
            notifySuccess("Checked in", `${ownerName} is confirmed for this slot.`);
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Check-in failed."));
        }
    };

    return (
        <div className="glass-card rounded-3xl border border-border p-6">
            {/* Reference + status */}
            <div className="flex items-center justify-between">
                <p className="text-lg font-extrabold tracking-tight text-foreground">
                    {bookingRef(booking)}
                </p>
                <div className="flex flex-col items-end gap-1">
                    <BookingStatusBadge status={booking.booking_status} />
                    <PaymentStatusBadge status={booking.payment_status} />
                </div>
            </div>

            {/* Player */}
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/30 p-3">
                <Avatar className="h-11 w-11">
                    <AvatarImage src={owner?.profile_picture_url} alt={ownerName} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                        <UserRound className="h-5 w-5" />
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Booked by</p>
                    <p className="truncate font-bold text-foreground">{ownerName}</p>
                </div>
            </div>

            {/* Details */}
            <div className="mt-4 space-y-2.5 text-sm">
                <Detail
                    icon={MapPin}
                    value={`${booking.grounds?.name ?? "Ground"}${turf ? ` · ${turf.name}` : ""}`}
                />
                <Detail
                    icon={CalendarDays}
                    value={
                        booking.booking_date
                            ? format(new Date(booking.booking_date), "EEE, d MMM yyyy")
                            : "—"
                    }
                />
                <Detail
                    icon={Clock}
                    value={booking.slot?.code ? slotRangeLabel(booking.slot.code) : "—"}
                />
            </div>

            {/* Action / state */}
            <div className="mt-6">
                {!isConfirmed ? (
                    <p className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        This booking isn&apos;t confirmed yet — verify the payment before check-in.
                    </p>
                ) : checkedIn ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 p-4 text-sm font-bold text-primary">
                        <CheckCircle2 className="h-5 w-5" />
                        Checked in at {format(new Date(booking.check_in_time), "h:mm a, d MMM")}
                    </div>
                ) : (
                    <Button
                        className="green-glow w-full rounded-full"
                        disabled={checkInState.isLoading}
                        onClick={doCheckIn}
                    >
                        {checkInState.isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <CheckCircle2 className="h-4 w-4" />
                        )}
                        Check in {ownerName}
                    </Button>
                )}
            </div>
        </div>
    );
}

function Detail({ icon: Icon, value }) {
    return (
        <div className="flex items-center gap-2.5 text-foreground">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{value}</span>
        </div>
    );
}
