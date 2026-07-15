"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import BookingTicket from "@/components/BookingTicket";
import EmptyState from "@/components/EmptyState";
import { useGetBookingByIdQuery } from "@/store/api/apiSlice";

// Player's printable ticket for a single booking. A ticket only exists for a
// CONFIRMED booking (paid + admin-verified); anything else has no valid QR yet.
// Ownership is enforced server-side (getBookingById → NOT_BOOKING_OWNER).
export default function BookingTicketPage() {
    const { bookingId } = useParams();
    const { data: session, status } = useSession();

    const { data: booking, isLoading, isError } = useGetBookingByIdQuery(bookingId, {
        skip: !session || !bookingId,
    });

    if (status === "loading" || isLoading) {
        return (
            <div className="grid min-h-[60vh] place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    if (!session) {
        return (
            <div className="mx-auto max-w-md px-4 py-24 text-center">
                <EmptyState title="Sign in to view your ticket" />
                <Button asChild className="mt-4 green-glow">
                    <Link href="/login">Sign in</Link>
                </Button>
            </div>
        );
    }

    if (isError || !booking) {
        return (
            <div className="mx-auto max-w-md px-4 py-24 text-center">
                <EmptyState title="Ticket not found" description="This booking doesn't exist or isn't yours." />
                <Button asChild variant="outline" className="mt-4">
                    <Link href="/bookings">Back to my bookings</Link>
                </Button>
            </div>
        );
    }

    // A ticket is only meaningful once the booking is confirmed.
    if (booking.booking_status !== "confirmed") {
        return (
            <div className="mx-auto max-w-md px-4 py-24 text-center">
                <div className="glass-card rounded-3xl p-8">
                    <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
                    <h1 className="mt-3 text-xl font-bold text-foreground">Ticket not ready</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Your ticket appears once the turf confirms your payment. Check back after
                        it&apos;s verified.
                    </p>
                    <Button asChild variant="outline" className="mt-5">
                        <Link href="/bookings">Back to my bookings</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 md:pt-24">
            <Link
                href="/bookings"
                className="print:hidden mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="h-4 w-4" /> My bookings
            </Link>
            <BookingTicket booking={booking} />
        </div>
    );
}
