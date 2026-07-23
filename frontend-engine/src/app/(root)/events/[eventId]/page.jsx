import EventAdminPanel from "@/components/EventAdminPanel"
import EventOrganizerActions, { RematchButton } from "@/components/EventOrganizerActions"
import EventJoinButton from "@/components/EventJoinButton"
import EventRealtime from "@/components/EventRealtime"
import EventSquad from "@/components/EventSquad"
import { BookingStatusBadge, HoldExpiryBadge, PaymentStatusBadge } from "@/components/BookingStatus"
import EventListWrapper from "@/components/EventListWrapper"
import MapDialog from "@/components/MapDialog"
import RulesAndComments from "@/components/RulesAndComments"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getIndividualEventByEventId } from "@/utils/getData"
import { getLocationString } from "@/utils/utility-functions"
import { slotRangeLabel } from "@/utils/slots"
import { format } from "date-fns"
import {
    ArrowRight,
    CalendarDays,
    Clock,
    MapPin,
    Receipt,
    Sparkles,
    Ticket,
    Trophy,
    Users,
} from "lucide-react"
import SportIcon from "@/components/icons/SportIcon"
import Link from "next/link"

export default async function EventDetails({ params }) {
    const { eventId } = await params;
    const { data: event } = await getIndividualEventByEventId(eventId);

    const {
        title,
        organizer,
        event_date,
        start_time,
        end_time,
        ground,
        rules,
        max_players,
        min_players,
        current_players,
        booking,
    } = event;

    const sport = event.sport_type || ground?.sport_type;
    // A match's time is only "confirmed" when a booking backs it; otherwise the
    // start/end are a probable range the organizer set by hand.
    const scheduleConfirmed = event.schedule_confirmed ?? Boolean(booking);
    const min = min_players ?? 0;
    const cur = current_players ?? 0;
    const isFull = min > 0 && cur >= min;
    const spotsLeft = Math.max(min - cur, 0);

    const organizerName = organizer
        ? `${organizer.first_name ?? ""} ${organizer.last_name ?? ""}`.trim()
        : "Unknown";

    // Map location: prefer stored coords, else geocode the address string.
    const addr = ground?.turf?.address_line_1;
    const mapLat = Number(addr?.latitude);
    const mapLng = Number(addr?.longitude);
    const mapLabel = ground
        ? `${ground.name}${ground.turf ? `, ${ground.turf.name}` : ""}`
        : "Venue";
    const mapAddress = [ground?.turf?.name, addr ? getLocationString(addr) : null]
        .filter(Boolean)
        .join(", ");

    return (
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 md:px-8 md:pt-24">
            {/* Live wiring: subscribes to the match room and refetches squad/requests
                on any roster change. Renders nothing. The squad chat now lives in the
                navbar chat box (ChatLauncher), not as a floating head here. */}
            <EventRealtime eventId={event.id} />

            {/* HERO */}
            <section className="relative isolate overflow-hidden rounded-[2rem] border border-border bg-gradient-to-b from-[#eaf2ee] to-[#e6f1ec] p-6 dark:from-[#0a1412] dark:to-[#0a0a0a] md:p-10">
                {/* ambient glows */}
                <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-teal/20 blur-[120px]" />
                <div className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-primary/15 blur-[120px]" />
                {/* dotted texture */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.15] dark:opacity-[0.1]"
                    style={{
                        backgroundImage:
                            "radial-gradient(rgba(29,185,84,0.5) 1px, transparent 1px)",
                        backgroundSize: "22px 22px",
                        maskImage:
                            "radial-gradient(ellipse at top, black, transparent 80%)",
                        WebkitMaskImage:
                            "radial-gradient(ellipse at top, black, transparent 80%)",
                    }}
                />

                <div className="relative flex flex-col gap-6">
                    {/* top row: sport + status */}
                    <div className="flex items-center justify-between">
                        {sport && (
                            <span className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize text-foreground">
                                <SportIcon sport={sport} className="h-3.5 w-3.5 text-primary" />
                                {sport}
                            </span>
                        )}
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                                isFull
                                    ? "bg-destructive/15 text-destructive"
                                    : "bg-primary/15 text-primary"
                            }`}
                        >
                            <Users className="h-3.5 w-3.5" />
                            {isFull ? "Squad full" : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`}
                        </span>
                    </div>

                    {/* title */}
                    <h1 className="max-w-2xl bg-gradient-to-r from-brand to-teal bg-clip-text text-3xl font-extrabold leading-tight text-transparent dark:from-brand-light md:text-5xl">
                        {title}
                    </h1>

                    {/* organizer */}
                    <Link
                        href={organizer?.id ? `/profile/${organizer.id}` : "#"}
                        className="inline-flex w-fit items-center gap-3"
                    >
                        <Avatar className="h-11 w-11 ring-2 ring-primary/30">
                            <AvatarImage src={organizer?.profile_picture_url} alt={organizerName} />
                            <AvatarFallback>
                                {organizerName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Organized by
                            </p>
                            <p className="font-bold text-foreground">{organizerName}</p>
                        </div>
                    </Link>

                    {/* meta pills */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <MetaPill
                            icon={CalendarDays}
                            label={event_date ? format(new Date(event_date), "EEEE, d MMMM yyyy") : "Date TBA"}
                            sub={
                                start_time && end_time
                                    ? `${format(new Date(start_time), "h:mm a")} – ${format(new Date(end_time), "h:mm a")}${scheduleConfirmed ? "" : " · probable"}`
                                    : null
                            }
                            badge={scheduleConfirmed ? null : "Probable"}
                        />
                        <MetaPill
                            icon={MapPin}
                            label={ground ? `${ground.name}${ground.turf ? `, ${ground.turf.name}` : ""}` : "Venue TBA"}
                            sub={ground?.turf?.address_line_1 ? getLocationString(ground.turf.address_line_1) : null}
                            action={
                                <MapDialog
                                    compact
                                    lat={mapLat}
                                    lng={mapLng}
                                    address={mapAddress}
                                    label={mapLabel}
                                />
                            }
                        />
                    </div>

                    {/* CTA — join/leave, then Rematch (admins only), then map. */}
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <EventJoinButton event={event} isFull={isFull} />
                        <RematchButton event={event} />
                        <MapDialog
                            lat={mapLat}
                            lng={mapLng}
                            address={mapAddress}
                            label={mapLabel}
                        />
                    </div>
                </div>
            </section>

            {/* BODY */}
            <div className="mt-8 grid gap-6 lg:grid-cols-3">
                {/* left: details / rules / comments */}
                <div className="lg:col-span-2">
                    {/* organizer/admin: edit match + rematch (clone & re-invite squad) */}
                    <EventOrganizerActions event={event} />

                    {/* admin-only: pending join requests + manage admins */}
                    <EventAdminPanel event={event} />

                    {/* Attached booking — the ground reservation this match runs on.
                        Shows the live hold countdown while it's still an unpaid hold. */}
                    {booking && <BookingCard booking={booking} />}

                    {/* quick stats */}
                    <div className="mb-6 grid grid-cols-3 gap-4">
                        <StatCard icon={Users} value={`${cur}/${min || "—"}`} label="Joined" />
                        <StatCard icon={Trophy} value={max_players ?? "—"} label="Max players" />
                        <StatCard
                            icon={Clock}
                            value={formatDuration(start_time, end_time)}
                            label="Duration"
                        />
                    </div>

                    <div className="glass-card rounded-3xl p-5 md:p-7">
                        {/* Comments read publicly; posting is gated server-side to
                            approved players (the API returns `can_comment`). */}
                        <RulesAndComments rules={rules} eventId={event.id} />
                    </div>
                </div>

                {/* right: squad — live (real roster, updates on join/accept/leave) */}
                <EventSquad eventId={event.id} initialEvent={event} />
            </div>

            {/* SIMILAR EVENTS */}
            <div className="mt-16">
                <div className="mb-2 flex items-end justify-between">
                    <div>
                        <span className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            Keep playing
                        </span>
                        <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
                            Similar{" "}
                            <span className="bg-gradient-to-r from-brand to-teal bg-clip-text text-transparent dark:from-brand-light">
                                Matches
                            </span>
                        </h2>
                    </div>
                    <Link
                        href="/events"
                        className="group inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2.5 text-sm font-semibold text-primary backdrop-blur-md transition-all duration-300 hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_28px_rgba(29,185,84,0.45)]"
                    >
                        See all
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                </div>
                <div className="mt-6">
                    <EventListWrapper />
                </div>
            </div>
        </div>
    )
}

// "1h 30m" / "2h" / "45m" from two datetime-ish values. No rounding to whole hours
// (that's why a 90-min slot used to read "2h").
function formatDuration(start, end) {
    if (!start || !end) return "—";
    const mins = Math.max(Math.round((new Date(end) - new Date(start)) / 60000), 0);
    if (mins === 0) return "—";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
}

function MetaPill({ icon: Icon, label, sub, action, badge }) {
    return (
        <div className="glass-chip flex items-center gap-3 rounded-2xl px-4 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-foreground">{label}</p>
                    {badge && (
                        <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                            {badge}
                        </span>
                    )}
                </div>
                {sub && <p className="truncate text-sm text-muted-foreground">{sub}</p>}
            </div>
            {action}
        </div>
    );
}

// The reservation this match is tied to. When the booking is an unpaid hold, the
// HoldExpiryBadge ticks down live — the organizer sees exactly how long they have
// to pay before the slot frees up (and the match loses its ground).
function BookingCard({ booking }) {
    const slot = booking.slot || {};
    // Human slot time ("7:30 – 9:00 PM"), decoded from the grid code — never "t1930".
    const slotLabel = slot.code ? slotRangeLabel(slot.code) : null;
    const amount = booking.final_amount ?? booking.total_amount;
    const isUnpaidHold = Boolean(booking.hold_expires_at);

    return (
        <div className="glass-card mb-6 rounded-3xl p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Ticket className="h-4.5 w-4.5" />
                    </span>
                    <div>
                        <h2 className="text-base font-bold text-foreground">Reserved ground</h2>
                        <p className="text-xs text-muted-foreground">This match's booking</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <BookingStatusBadge status={booking.booking_status} />
                    <PaymentStatusBadge status={booking.payment_status} />
                </div>
            </div>

            {/* Live hold countdown — only while it's an unpaid hold. */}
            {isUnpaidHold && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
                    <HoldExpiryBadge expiresAt={booking.hold_expires_at} />
                    <span className="text-muted-foreground">Pay before the hold runs out to keep this slot.</span>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex items-center gap-2.5">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <div>
                        <p className="text-xs text-muted-foreground">Date</p>
                        <p className="text-sm font-semibold text-foreground">
                            {booking.booking_date ? format(new Date(booking.booking_date), "d MMM yyyy") : "—"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5">
                    <Clock className="h-4 w-4 text-primary" />
                    <div>
                        <p className="text-xs text-muted-foreground">Slot</p>
                        <p className="text-sm font-semibold text-foreground">
                            {slotLabel || "—"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5">
                    <Receipt className="h-4 w-4 text-primary" />
                    <div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="text-sm font-semibold text-foreground">
                            {amount != null ? `৳${amount}` : "—"}
                        </p>
                    </div>
                </div>
            </div>

            <Link
                href={`/bookings/${booking.id}/ticket`}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
                View ticket <ArrowRight className="h-3.5 w-3.5" />
            </Link>
        </div>
    );
}

function StatCard({ icon: Icon, value, label }) {
    return (
        <div className="glass-card flex flex-col items-center justify-center rounded-2xl p-4 text-center">
            <Icon className="mb-1.5 h-5 w-5 text-primary" />
            <p className="text-lg font-extrabold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
        </div>
    );
}
