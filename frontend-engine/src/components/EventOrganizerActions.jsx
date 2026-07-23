"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { CalendarPlus, Link2, Loader2, Pencil, RefreshCw, Ticket, Trash2, TriangleAlert, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "./ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import {
    useUpdateEventMutation,
    useRematchEventMutation,
    useDeleteEventMutation,
    useGetMyBookingsQuery,
} from "@/store/api/apiSlice";
import AiRephraseButton from "./AiRephraseButton";
import { SPORTS } from "@/utils/constants";
import { slotRangeLabel } from "@/utils/slots";
import { getApiErrorMessage } from "@/utils/apiError";
import { notifySuccess, notifyError } from "@/lib/notify";

// A datetime-ish value ("1970-01-01T19:30:00Z" from an @db.Time column) -> "HH:mm"
// for a <input type="time">. Returns "" when absent.
const toTimeInput = (v) => (v ? format(new Date(v), "HH:mm") : "");
// A date value -> "yyyy-MM-dd" for a <input type="date">.
const toDateInput = (v) => (v ? format(new Date(v), "yyyy-MM-dd") : "");

// One-line label for a booking option (turf · ground · date · human slot time).
const bookingLabel = (b) => {
    const g = b.grounds;
    const date = b.booking_date ? format(new Date(b.booking_date), "d MMM") : "";
    const slot = b.slot?.code ? slotRangeLabel(b.slot.code) : "";
    return `${g?.turfs?.name ?? "Turf"} · ${g?.name ?? "Ground"} · ${date}${slot ? ` · ${slot}` : ""}`;
};

/**
 * Organizer / admin controls for a match, shown on the event detail page.
 *   - Edit match   (organizer only)  -> PATCH  /events/update-event/:id
 *   - Cancel match (organizer only)  -> DELETE /events/delete-event (soft cancel)
 *   - Rematch      (any match admin) -> POST   /events/:id/rematch
 *
 * Edit and Cancel are hidden for a settled match (completed/cancelled) — you can't
 * edit or re-cancel a finished game. "Rematch" stays enabled even on a finished one
 * (that's the point — a squad re-books after playing).
 */
// True when the caller is the organizer of this match.
function useIsOrganizer(event) {
    const { data: session } = useSession();
    const me = session?.user?.id;
    return !!me && me === event?.organizer?.id;
}

// True when the caller is a match ADMIN (organizer or an approved co-organizer).
function useIsAdmin(event) {
    const { data: session } = useSession();
    const me = session?.user?.id;
    const isOrganizer = !!me && me === event?.organizer?.id;
    const isCoOrganizer = (event?.participants || []).some(
        (p) =>
            (p.user_id ?? p.users?.id) === me &&
            p.role === "co_organizer" &&
            p.status === "approved"
    );
    return isOrganizer || isCoOrganizer;
}

export default function EventOrganizerActions({ event }) {
    const isOrganizer = useIsOrganizer(event);
    const settled = event?.status === "completed" || event?.status === "cancelled";

    // This row now holds only the organizer-only Edit + Cancel actions, both
    // blocked once the match is settled — so it renders nothing otherwise. Rematch
    // moved out to sit beside the join/leave CTA (see `RematchButton`).
    if (!isOrganizer || settled) return null;

    return (
        <div className="mb-6 flex flex-wrap items-center gap-3">
            <EditMatchDialog event={event} />
            <CancelMatchDialog event={event} />
        </div>
    );
}

// Standalone Rematch button — any match ADMIN (organizer or co-organizer) can
// clone the match and re-invite the squad, even after it's finished. Rendered in
// the hero CTA row beside the join/leave button; self-gates on admin so a plain
// player (or signed-out visitor) sees nothing.
export function RematchButton({ event }) {
    const isAdmin = useIsAdmin(event);
    if (!isAdmin) return null;
    return <RematchDialog event={event} />;
}

// ---------------------------------------------------------------------------
// Edit match
// ---------------------------------------------------------------------------
function EditMatchDialog({ event }) {
    const [open, setOpen] = useState(false);
    const [updateEvent, { isLoading }] = useUpdateEventMutation();
    const { data: myBookings = [] } = useGetMyBookingsQuery(undefined, { skip: !open });

    // Initial values snapshot — used both to seed the form and to diff on submit
    // (so we only send what actually changed, keeping the "material change"
    // participant notification honest).
    const initial = useMemo(
        () => ({
            title: event.title ?? "",
            description: event.description ?? "",
            sport_type: event.sport_type ?? "",
            skill_level_required: event.skill_level_required ?? "any",
            min_players: String(event.min_players ?? 1),
            max_players: String(event.max_players ?? 1),
            entry_fee: event.entry_fee != null ? String(event.entry_fee) : "",
            total_cost: event.total_cost != null ? String(event.total_cost) : "",
            cost_split_type: event.cost_split_type ?? "equal",
            event_date: toDateInput(event.event_date),
            start_time: toTimeInput(event.start_time),
            end_time: toTimeInput(event.end_time),
            booking_id: event.booking?.id ?? "",
        }),
        [event]
    );

    const [form, setForm] = useState(initial);
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    // Reset the form each time the dialog opens so stale edits don't linger.
    const onOpenChange = (v) => {
        if (v) setForm(initial);
        setOpen(v);
    };

    // Sport options: the canonical list plus the current value if it's not in it
    // (older events may store a differently-cased sport).
    const sportOptions = useMemo(() => {
        const opts = new Set(SPORTS.map((s) => s));
        if (initial.sport_type) opts.add(initial.sport_type);
        return [...opts];
    }, [initial.sport_type]);

    // Bookings the organizer can attach: their own, not cancelled, not already tied
    // to another match. The currently-attached booking is added so it stays visible.
    const bookingOptions = useMemo(() => {
        const attachable = myBookings.filter(
            (b) => !b.event_id && b.booking_status !== "cancelled"
        );
        if (event.booking && !attachable.some((b) => b.id === event.booking.id)) {
            // Represent the currently attached one from the event DTO.
            attachable.unshift({
                id: event.booking.id,
                grounds: { name: "", turfs: { name: "Attached booking" } },
                booking_date: event.booking.booking_date,
                slot: event.booking.slot,
            });
        }
        return attachable;
    }, [myBookings, event.booking]);

    // A newly selected booking overrides date/slot/ground server-side.
    const bookingChangedToNew =
        form.booking_id && form.booking_id !== initial.booking_id;
    // The match time is driven by its booking, so the schedule is editable ONLY
    // when there will be no booking. With a booking it's a confirmed slot; without
    // one it's a PROBABLE range the organizer sets by hand.
    const scheduleLocked = Boolean(form.booking_id);

    const submit = async () => {
        // Diff: include only changed fields.
        const payload = { eventId: event.id };
        for (const key of Object.keys(initial)) {
            if (form[key] !== initial[key]) payload[key] = form[key];
        }

        // Normalise types the backend expects.
        if (payload.min_players !== undefined) payload.min_players = Number(payload.min_players);
        if (payload.max_players !== undefined) payload.max_players = Number(payload.max_players);
        // Detach vs (re)attach: empty string -> null tells the API to unlink.
        if (Object.prototype.hasOwnProperty.call(payload, "booking_id")) {
            payload.booking_id = payload.booking_id || null;
        }

        // Nothing changed besides the id.
        if (Object.keys(payload).length === 1) {
            setOpen(false);
            return;
        }

        try {
            await updateEvent(payload).unwrap();
            notifySuccess("Match updated");
            setOpen(false);
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Couldn't update the match."));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" className="rounded-full gap-2">
                    <Pencil className="h-4 w-4" /> Edit match
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Edit match</DialogTitle>
                    <DialogDescription>
                        Change the details, squad size, cost, or re-attach a booking.
                        Players are notified when the date, time, or venue changes.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <Field label="Title">
                        <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
                    </Field>

                    <Field label="Description">
                        {/* Relative wrapper so the AI button sits in the box's
                            bottom-right; extra bottom padding keeps text off it. */}
                        <div className="relative">
                            <Textarea
                                className="min-h-20 pb-12"
                                placeholder="What's the match about? (Banglish is fine — AI can polish it)"
                                value={form.description}
                                onChange={(e) => set("description", e.target.value)}
                            />
                            <AiRephraseButton
                                kind="event"
                                getText={() => form.description}
                                onResult={(t) => set("description", t)}
                            />
                        </div>
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Sport">
                            <Select value={form.sport_type} onValueChange={(v) => set("sport_type", v)}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Sport" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sportOptions.map((s) => (
                                        <SelectItem key={s} value={s} className="capitalize">
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Skill level">
                            <Select
                                value={form.skill_level_required}
                                onValueChange={(v) => set("skill_level_required", v)}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Skill" />
                                </SelectTrigger>
                                <SelectContent>
                                    {["any", "beginner", "intermediate", "advanced", "professional"].map((s) => (
                                        <SelectItem key={s} value={s} className="capitalize">
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Min players">
                            <Input
                                type="number"
                                min={1}
                                value={form.min_players}
                                onChange={(e) => set("min_players", e.target.value)}
                            />
                        </Field>
                        <Field label="Max players">
                            <Input
                                type="number"
                                min={1}
                                value={form.max_players}
                                onChange={(e) => set("max_players", e.target.value)}
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Entry fee (৳)">
                            <Input
                                type="number"
                                min={0}
                                value={form.entry_fee}
                                onChange={(e) => set("entry_fee", e.target.value)}
                            />
                        </Field>
                        <Field label="Total cost (৳)">
                            <Input
                                type="number"
                                min={0}
                                value={form.total_cost}
                                onChange={(e) => set("total_cost", e.target.value)}
                            />
                        </Field>
                    </div>

                    <Field label="Cost split">
                        <Select value={form.cost_split_type} onValueChange={(v) => set("cost_split_type", v)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Split" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="equal">Equal</SelectItem>
                                <SelectItem value="organizer_pays">Organizer pays</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                        </Select>
                    </Field>

                    {/* Re-attach / detach a booking */}
                    <Field label="Attached booking">
                        <div className="space-y-2">
                            <Select
                                value={form.booking_id || "none"}
                                onValueChange={(v) => set("booking_id", v === "none" ? "" : v)}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="No booking" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">
                                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                                            <X className="h-3.5 w-3.5" /> No booking (detach)
                                        </span>
                                    </SelectItem>
                                    {bookingOptions.map((b) => (
                                        <SelectItem key={b.id} value={b.id}>
                                            <span className="inline-flex items-center gap-2">
                                                <Ticket className="h-3.5 w-3.5 text-primary" />
                                                {bookingLabel(b)}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {bookingChangedToNew ? (
                                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Link2 className="h-3.5 w-3.5" />
                                    Date, time and ground will be set from this booking.
                                </p>
                            ) : scheduleLocked ? (
                                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Link2 className="h-3.5 w-3.5" />
                                    Time is set by the attached booking. Choose “No booking” to set a probable time.
                                </p>
                            ) : null}
                        </div>
                    </Field>

                    {/* Schedule — editable only when there's no booking (probable range);
                        a booking makes it a confirmed, read-only slot. */}
                    <fieldset
                        className="rounded-xl border border-border p-4"
                        disabled={scheduleLocked}
                    >
                        <legend className="px-2 text-xs text-muted-foreground">
                            {scheduleLocked ? "Schedule (from booking)" : "Probable time"}
                        </legend>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <Field label="Date">
                                <Input
                                    type="date"
                                    value={form.event_date}
                                    onChange={(e) => set("event_date", e.target.value)}
                                />
                            </Field>
                            <Field label="Start">
                                <Input
                                    type="time"
                                    value={form.start_time}
                                    onChange={(e) => set("start_time", e.target.value)}
                                />
                            </Field>
                            <Field label="End">
                                <Input
                                    type="time"
                                    value={form.end_time}
                                    onChange={(e) => set("end_time", e.target.value)}
                                />
                            </Field>
                        </div>
                    </fieldset>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={isLoading} className="green-glow gap-2">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                        Save changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Rematch
// ---------------------------------------------------------------------------
function RematchDialog({ event }) {
    const [open, setOpen] = useState(false);
    const [rematch, { isLoading }] = useRematchEventMutation();
    const [date, setDate] = useState("");
    const [start, setStart] = useState(toTimeInput(event.start_time));
    const [end, setEnd] = useState(toTimeInput(event.end_time));

    const submit = async () => {
        if (!date || !start || !end) {
            notifyError("Pick a new date, start and end time.");
            return;
        }
        try {
            await rematch({
                eventId: event.id,
                event_date: date,
                start_time: start,
                end_time: end,
            }).unwrap();
            notifySuccess("Rematch created", "Your squad has been invited to confirm.");
            setOpen(false);
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Couldn't create the rematch."));
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="lg" variant="outline" className="rounded-full gap-2 px-8">
                    <RefreshCw className="h-4 w-4" /> Rematch
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarPlus className="h-5 w-5 text-primary" /> Schedule a rematch
                    </DialogTitle>
                    <DialogDescription>
                        Clones this match into a new one and re-invites the same squad to
                        confirm for the new date. Pick a booking for it afterwards.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-3">
                    <Field label="New date">
                        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </Field>
                    <Field label="Start">
                        <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                    </Field>
                    <Field label="End">
                        <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                    </Field>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={isLoading} className="green-glow gap-2">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Create rematch
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Cancel match (soft delete)
// ---------------------------------------------------------------------------
// "Delete" is a SOFT CANCEL on the backend: the match flips to `cancelled`, its
// booking is freed, and the squad is notified — but chat/comments/history are
// kept. Destructive enough to warrant an explicit confirm step.
function CancelMatchDialog({ event }) {
    const [open, setOpen] = useState(false);
    const [cancelMatch, { isLoading }] = useDeleteEventMutation();

    const submit = async () => {
        try {
            await cancelMatch(event.id).unwrap();
            notifySuccess("Match cancelled", "Your squad has been notified.");
            setOpen(false);
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Couldn't cancel the match."));
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="rounded-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                    <Trash2 className="h-4 w-4" /> Cancel match
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <TriangleAlert className="h-5 w-5 text-destructive" /> Cancel this match?
                    </DialogTitle>
                    <DialogDescription>
                        The match will be marked <span className="font-semibold">cancelled</span> and
                        removed from the feeds. Everyone who joined is notified, and any attached
                        booking is freed. Chat and comments are kept. This can’t be undone from here.
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>
                        Keep match
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={submit}
                        disabled={isLoading}
                        className="gap-2"
                    >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Cancel match
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Field({ label, children }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            {children}
        </div>
    );
}
