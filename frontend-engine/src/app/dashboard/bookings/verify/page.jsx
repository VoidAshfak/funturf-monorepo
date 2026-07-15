"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, QrCode, RotateCcw, ScanLine, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BookingVerifyCard from "@/components/BookingVerifyCard";
import { notifyError } from "@/lib/notify";
import { getApiErrorMessage } from "@/utils/apiError";
import { normalizeRefInput, parseTicketScan } from "@/utils/ticket";
import {
    useLazyGetBookingByIdQuery,
    useLazyVerifyBookingLookupQuery,
} from "@/store/api/apiSlice";

// The camera scanner is client-only (needs getUserMedia + a real DOM node), so
// keep it out of SSR entirely.
const QrScanner = dynamic(() => import("@/components/QrScanner"), { ssr: false });

// Turf-admin ticket verification. Two ways in:
//   - Scan  : live camera reads the ticket QR (which encodes the booking data),
//             resolves the exact booking, and offers check-in.
//   - Manual: type the printed reference (FT-XXXXXXXX) when a QR won't scan.
// Both land on the same BookingVerifyCard; check-in itself is server-authorized.
export default function VerifyBookingPage() {
    const [booking, setBooking] = useState(null);
    const [busy, setBusy] = useState(false);
    const [manualCode, setManualCode] = useState("");

    const [fetchById] = useLazyGetBookingByIdQuery();
    const [lookupByRef] = useLazyVerifyBookingLookupQuery();

    const reset = () => setBooking(null);

    // A QR was decoded — pull the booking id out and resolve the real booking.
    const handleScan = useCallback(
        async (text) => {
            const id = parseTicketScan(text);
            if (!id) {
                notifyError("Unrecognized code", "That QR isn't a FunTurf ticket.");
                return;
            }
            setBusy(true);
            try {
                const result = await fetchById(id).unwrap();
                setBooking(result);
            } catch (err) {
                notifyError(getApiErrorMessage(err, "Couldn't verify this ticket."));
            } finally {
                setBusy(false);
            }
        },
        [fetchById]
    );

    const handleManual = async (e) => {
        e.preventDefault();
        const code = normalizeRefInput(manualCode);
        if (!code) {
            notifyError("Invalid reference", "Enter a ticket reference like FT-7K3QX9A1.");
            return;
        }
        setBusy(true);
        try {
            const result = await lookupByRef(code).unwrap();
            setBooking(result);
        } catch (err) {
            notifyError(getApiErrorMessage(err, "No booking found for that reference."));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mx-auto max-w-lg px-4 pb-16 pt-2">
            <div className="mb-5 flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                        Verify tickets
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Scan a player&apos;s QR or enter their reference to check them in.
                    </p>
                </div>
            </div>

            {/* Resolved -> show the booking + check-in, with a way back to scanning. */}
            {booking ? (
                <div className="space-y-4">
                    <BookingVerifyCard booking={booking} />
                    <Button variant="outline" className="w-full rounded-full" onClick={reset}>
                        <RotateCcw className="h-4 w-4" /> Verify another
                    </Button>
                </div>
            ) : (
                <Tabs defaultValue="scan">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="scan">
                            <ScanLine className="h-4 w-4" /> Scan
                        </TabsTrigger>
                        <TabsTrigger value="manual">
                            <QrCode className="h-4 w-4" /> Manual
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="scan" className="mt-4">
                        {busy ? (
                            <div className="grid place-items-center gap-2 rounded-2xl border border-border p-12 text-sm text-muted-foreground">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                Verifying…
                            </div>
                        ) : (
                            <QrScanner onDecode={handleScan} />
                        )}
                    </TabsContent>

                    <TabsContent value="manual" className="mt-4">
                        <form onSubmit={handleManual} className="space-y-3">
                            <label className="text-sm font-medium text-foreground">
                                Ticket reference
                            </label>
                            <Input
                                value={manualCode}
                                onChange={(e) => setManualCode(e.target.value)}
                                placeholder="FT-7K3QX9A1"
                                autoCapitalize="characters"
                                className="font-mono tracking-wider"
                            />
                            <p className="text-xs text-muted-foreground">
                                It&apos;s printed at the top of the player&apos;s ticket.
                            </p>
                            <Button
                                type="submit"
                                className="green-glow w-full rounded-full"
                                disabled={busy}
                            >
                                {busy ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Search className="h-4 w-4" />
                                )}
                                Find booking
                            </Button>
                        </form>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
