import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ArrowUpRight, Clock, MapPin, Users } from "lucide-react";
import SportIcon from "./icons/SportIcon";

// Initials fallback for an avatar (e.g. "Rafi Ahmed" -> "RA").
function initials(name = "") {
    return (
        name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((n) => n[0])
            .join("")
            .toUpperCase() || "?"
    );
}

// Wide, information-rich card built for the single-column /events feed. Compared
// to the compact grid card it adds: description, organizer, ground name, full
// address, min–max player range and real participant avatars.
export default function EventFeedCard({ event }) {
    const {
        title,
        description,
        sport_type,
        grounds,
        users: organizer,
        event_date,
        start_time,
        end_time,
        min_players,
        max_players,
        current_players,
        event_participants = [],
        turfmates_involved = [],
    } = event;

    const hasTurfmates = turfmates_involved.length > 0;

    const date = event_date ? new Date(event_date) : null;
    const isFull = current_players >= min_players && min_players > 0;
    const spotsLeft = Math.max((min_players ?? 0) - (current_players ?? 0), 0);
    const pct = min_players
        ? Math.min(Math.round((current_players / min_players) * 100), 100)
        : 0;

    const organizerName = organizer
        ? [organizer.first_name, organizer.last_name].filter(Boolean).join(" ")
        : null;

    const turf = grounds?.turfs;
    const location = [turf?.name, grounds?.name, turf?.address_line_1]
        .filter(Boolean)
        .join(" · ");

    return (
        <Card
            className={cn(
                "group flex flex-col gap-0 overflow-hidden rounded-3xl p-0 transition-all duration-300 will-change-transform hover:-translate-y-1 hover:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] md:flex-row",
                // Highlight matches a turfmate is involved in.
                hasTurfmates && "ring-1 ring-primary/40"
            )}
        >
            {/* left poster panel — sport + big ticket date (frosted green) */}
            <div className="relative flex shrink-0 flex-row items-center gap-4 overflow-hidden border-b border-primary/15 bg-primary/10 p-5 backdrop-blur-xl dark:bg-[rgba(29,185,84,0.1)] md:w-52 md:flex-col md:items-start md:justify-between md:border-b-0 md:border-r">
                {/* ambient glow */}
                <div className="pointer-events-none absolute -left-10 -top-12 h-40 w-40 rounded-full bg-primary/25 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-14 right-0 h-40 w-40 rounded-full bg-teal/20 blur-3xl" />

                <span className="glass-chip relative inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize text-foreground">
                    {sport_type && (
                        <SportIcon sport={sport_type} className="h-3.5 w-3.5 text-primary" />
                    )}
                    {sport_type}
                </span>

                {date && (
                    <div className="relative leading-none md:mt-auto">
                        <p className="text-4xl font-extrabold tracking-tight text-primary">
                            {format(date, "dd")}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {format(date, "MMM")} · {format(date, "EEE")}
                        </p>
                    </div>
                )}
            </div>

            {/* right content */}
            <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="line-clamp-1 bg-gradient-to-r from-brand to-teal bg-clip-text text-xl font-extrabold text-transparent dark:from-brand-light md:text-2xl">
                            {title}
                        </h3>
                        {organizerName && (
                            <div className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                                <Avatar className="h-5 w-5">
                                    <AvatarImage
                                        src={organizer.profile_picture_url}
                                        alt={organizerName}
                                    />
                                    <AvatarFallback className="text-[10px]">
                                        {initials(organizerName)}
                                    </AvatarFallback>
                                </Avatar>
                                Organized by{" "}
                                <span className="font-semibold text-foreground">{organizerName}</span>
                            </div>
                        )}
                    </div>
                    <span
                        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${
                            isFull
                                ? "bg-destructive/15 text-destructive"
                                : "bg-primary/15 text-primary"
                        }`}
                    >
                        <Users className="h-3.5 w-3.5" />
                        {isFull ? "Full" : `${spotsLeft} left`}
                    </span>
                </div>

                {description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>
                )}

                {/* turfmate highlight: shows when one of your turfmates is involved */}
                {hasTurfmates && (
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1">
                        <div className="flex -space-x-2 *:ring-2 *:ring-background">
                            {turfmates_involved.slice(0, 3).map((t) => (
                                <Avatar key={t.id} className="h-5 w-5">
                                    <AvatarImage src={t.profile_picture_url} alt={t.first_name} />
                                    <AvatarFallback className="text-[9px]">
                                        {initials(t.first_name)}
                                    </AvatarFallback>
                                </Avatar>
                            ))}
                        </div>
                        <span className="text-xs font-semibold text-primary">
                            {turfmates_involved.length} turfmate
                            {turfmates_involved.length > 1 ? "s" : ""} involved
                        </span>
                    </div>
                )}

                {/* meta row */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                    {location && (
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                            <MapPin className="h-4 w-4 shrink-0 text-primary" />
                            <span className="line-clamp-1">{location}</span>
                        </span>
                    )}
                    {start_time && end_time && (
                        <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-foreground">
                            <Clock className="h-4 w-4 text-primary" />
                            {format(new Date(start_time), "h:mm a")} –{" "}
                            {format(new Date(end_time), "h:mm a")}
                        </span>
                    )}
                    <span className="inline-flex shrink-0 items-center gap-1.5">
                        <Users className="h-4 w-4 text-primary" />
                        {min_players ?? 0}
                        {max_players ? `–${max_players}` : ""} players
                    </span>
                </div>

                {/* squad progress */}
                <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
                        <span>Squad filling up</span>
                        <span className="font-bold text-foreground">
                            {current_players ?? 0}/{min_players ?? 0}
                        </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-brand to-teal transition-all duration-500"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>

                {/* footer: real participant avatars + CTA */}
                <div className="mt-1 flex items-center justify-between border-t border-border pt-4">
                    {event_participants.length > 0 ? (
                        <div className="flex items-center gap-3">
                            <div className="flex -space-x-2 *:ring-2 *:ring-background">
                                {event_participants.slice(0, 4).map((p) => {
                                    const name = p.users?.first_name ?? "Player";
                                    return (
                                        <Avatar key={p.user_id} className="h-8 w-8">
                                            <AvatarImage
                                                src={p.users?.profile_picture_url}
                                                alt={name}
                                            />
                                            <AvatarFallback className="text-[11px]">
                                                {initials(name)}
                                            </AvatarFallback>
                                        </Avatar>
                                    );
                                })}
                            </div>
                            <span className="text-sm font-medium text-muted-foreground">
                                {event_participants.length} joined
                            </span>
                        </div>
                    ) : (
                        <span className="text-sm font-medium text-muted-foreground">
                            Be the first to join
                        </span>
                    )}
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-foreground transition-all duration-300 group-hover:rotate-45 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                        <ArrowUpRight className="h-5 w-5" />
                    </span>
                </div>
            </div>
        </Card>
    );
}
