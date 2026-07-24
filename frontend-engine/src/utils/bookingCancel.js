// Copy for the "cancel a booking" confirmation modal.
//
// `POST /bookings/:id/cancel` does not always mean "cancelled". The backend
// branches on the booking's payment/confirmation state and the date, so the
// modal has to say which of the three outcomes the user is actually about to
// trigger — otherwise someone taps "Cancel booking" on a confirmed booking and
// is surprised to see it still sitting there, waiting on the other party.
//
// Mirrors booking.controller.js `cancelBooking`, in the same order:
//   1. payment_status "pending"  -> unpaid hold, cancelled straight away
//   2. booking_status "confirmed" -> mutual cancellation handshake
//   3. otherwise (paid, unconfirmed) -> free cancel until 2 days before
//
// The backend stays the source of truth; this only shapes what we say up front.

/** Whole days from today to a booking date, using calendar days (not hours). */
const daysUntil = (bookingDate) => {
    if (!bookingDate) return Infinity;
    const target = new Date(bookingDate);
    if (Number.isNaN(target.getTime())) return Infinity;
    target.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86_400_000);
};

/**
 * Modal copy for cancelling `booking`.
 *
 * @returns {{ title: string, description: string, confirmLabel: string }}
 */
export function cancelBookingCopy(booking) {
    // 1. Unpaid soft hold — nothing was paid, so it just goes away.
    if (booking?.payment_status === "pending") {
        return {
            title: "Cancel this booking?",
            description:
                "This is an unpaid hold, so it is cancelled right away at no charge. The slot goes back up for anyone to book.",
            confirmLabel: "Cancel booking",
        };
    }

    // 2. Paid AND admin-confirmed — neither side can cancel alone.
    if (booking?.booking_status === "confirmed") {
        return {
            title: "Request cancellation?",
            description:
                "This booking is confirmed and paid, so it can't be cancelled on its own. The other party has to accept the request before it is cancelled and any refund is issued.",
            confirmLabel: "Request cancellation",
        };
    }

    // 3. Paid claim awaiting verification — free, but only outside the 2-day window.
    // We warn instead of blocking the button: this compares the browser's local
    // date against the booking date, and a user in another timezone can be a day
    // off. The API returns CANCELLATION_WINDOW_CLOSED, which surfaces as a toast.
    if (daysUntil(booking?.booking_date) < 2) {
        return {
            title: "Cancel this booking?",
            description:
                "Paid bookings can only be cancelled up to 2 days before the booking date. This one is inside that window, so the request will most likely be refused — contact the turf instead.",
            confirmLabel: "Try to cancel",
        };
    }

    return {
        title: "Cancel this booking?",
        description:
            "Your payment claim is still awaiting the turf's verification. Cancelling now releases the slot, and any amount already paid is refunded by the turf.",
        confirmLabel: "Cancel booking",
    };
}
