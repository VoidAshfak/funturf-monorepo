import EventListWrapper from "@/components/EventListWrapper"
import MapDialog from "@/components/MapDialog"
import PlayerItem from "@/components/PlayerItem"
import RulesAndComments from "@/components/RulesAndComments"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { getIndividualEventByEventId } from "@/utils/getData"
import { getLocationString } from "@/utils/utility-functions"
import { format } from "date-fns"
import {
    ArrowRight,
    CalendarDays,
    Clock,
    MapPin,
    Sparkles,
    Trophy,
    Users,
} from "lucide-react"
import Image from "next/image"
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
        participants = [],
    } = event;

    const sport = event.sport_type || ground?.sport_type;
    const min = min_players ?? 0;
    const cur = current_players ?? 0;
    const isFull = min > 0 && cur >= min;
    const spotsLeft = Math.max(min - cur, 0);
    const pct = min ? Math.min(Math.round((cur / min) * 100), 100) : 0;

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
                                <Image
                                    src={`/assets/icons/${String(sport).toLowerCase()}.png`}
                                    alt={sport}
                                    width={14}
                                    height={14}
                                />
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
                                    ? `${format(new Date(start_time), "h:mm a")} – ${format(new Date(end_time), "h:mm a")}`
                                    : null
                            }
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

                    {/* CTA */}
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Button
                            size="lg"
                            disabled={isFull}
                            className="rounded-full px-8 green-glow"
                        >
                            {isFull ? "Squad full" : "Request to Join"}
                        </Button>
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
                    {/* quick stats */}
                    <div className="mb-6 grid grid-cols-3 gap-4">
                        <StatCard icon={Users} value={`${cur}/${min || "—"}`} label="Joined" />
                        <StatCard icon={Trophy} value={max_players ?? "—"} label="Max players" />
                        <StatCard
                            icon={Clock}
                            value={
                                start_time && end_time
                                    ? `${Math.max(
                                          Math.round(
                                              (new Date(end_time) - new Date(start_time)) /
                                                  3600000
                                          ),
                                          0
                                      )}h`
                                    : "—"
                            }
                            label="Duration"
                        />
                    </div>

                    <div className="glass-card rounded-3xl p-5 md:p-7">
                        <RulesAndComments rules={rules} />
                    </div>
                </div>

                {/* right: squad */}
                <aside className="glass-card h-fit rounded-3xl p-5 md:p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-foreground">Squad</h2>
                        <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
                            {cur}/{min || "—"}
                        </span>
                    </div>

                    {/* progress */}
                    <div className="mb-5">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-brand to-teal transition-all duration-500"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                            {isFull
                                ? "This squad is full."
                                : `${spotsLeft} more player${spotsLeft === 1 ? "" : "s"} needed.`}
                        </p>
                    </div>

                    <div className="space-y-1">
                        {participants.length > 0 ? (
                            participants.map((participant, i) => (
                                <PlayerItem
                                    key={participant?.id ?? participant?.user_id ?? participant ?? i}
                                    participant={participant}
                                />
                            ))
                        ) : cur > 0 ? (
                            <div className="rounded-xl bg-muted/50 p-4 text-center">
                                <div className="mb-2 flex justify-center -space-x-3">
                                    {Array.from({ length: Math.min(cur, 5) }).map((_, i) => (
                                        <span
                                            key={i}
                                            className="grid h-9 w-9 place-items-center rounded-full border-2 border-card bg-gradient-to-br from-brand to-teal text-primary-foreground"
                                        >
                                            <Users className="h-4 w-4" />
                                        </span>
                                    ))}
                                </div>
                                <p className="text-sm font-semibold text-foreground">
                                    {cur} player{cur === 1 ? "" : "s"} joined
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Roster hidden until you join.
                                </p>
                            </div>
                        ) : (
                            <p className="rounded-xl bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                                No players yet. Be the first to join!
                            </p>
                        )}
                    </div>
                </aside>
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

function MetaPill({ icon: Icon, label, sub, action }) {
    return (
        <div className="glass-chip flex items-center gap-3 rounded-2xl px-4 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{label}</p>
                {sub && <p className="truncate text-sm text-muted-foreground">{sub}</p>}
            </div>
            {action}
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
