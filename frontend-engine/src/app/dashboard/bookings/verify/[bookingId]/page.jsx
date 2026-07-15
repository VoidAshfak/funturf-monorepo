"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import BookingVerifyCard from "@/components/BookingVerifyCard";
import { getApiErrorMessage } from "@/utils/apiError";
import { useGetBookingByIdQuery } from "@/store/api/apiSlice";

// Deep-link verify screen for a single booking id (e.g. opened from a link).
// The in-panel scanner/manual flow lives at /dashboard/bookings/verify. All
// authority is server-side: getBookingById / check-in refuse anyone who isn't
// this turf's admin.
export default function VerifyBookingByIdPage() {
    const { bookingId } = useParams();
    const { data: session, status } = useSession();

    const { data: booking, isLoading, isError, error } = useGetBookingByIdQuery(bookingId, {
        skip: !session || !bookingId,
    });

    if (status === "loading" || isLoading) {
        return (
            <div className="grid min-h-[60vh] place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    if (isError || !booking) {
        return (
            <div className="mx-auto max-w-md px-4 py-16 text-center">
                <div className="glass-card rounded-3xl p-8">
                    <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
                    <h1 className="mt-3 text-xl font-bold text-foreground">Can&apos;t open this ticket</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {getApiErrorMessage(error, "This ticket isn't for a turf you manage.")}
                    </p>
                    <Button asChild variant="outline" className="mt-5">
                        <Link href="/dashboard/bookings/verify">Go to verify</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-lg px-4 pb-16 pt-4">
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Ticket verification
            </div>
            <BookingVerifyCard booking={booking} />
            <div className="mt-4 text-center">
                <Link
                    href="/dashboard/bookings/verify"
                    className="text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                    Scan another
                </Link>
            </div>
        </div>
    );
}
