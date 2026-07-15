"use client";

import InputField from "@/components/InputField";
import RequiredSign from "@/components/RequiredSign";
import { BookingStatusBadge, HoldExpiryBadge, PaymentStatusBadge } from "@/components/BookingStatus";
import SportIcon from "@/components/icons/SportIcon";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateEventMutation, useGetMyBookingsQuery, useGetVenuesQuery } from "@/store/api/apiSlice";
import { getApiErrorMessage } from "@/utils/apiError";
import { slotRangeLabel } from "@/utils/slots";
import { format } from "date-fns";
import AiRephraseButton from "@/components/AiRephraseButton";
import { CalendarIcon, CircleDollarSign, Info, Link2, MapPin, Ticket, Trophy, Users, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

// Slot code ("t1930") -> the 90-minute grid times the backend expects on ::time
// columns ("19:30" / "21:00"). Mirrors utils/slots.js so the two never drift.
const slotTimes = (code) => {
    if (!code) return { start: "", end: "" };
    const h = parseInt(code.slice(1, 3), 10);
    const m = parseInt(code.slice(3, 5), 10);
    const pad = (n) => String(n).padStart(2, "0");
    const total = h * 60 + m + 90;
    return { start: `${pad(h)}:${pad(m)}`, end: `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}` };
};

// One-line label for a booking option: turf · ground · date + human slot time
// ("7:30 – 9:00 PM"), never the raw code.
const bookingLabel = (b) => {
    const g = b.grounds;
    const date = b.booking_date ? format(new Date(b.booking_date), "d MMM") : "";
    const slot = b.slot?.code ? slotRangeLabel(b.slot.code) : "";
    return `${g?.turfs?.name ?? "Turf"} · ${g?.name ?? "Ground"} · ${date}${slot ? ` · ${slot}` : ""}`;
};

// The sports a booking's ground supports (array or single value, cleaned).
const groundSports = (b) => {
    const sp = b?.grounds?.sport_type;
    return (Array.isArray(sp) ? sp : [sp]).filter(Boolean);
};

// A section card — keeps the long form scannable instead of one endless column.
function Section({ icon: Icon, title, subtitle, children }) {
    return (
        <section className="glass-card rounded-2xl p-5 md:p-6">
            <div className="mb-5 flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-4.5 w-4.5" />
                </span>
                <div>
                    <h2 className="text-base font-bold text-foreground">{title}</h2>
                    {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
                </div>
            </div>
            {children}
        </section>
    );
}

// A locked, read-only field — shows a value pulled from the attached booking that
// the organizer can't change here (venue/ground/date/slot are fixed by the booking).
function ReadOnlyField({ label, value }) {
    return (
        <div className="space-y-2">
            <Label className="text-muted-foreground">{label}</Label>
            <div className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-sm font-medium text-foreground">
                {value || "—"}
            </div>
        </div>
    );
}

export default function EventCreationForm() {
    const router = useRouter();
    const { status } = useSession();
    const { data: venues = [] } = useGetVenuesQuery();
    // The caller's own bookings — used to offer "attach a booking" to the match.
    const { data: myBookings = [] } = useGetMyBookingsQuery();
    const [createEvent, { isLoading: isSubmitting }] = useCreateEventMutation();
    const [submitError, setSubmitError] = useState(null);

    const [grounds, setGrounds] = useState([]);
    const [sports, setSports] = useState([]);

    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
        watch,
        setValue,
    } = useForm({
        defaultValues: {
            title: "",
            venue_id: "",
            ground_id: "",
            sport_type: "",
            event_date: null,
            start_time: "",
            end_time: "",
            description: "",
            max_players: 1,
            min_players: 1,
            event_type: "friendly",
            skill_level_required: "any",
            total_cost: "",
            cost_split_type: "equal",
            booking_id: "",
        },
    });

    // Bookings that can still be tied to a match: the caller's own, not cancelled,
    // and not already attached to some other event.
    const attachableBookings = myBookings.filter(
        (b) => !b.event_id && b.booking_status !== "cancelled"
    );
    const attachedId = watch("booking_id");
    const attachedBooking = myBookings.find((b) => b.id === attachedId) || null;
    // When a booking is attached, its ground/date/slot are fixed by the reservation
    // — lock those inputs so the two can't drift apart.
    const locked = Boolean(attachedId);

    // Attach a booking: everything the match needs (venue, ground, sport options,
    // date, slot) comes straight off the booking — no dependency on the venues feed
    // matching, which is why ground/sport were coming up blank before.
    const attachBooking = (bookingId) => {
        const b = myBookings.find((x) => x.id === bookingId);
        if (!b) return;
        const g = b.grounds;
        const sp = groundSports(b);
        const { start, end } = slotTimes(b.slot?.code);

        setValue("booking_id", bookingId);
        setValue("venue_id", g?.turfs?.id ?? "");
        setValue("ground_id", g?.id ?? "");
        setSports(sp);
        // Single-sport ground -> preselect; multi-sport still needs a choice.
        setValue("sport_type", sp.length === 1 ? sp[0] : "");
        if (b.booking_date) setValue("event_date", new Date(b.booking_date));
        setValue("start_time", start);
        setValue("end_time", end);
    };

    // Detach: clear the link and re-open the venue/slot fields for manual entry.
    const detachBooking = () => {
        setValue("booking_id", "");
        setValue("venue_id", "");
        setValue("ground_id", "");
        setValue("sport_type", "");
        setValue("event_date", null);
        setValue("start_time", "");
        setValue("end_time", "");
        setGrounds([]);
        setSports([]);
    };

    const onSubmit = async (values) => {
        setSubmitError(null);
        try {
            // organizer identity comes from the auth token on the backend.
            // `min_Players` / `current_players` match the backend contract
            // (fn_create_event); current_players stays empty here — teammate
            // invites are a separate flow.
            const payload = {
                title: values.title,
                description: values.description,
                sport_type: values.sport_type,
                event_type: values.event_type,
                event_date: values.event_date ? format(values.event_date, "yyyy-MM-dd") : null,
                start_time: values.start_time,
                end_time: values.end_time,
                venue_id: values.venue_id,
                ground_id: values.ground_id,
                max_players: Number(values.max_players),
                min_Players: Number(values.min_players),
                current_players: [],
                skill_level_required: values.skill_level_required,
                total_cost: values.total_cost,
                cost_split_type: values.cost_split_type,
                ...(values.booking_id ? { booking_id: values.booking_id } : {}),
            };
            const data = await createEvent(payload).unwrap();
            if (data?.success) {
                const newId = data?.data?.id;
                router.push(newId ? `/events/${newId}` : "/events");
            }
        } catch (error) {
            console.error(error);
            setSubmitError(getApiErrorMessage(error, "Failed to create event."));
        }
    };

    if (status === "loading") return null;
    if (status === "unauthenticated") redirect("/login");

    return (
        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {submitError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-center text-sm font-medium text-destructive">
                    {submitError}
                </div>
            )}

            {/* ---- Attach a booking (optional) ---- */}
            <Section
                icon={Ticket}
                title="Attach a booking"
                subtitle="Optional — tie this match to a ground you've already reserved."
            >
                {attachedBooking ? (
                    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-primary">
                                    <Link2 className="h-3.5 w-3.5" /> Attached booking
                                </div>
                                <p className="truncate text-sm font-semibold text-foreground">
                                    {bookingLabel(attachedBooking)}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <BookingStatusBadge status={attachedBooking.booking_status} />
                                    <PaymentStatusBadge status={attachedBooking.payment_status} />
                                    {attachedBooking.hold_expires_at && (
                                        <HoldExpiryBadge expiresAt={attachedBooking.hold_expires_at} />
                                    )}
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={detachBooking}
                                className="shrink-0 text-muted-foreground hover:text-destructive"
                            >
                                <X className="h-4 w-4" /> Detach
                            </Button>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                            Venue, ground, date and slot are set from this booking.
                        </p>
                    </div>
                ) : attachableBookings.length > 0 ? (
                    <div className="space-y-2">
                        <Label>Pick one of your bookings</Label>
                        <Select value="" onValueChange={attachBooking}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a booking to attach" />
                            </SelectTrigger>
                            <SelectContent>
                                {attachableBookings.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>
                                        {bookingLabel(b)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                ) : (
                    <p className="flex items-center gap-2 rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                        <Info className="h-4 w-4 shrink-0" />
                        No attachable bookings. Book a ground first, or fill the slot in
                        manually below.
                    </p>
                )}
            </Section>

            {/* ---- Basics ---- */}
            <Section icon={Info} title="Basics" subtitle="What's the match?">
                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label>Event Title <RequiredSign /></Label>
                        <InputField errors={errors}>
                            <Input
                                type="text"
                                id="title"
                                placeholder="e.g. Friday Night Football"
                                className={`${errors?.title ? "border-2 border-red-500" : ""}`}
                                {...register("title", { required: "Event title is required" })}
                            />
                        </InputField>
                    </div>

                    <div className="space-y-2">
                        <Label>Event Details</Label>
                        <InputField errors={errors}>
                            {/* Relative wrapper so the AI button can sit in the box's
                                bottom-right corner. Extra bottom padding keeps typed
                                text from sliding under the button. */}
                            <div className="relative">
                                <Textarea
                                    id="description"
                                    placeholder="Tell players what to expect… (Banglish is fine — AI can polish it)"
                                    className={`min-h-28 pb-12 ${errors?.description ? "border-2 border-red-500" : ""}`}
                                    {...register("description")}
                                />
                                <AiRephraseButton
                                    kind="event"
                                    getText={() => watch("description")}
                                    onResult={(t) => setValue("description", t, { shouldDirty: true })}
                                />
                            </div>
                        </InputField>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Event Type <RequiredSign /></Label>
                            <InputField errors={errors}>
                                <Controller
                                    name="event_type"
                                    control={control}
                                    rules={{ required: "Select a type" }}
                                    render={({ field }) => (
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger className={`w-full ${errors?.event_type ? "border-2 border-red-500" : ""}`}>
                                                <SelectValue placeholder="Select Event Type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="friendly">Friendly</SelectItem>
                                                <SelectItem value="tournament">Tournament</SelectItem>
                                                <SelectItem value="practice">Practice</SelectItem>
                                                <SelectItem value="league">League</SelectItem>
                                                <SelectItem value="pickup">Pickup</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </InputField>
                        </div>
                        <div className="space-y-2">
                            <Label>Skill Level <RequiredSign /></Label>
                            <InputField errors={errors}>
                                <Controller
                                    name="skill_level_required"
                                    control={control}
                                    rules={{ required: "Select a skill" }}
                                    render={({ field }) => (
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select skill level" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="any">Any</SelectItem>
                                                <SelectItem value="beginner">Beginner</SelectItem>
                                                <SelectItem value="intermediate">Intermediate</SelectItem>
                                                <SelectItem value="advanced">Advanced</SelectItem>
                                                <SelectItem value="professional">Professional</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </InputField>
                        </div>
                    </div>
                </div>
            </Section>

            {/* ---- Venue & Slot ---- */}
            <Section
                icon={MapPin}
                title="Venue & Slot"
                subtitle={locked ? "Set from the attached booking." : "Where and when."}
            >
                {locked && attachedBooking ? (
                    // Booking attached: venue/ground/date/slot are fixed by the
                    // reservation, so show them read-only (still submitted via the
                    // hidden form values). Only Sport stays a choice — a ground can
                    // support several sports, and the match picks one.
                    <div className="space-y-5">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <ReadOnlyField label="Venue" value={attachedBooking.grounds?.turfs?.name} />
                            <ReadOnlyField label="Ground" value={attachedBooking.grounds?.name} />
                            <ReadOnlyField
                                label="Date"
                                value={attachedBooking.booking_date ? format(new Date(attachedBooking.booking_date), "PPP") : "—"}
                            />
                            <ReadOnlyField
                                label="Slot"
                                value={attachedBooking.slot?.code ? slotRangeLabel(attachedBooking.slot.code) : "—"}
                            />
                        </div>

                        <div className="space-y-2 sm:max-w-xs">
                            <Label>Sport <RequiredSign /></Label>
                            <InputField errors={errors}>
                                <Controller
                                    name="sport_type"
                                    control={control}
                                    rules={{ required: "Select a sport" }}
                                    render={({ field }) => (
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger className={`w-full ${errors?.sport_type ? "border-2 border-red-500" : ""}`}>
                                                <SelectValue placeholder="Select Sport" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {sports.map((sport) => (
                                                    <SelectItem key={sport} value={sport}>
                                                        <span className="flex items-center gap-2 capitalize">
                                                            <SportIcon sport={sport} className="h-4 w-4 text-primary" />
                                                            {sport}
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </InputField>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-5">
                        <div className="grid gap-5 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Venue <RequiredSign /></Label>
                                <InputField errors={errors}>
                                    <Controller
                                        name="venue_id"
                                        control={control}
                                        rules={{ required: "Select a venue" }}
                                        render={({ field }) => (
                                            <Select
                                                value={field.value}
                                                onValueChange={(value) => {
                                                    field.onChange(value);
                                                    const gs = venues.find((v) => v.id === value)?.grounds;
                                                    setGrounds(gs || []);
                                                    setValue("ground_id", "");
                                                    setValue("sport_type", "");
                                                    setSports([]);
                                                }}
                                            >
                                                <SelectTrigger className={`w-full ${errors?.venue_id ? "border-2 border-red-500" : ""}`}>
                                                    <SelectValue placeholder="Select Venue" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {venues.map((venue) => (
                                                        <SelectItem key={venue.id} value={venue.id}>
                                                            {venue.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </InputField>
                            </div>

                            <div className="space-y-2">
                                <Label>Ground <RequiredSign /></Label>
                                <InputField errors={errors}>
                                    <Controller
                                        name="ground_id"
                                        control={control}
                                        rules={{ required: "Select a ground" }}
                                        render={({ field }) => (
                                            <Select
                                                value={field.value}
                                                onValueChange={(value) => {
                                                    field.onChange(value);
                                                    const sp = grounds.find((g) => g.id === value)?.sport_type;
                                                    setSports(Array.isArray(sp) ? sp : [sp].filter(Boolean));
                                                    setValue("sport_type", "");
                                                }}
                                            >
                                                <SelectTrigger className={`w-full ${errors?.ground_id ? "border-2 border-red-500" : ""}`}>
                                                    <SelectValue placeholder="Select Ground" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {grounds.map((ground) => (
                                                        <SelectItem key={ground.id} value={ground.id}>
                                                            {ground.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </InputField>
                            </div>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Sport <RequiredSign /></Label>
                                <InputField errors={errors}>
                                    <Controller
                                        name="sport_type"
                                        control={control}
                                        rules={{ required: "Select a sport" }}
                                        render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className={`w-full ${errors?.sport_type ? "border-2 border-red-500" : ""}`}>
                                                    <SelectValue placeholder="Select Sport" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {sports.map((sport) => (
                                                        <SelectItem key={sport} value={sport}>
                                                            <span className="flex items-center gap-2 capitalize">
                                                                <SportIcon sport={sport} className="h-4 w-4 text-primary" />
                                                                {sport}
                                                            </span>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </InputField>
                            </div>

                            <div className="space-y-2">
                                <Label>Date <RequiredSign /></Label>
                                <InputField errors={errors}>
                                    <Controller
                                        name="event_date"
                                        control={control}
                                        rules={{ required: "Pick a date" }}
                                        render={({ field }) => (
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        data-empty={!field.value}
                                                        className={`w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground ${errors?.event_date ? "border-2 border-red-500" : ""}`}
                                                    >
                                                        <CalendarIcon />
                                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
                                                </PopoverContent>
                                            </Popover>
                                        )}
                                    />
                                </InputField>
                            </div>
                        </div>

                        <fieldset className="rounded-xl border border-border p-4">
                            <legend className="px-2 text-sm text-muted-foreground">Slot</legend>
                            <div className="grid gap-5 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Start Time <RequiredSign /></Label>
                                    <InputField errors={errors}>
                                        <Input
                                            type="time"
                                            className={`${errors?.start_time ? "border-2 border-red-500" : ""}`}
                                            {...register("start_time", { required: "Start time is required" })}
                                        />
                                    </InputField>
                                </div>
                                <div className="space-y-2">
                                    <Label>End Time <RequiredSign /></Label>
                                    <InputField errors={errors}>
                                        <Input
                                            type="time"
                                            className={`${errors?.end_time ? "border-2 border-red-500" : ""}`}
                                            {...register("end_time", { required: "End time is required" })}
                                        />
                                    </InputField>
                                </div>
                            </div>
                        </fieldset>
                    </div>
                )}
            </Section>

            {/* ---- Squad ---- */}
            <Section icon={Users} title="Squad" subtitle="How many players?">
                <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Minimum Players <RequiredSign /></Label>
                        <InputField errors={errors}>
                            <Input
                                type="number"
                                className={`${errors?.min_players ? "border-2 border-red-500" : ""}`}
                                {...register("min_players", {
                                    required: "Enter the minimum players required",
                                    min: { value: 1, message: "Minimum players must be at least 1" },
                                })}
                            />
                        </InputField>
                    </div>
                    <div className="space-y-2">
                        <Label>Maximum Players <RequiredSign /></Label>
                        <InputField errors={errors}>
                            <Input
                                type="number"
                                className={`${errors?.max_players ? "border-2 border-red-500" : ""}`}
                                {...register("max_players", {
                                    required: "Enter the maximum players allowed",
                                    min: { value: 1, message: "Maximum players must be at least 1" },
                                    validate: (value) => {
                                        const minPlayers = Number(watch("min_players"));
                                        return (
                                            Number(value) >= minPlayers ||
                                            `Maximum cannot be less than minimum (${minPlayers})`
                                        );
                                    },
                                })}
                            />
                        </InputField>
                    </div>
                </div>
            </Section>

            {/* ---- Cost ---- */}
            <Section icon={CircleDollarSign} title="Cost" subtitle="What players pay and how it's split.">
                <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Total Cost (BDT) <RequiredSign /></Label>
                        <InputField errors={errors}>
                            <Input
                                type="number"
                                className={`${errors?.total_cost ? "border-2 border-red-500" : ""}`}
                                {...register("total_cost", {
                                    required: "Enter the event cost",
                                    min: { value: 1, message: "Cost must be greater than 0" },
                                })}
                            />
                        </InputField>
                    </div>
                    <div className="space-y-2">
                        <Label>Cost Split <RequiredSign /></Label>
                        <InputField errors={errors}>
                            <Controller
                                name="cost_split_type"
                                control={control}
                                rules={{ required: "Select a split" }}
                                render={({ field }) => (
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger className={`w-full ${errors?.cost_split_type ? "border-2 border-red-500" : ""}`}>
                                            <SelectValue placeholder="Select split" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="equal">Equal</SelectItem>
                                            <SelectItem value="organizer_pays">Organizer Pays</SelectItem>
                                            <SelectItem value="custom">Custom</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </InputField>
                    </div>
                </div>
            </Section>

            {/* ---- Sticky submit bar ---- */}
            <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-3 rounded-t-2xl border-t border-border bg-background/80 px-1 py-4 backdrop-blur">
                <Button type="button" variant="ghost" onClick={() => router.push("/events")}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="green-glow min-w-40 gap-2">
                    <Trophy className="h-4 w-4" />
                    {isSubmitting ? "Creating…" : "Create Match"}
                </Button>
            </div>
        </form>
    );
}
