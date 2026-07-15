"use client";

import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { CheckCircle2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { slotRangeLabel } from "@/utils/slots";
import { bookingRef, ticketQrData } from "@/utils/ticket";

// Player's booking receipt — styled like an invoice. Deliberately a light
// "paper" surface (not the app's dark theme) so it reads as a document and
// prints cleanly on white. The QR encodes the booking DATA (see ticketQrData);
// the turf scans it in the Verify panel to confirm the exact booking.
//
// Assumes a CONFIRMED booking — the caller gates on status.
export default function BookingTicket({ booking }) {
    if (!booking) return null;

    const owner = booking.users_bookings_user_idTousers;
    const ownerName =
        [owner?.first_name, owner?.last_name].filter(Boolean).join(" ") || "Player";
    const turf = booking.grounds?.turfs;
    const reference = bookingRef(booking.id);
    const qrData = ticketQrData(booking);
    const checkedIn = Boolean(booking.check_in_time);

    const dateLabel = booking.booking_date
        ? format(new Date(booking.booking_date), "EEE, d MMM yyyy")
        : "—";
    const slotLabel = booking.slot?.code ? slotRangeLabel(booking.slot.code) : "—";
    const issued = booking.created_at ? new Date(booking.created_at) : new Date();

    const subtotal = Number(booking.total_amount ?? booking.final_amount ?? 0);
    const discount = Number(booking.discount_amount ?? 0);
    const total = Number(booking.final_amount ?? 0);
    const money = (n) => `BDT ${Number(n).toLocaleString()}`;

    return (
        <div className="mx-auto max-w-xl">
            <div
                id="printable-ticket"
                className="overflow-hidden rounded-3xl border border-neutral-200 bg-white text-neutral-900 shadow-sm"
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-7 py-6">
                    <div>
                        <p className="text-xl font-extrabold tracking-tight">
                            FUN<span className="text-[#1DB954]">TURF</span>
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">Booking receipt</p>
                    </div>
                    <div className="text-right">
                        <p className="font-mono text-lg font-bold tracking-wider">{reference}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                            Issued {format(issued, "d MMM yyyy")}
                        </p>
                        <span
                            className={
                                "mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold " +
                                (checkedIn
                                    ? "bg-neutral-900 text-white"
                                    : "bg-[#1DB954]/15 text-[#0f7a37]")
                            }
                        >
                            {checkedIn ? "CHECKED IN" : "CONFIRMED"}
                        </span>
                    </div>
                </div>

                {/* Parties */}
                <div className="grid grid-cols-2 gap-4 px-7 py-5 text-sm">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                            Billed to
                        </p>
                        <p className="mt-1 font-bold">{ownerName}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                            Venue
                        </p>
                        <p className="mt-1 font-bold">{turf?.name ?? booking.grounds?.name}</p>
                        {turf?.city && <p className="text-xs text-neutral-500">{turf.city}</p>}
                    </div>
                </div>

                {/* Line items */}
                <div className="px-7">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-y border-neutral-200 text-left text-[11px] uppercase tracking-wide text-neutral-400">
                                <th className="py-2 font-semibold">Description</th>
                                <th className="py-2 text-right font-semibold">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-neutral-100 align-top">
                                <td className="py-3">
                                    <p className="font-semibold">
                                        {booking.grounds?.name ?? "Ground"} — 90 min slot
                                    </p>
                                    <p className="text-xs text-neutral-500">
                                        {dateLabel} · {slotLabel}
                                    </p>
                                </td>
                                <td className="py-3 text-right font-semibold">{money(subtotal)}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Totals */}
                    <div className="ml-auto mt-3 w-full max-w-[220px] space-y-1.5 text-sm">
                        <div className="flex justify-between text-neutral-500">
                            <span>Subtotal</span>
                            <span>{money(subtotal)}</span>
                        </div>
                        {discount > 0 && (
                            <div className="flex justify-between text-[#0f7a37]">
                                <span>Discount</span>
                                <span>-{money(discount)}</span>
                            </div>
                        )}
                        <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-extrabold">
                            <span>Total</span>
                            <span>{money(total)}</span>
                        </div>
                        <p className="pt-0.5 text-right text-[11px] font-semibold uppercase tracking-wide text-[#0f7a37]">
                            {booking.payment_status === "completed" ? "Paid" : booking.payment_status}
                        </p>
                    </div>
                </div>

                {/* QR + gate note */}
                <div className="mt-4 flex items-center gap-4 border-t border-dashed border-neutral-300 bg-neutral-50 px-7 py-5">
                    <div className="rounded-xl border border-neutral-200 bg-white p-2.5">
                        <QRCodeSVG value={qrData} size={104} level="M" marginSize={0} />
                    </div>
                    <div className="min-w-0 text-sm">
                        {checkedIn ? (
                            <p className="flex items-center gap-1.5 font-bold text-neutral-900">
                                <CheckCircle2 className="h-4 w-4" />
                                Checked in{" "}
                                {format(new Date(booking.check_in_time), "h:mm a, d MMM")}
                            </p>
                        ) : (
                            <p className="font-bold text-neutral-900">Present this at the gate</p>
                        )}
                        <p className="mt-1 text-xs text-neutral-500">
                            Turf staff scan this code to confirm your booking. Reference{" "}
                            <span className="font-mono font-semibold text-neutral-700">
                                {reference}
                            </span>
                            .
                        </p>
                    </div>
                </div>
            </div>

            {/* Actions (never printed) */}
            <div className="print:hidden mt-5 flex justify-center">
                <Button className="green-glow rounded-full px-6" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" /> Print / Save as PDF
                </Button>
            </div>
        </div>
    );
}
