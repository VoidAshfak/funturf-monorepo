"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import {
    Ban,
    CalendarCheck2,
    CalendarIcon,
    Check,
    CreditCard,
    Loader2,
    LogIn,
    Upload,
} from "lucide-react";
import Link from "next/link";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/utils/apiError";
import { uploadSingleImageObj } from "@/utils/image-upload";
import { SLOT_CODES, slotRangeLabel } from "@/utils/slots";
import {
    useGetAvailableSlotsQuery,
    useGetBookingQuoteQuery,
    useGetMyEventsQuery,
    useCreateBookingMutation,
} from "@/store/api/apiSlice";

// Booking flow for a venue. Booking is per-GROUND; the user picks ground → date →
// 90-min slot, sees a live price, then either places an unpaid soft hold or a
// paid claim (transaction id and/or proof) that locks the slot for admin review.
export default function BookingDialog({ venue }) {
    const { data: session } = useSession();
    const grounds = venue?.grounds ?? [];

    const [open, setOpen] = useState(false);
    const [groundId, setGroundId] = useState(grounds[0]?.id ?? "");
    const [date, setDate] = useState(null);
    const [slot, setSlot] = useState(null);
    const [payMode, setPayMode] = useState("unpaid"); // "unpaid" | "paid"
    const [transactionId, setTransactionId] = useState("");
    const [proof, setProof] = useState(null); // { file }
    const [eventId, setEventId] = useState("none");
    const [promoCode, setPromoCode] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const dateStr = date ? format(date, "yyyy-MM-dd") : null;
    const ground = grounds.find((g) => g.id === groundId);
    const currency = ground?.currency || "BDT";

    const { data: slotRow, isFetching: slotsLoading } = useGetAvailableSlotsQuery(
        { ground: groundId, date: dateStr },
        { skip: !groundId || !dateStr }
    );
    const { data: quote, isFetching: quoteLoading } = useGetBookingQuoteQuery(
        { ground_id: groundId, slot, booking_date: dateStr, promo_code: promoCode || undefined },
        { skip: !groundId || !slot || !dateStr }
    );
    const { data: myEvents = [] } = useGetMyEventsQuery(undefined, { skip: !session });
    const [createBooking] = useCreateBookingMutation();

    // Only events the caller ORGANIZED can be attached (backend enforces this too).
    const myOrganizedEvents = useMemo(
        () => myEvents.filter((e) => (e.organizer_id ?? e.organizer?.id) === session?.user?.id),
        [myEvents, session?.user?.id]
    );

    const resetSlot = () => setSlot(null);

    const onSubmit = async () => {
        if (!slot || !dateStr) return;
        const paid = payMode === "paid";
        if (paid && !transactionId.trim() && !proof) {
            alert("Add a transaction number or upload a payment proof.");
            return;
        }

        setSubmitting(true);
        try {
            let payment_proof_url;
            if (paid && proof) {
                payment_proof_url = await uploadSingleImageObj(proof);
            }
            await createBooking({
                ground_id: groundId,
                booking_date: dateStr,
                slot,
                paid,
                transaction_id: paid ? transactionId.trim() || undefined : undefined,
                payment_proof_url: paid ? payment_proof_url : undefined,
                event_id: eventId !== "none" ? eventId : undefined,
                promo_code: promoCode || undefined,
            }).unwrap();

            // Reset + close.
            setOpen(false);
            setSlot(null);
            setTransactionId("");
            setProof(null);
            setEventId("none");
            setPromoCode("");
            setPayMode("unpaid");
        } catch (err) {
            alert(getApiErrorMessage(err, "Booking failed."));
        } finally {
            setSubmitting(false);
        }
    };

    const triggerBtn = (
        <Button className="w-full green-glow">
            <CalendarCheck2 className="h-4 w-4" /> Book Now
        </Button>
    );

    // Signed-out: send to login rather than opening the flow.
    if (!session) {
        return (
            <Button asChild className="w-full green-glow">
                <Link href="/login">
                    <LogIn className="h-4 w-4" /> Sign in to book
                </Link>
            </Button>
        );
    }

    if (grounds.length === 0) {
        return (
            <Button className="w-full" disabled>
                No grounds to book
            </Button>
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{triggerBtn}</DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Book {venue?.name}</DialogTitle>
                    <DialogDescription>
                        Pick a ground, date and a 90-minute slot.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    {/* Ground */}
                    {grounds.length > 1 && (
                        <div className="space-y-1.5">
                            <Label>Ground</Label>
                            <Select
                                value={groundId}
                                onValueChange={(v) => {
                                    setGroundId(v);
                                    resetSlot();
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select ground" />
                                </SelectTrigger>
                                <SelectContent>
                                    {grounds.map((g) => (
                                        <SelectItem key={g.id} value={g.id}>
                                            {g.name}
                                            {g.hourly_rate
                                                ? ` — ${g.currency || "BDT"} ${Number(g.hourly_rate).toLocaleString()}/hr`
                                                : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Date */}
                    <div className="space-y-1.5">
                        <Label>Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="h-4 w-4" />
                                    {date ? format(date, "PPP") : "Pick a date"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={(d) => {
                                        setDate(d);
                                        resetSlot();
                                    }}
                                    disabled={(d) => {
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        return d < today;
                                    }}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Slots */}
                    {dateStr && (
                        <div className="space-y-1.5">
                            <Label>Slot (90 min)</Label>
                            {slotsLoading ? (
                                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading slots…
                                </p>
                            ) : !slotRow ? (
                                <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                                    No slots configured for this date.
                                </p>
                            ) : (
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {SLOT_CODES.map((code) => {
                                        const available = Boolean(slotRow[code]);
                                        const active = slot === code;
                                        return (
                                            <button
                                                key={code}
                                                type="button"
                                                disabled={!available}
                                                onClick={() => setSlot(code)}
                                                className={cn(
                                                    "rounded-lg border px-2 py-2 text-xs font-semibold transition-colors",
                                                    active
                                                        ? "border-primary bg-primary text-primary-foreground"
                                                        : available
                                                            ? "border-border bg-card text-foreground hover:border-primary/60"
                                                            : "cursor-not-allowed border-border/50 bg-muted/40 text-muted-foreground/50 line-through"
                                                )}
                                            >
                                                {slotRangeLabel(code)}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Price */}
                    {slot && (
                        <div className="glass-neutral flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                            <span className="text-sm text-muted-foreground">Price</span>
                            {quoteLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : quote ? (
                                <span className="text-right">
                                    <span className="text-lg font-extrabold text-foreground">
                                        {currency} {Number(quote.final_price).toLocaleString()}
                                    </span>
                                    {quote.discount > 0 && (
                                        <span className="ml-2 text-xs text-muted-foreground line-through">
                                            {currency} {Number(quote.base_rate).toLocaleString()}
                                        </span>
                                    )}
                                </span>
                            ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                            )}
                        </div>
                    )}

                    {/* Promo */}
                    <div className="space-y-1.5">
                        <Label>Promo code (optional)</Label>
                        <Input
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                            placeholder="e.g. WEEKEND10"
                        />
                    </div>

                    {/* Attach event */}
                    {myOrganizedEvents.length > 0 && (
                        <div className="space-y-1.5">
                            <Label>Attach an event (optional)</Label>
                            <Select value={eventId} onValueChange={setEventId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="None" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {myOrganizedEvents.map((e) => (
                                        <SelectItem key={e.id} value={e.id}>
                                            {e.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Payment mode */}
                    <div className="space-y-2">
                        <Label>Payment</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setPayMode("unpaid")}
                                className={cn(
                                    "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors",
                                    payMode === "unpaid"
                                        ? "border-primary bg-primary/10 text-foreground"
                                        : "border-border text-muted-foreground hover:border-primary/50"
                                )}
                            >
                                <Ban className="h-4 w-4" /> Unpaid hold
                            </button>
                            <button
                                type="button"
                                onClick={() => setPayMode("paid")}
                                className={cn(
                                    "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors",
                                    payMode === "paid"
                                        ? "border-primary bg-primary/10 text-foreground"
                                        : "border-border text-muted-foreground hover:border-primary/50"
                                )}
                            >
                                <CreditCard className="h-4 w-4" /> Pay now
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {payMode === "unpaid"
                                ? "An unpaid booking doesn't lock the slot — someone can take it with payment."
                                : "A paid booking locks the slot and awaits the turf admin's verification."}
                        </p>
                    </div>

                    {/* Paid details */}
                    {payMode === "paid" && (
                        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4">
                            <div className="space-y-1.5">
                                <Label>Transaction number</Label>
                                <Input
                                    value={transactionId}
                                    onChange={(e) => setTransactionId(e.target.value)}
                                    placeholder="bKash / bank txn id"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Payment proof</Label>
                                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground hover:border-primary/60">
                                    <Upload className="h-4 w-4" />
                                    {proof ? proof.file.name : "Upload screenshot / receipt"}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            setProof(file ? { file } : null);
                                        }}
                                    />
                                </label>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Provide a transaction number and/or a proof image.
                            </p>
                        </div>
                    )}

                    <Button
                        className="w-full green-glow"
                        disabled={!slot || submitting}
                        onClick={onSubmit}
                    >
                        {submitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Check className="h-4 w-4" />
                        )}
                        {payMode === "paid" ? "Place paid booking" : "Place unpaid hold"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
