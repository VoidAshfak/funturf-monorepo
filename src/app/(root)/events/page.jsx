import { CalendarDays, Sparkles } from "lucide-react";
import { getAllEvents } from "@/utils/getData";
import EventsExplorer from "@/components/EventsExplorer";
import CreateNewEvent from "./_components/CreateNewEvent";

export default async function AllEvents() {
    const { data: events = [] } = await getAllEvents();

    const openCount = events.filter((e) => {
        const min = e.min_players ?? 0;
        const cur = e.current_players ?? 0;
        return !(min > 0 && cur >= min);
    }).length;

    const sportCount = new Set(events.map((e) => e.sport_type).filter(Boolean)).size;

    return (
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 md:px-8 md:pt-24">
            {/* designed hero header */}
            <section className="relative isolate overflow-hidden rounded-[2rem] border border-border bg-gradient-to-b from-[#eaf2ee] to-[#e6f1ec] px-6 py-14 dark:from-[#0a1412] dark:to-[#0a0a0a] md:px-12 md:py-16">
                {/* ambient glows */}
                <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-teal/20 blur-[120px]" />
                <div className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-primary/15 blur-[120px]" />
                {/* dotted texture */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.18] dark:opacity-[0.12]"
                    style={{
                        backgroundImage:
                            "radial-gradient(rgba(29,185,84,0.5) 1px, transparent 1px)",
                        backgroundSize: "22px 22px",
                        maskImage:
                            "radial-gradient(ellipse at center, black, transparent 75%)",
                        WebkitMaskImage:
                            "radial-gradient(ellipse at center, black, transparent 75%)",
                    }}
                />

                <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <span className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            Open matches near you
                        </span>
                        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-foreground md:text-6xl">
                            Find Your{" "}
                            <span className="bg-gradient-to-r from-brand to-teal bg-clip-text text-transparent dark:from-brand-light">
                                Game
                            </span>
                        </h1>
                        <p className="mt-3 max-w-md text-base text-muted-foreground">
                            Jump into open matches, find a squad, and play this week.
                        </p>

                        {/* quick stats */}
                        <div className="mt-6 flex items-center gap-6">
                            <Stat value={events.length} label="Matches" />
                            <span className="h-8 w-px bg-border" />
                            <Stat value={openCount} label="Open" />
                            <span className="h-8 w-px bg-border" />
                            <Stat value={sportCount} label="Sports" />
                        </div>
                    </div>

                    <div className="shrink-0">
                        <CreateNewEvent />
                    </div>
                </div>
            </section>

            {/* filter + grid */}
            <div className="relative mt-8">
                {events.length === 0 ? (
                    <div className="glass-neutral flex flex-col items-center gap-3 rounded-3xl border border-border p-12 text-center">
                        <CalendarDays className="h-10 w-10 text-muted-foreground" />
                        <h3 className="text-xl font-bold text-foreground">No matches yet</h3>
                        <p className="text-muted-foreground">
                            Be the first — create a match and rally your squad.
                        </p>
                    </div>
                ) : (
                    <EventsExplorer events={events} />
                )}
            </div>
        </div>
    );
}

function Stat({ value, label }) {
    return (
        <div>
            <p className="text-2xl font-extrabold text-foreground md:text-3xl">{value}</p>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {label}
            </p>
        </div>
    );
}
