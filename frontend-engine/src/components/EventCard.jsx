import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { Clock, MapPin, ArrowUpRight, Users } from "lucide-react";
import SportIcon from "./icons/SportIcon";
import AvatarGroup from "./AvatarGroup";

export default function EventCard({ event }) {
    const {
        title,
        sport_type,
        grounds,
        event_date,
        start_time,
        end_time,
        min_players,
        current_players,
        event_participants = [],
    } = event;

    const date = new Date(event_date);
    const isFull = current_players >= min_players && min_players > 0;
    const spotsLeft = Math.max((min_players ?? 0) - (current_players ?? 0), 0);
    const pct = min_players
        ? Math.min(Math.round((current_players / min_players) * 100), 100)
        : 0;

    return (
        <Card className="group gap-0 overflow-hidden rounded-3xl p-0 transition-all duration-300 will-change-transform hover:-translate-y-2 hover:z-10 hover:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.4)] cursor-pointer">
            {/* frosted green poster hero */}
            <div className="relative h-36 overflow-hidden border-b border-primary/15 bg-primary/10 backdrop-blur-xl dark:bg-[rgba(29,185,84,0.1)]">
                {/* ambient green glows */}
                <div className="pointer-events-none absolute -left-10 -top-12 h-40 w-40 rounded-full bg-primary/25 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-14 right-0 h-40 w-40 rounded-full bg-teal/20 blur-3xl" />
                {/* dotted texture */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.15]"
                    style={{
                        backgroundImage:
                            "radial-gradient(rgba(29,185,84,0.6) 1px, transparent 1px)",
                        backgroundSize: "16px 16px",
                    }}
                />

                {/* sport label */}
                <span className="glass-chip absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize text-foreground">
                    <SportIcon sport={sport_type} className="h-3.5 w-3.5 text-primary" />
                    {sport_type}
                </span>

                {/* ticket-style date */}
                <div className="absolute right-4 top-3 text-right leading-none">
                    <p className="text-3xl font-extrabold tracking-tight text-primary">
                        {format(date, "dd")}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {format(date, "MMM")} · {format(date, "EEE")}
                    </p>
                </div>

                {/* title */}
                <h3 className="absolute inset-x-4 bottom-3 line-clamp-1 bg-gradient-to-r from-brand to-teal bg-clip-text text-xl font-extrabold text-transparent dark:from-brand-light">
                    {title}
                </h3>
            </div>

            {/* body */}
            <div className="flex flex-col gap-4 p-5">
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0 text-primary" />
                    <span className="line-clamp-1">
                        {grounds?.turfs?.name} · {grounds?.turfs?.address_line_1}
                    </span>
                </p>

                <div className="flex flex-nowrap items-center justify-between gap-2">
                    <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-semibold text-foreground">
                        <Clock className="h-4 w-4 shrink-0 text-primary" />
                        {format(new Date(start_time), "h:mm a")} – {format(new Date(end_time), "h:mm a")}
                    </span>
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

                {/* players progress */}
                <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
                        <span>Squad filling up</span>
                        <span className="font-bold text-foreground">
                            {current_players}/{min_players}
                        </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-brand to-teal transition-all duration-500"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>

                {/* footer */}
                <div className="flex items-center justify-between border-t border-border pt-4">
                    {event_participants.length > 0 ? (
                        <AvatarGroup people={event_participants} />
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
