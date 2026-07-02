import { Sparkles } from "lucide-react";
import { getAllEvents } from "@/utils/getData";
import EventsFeed from "@/components/EventsFeed";
import CreateNewEvent from "./_components/CreateNewEvent";

export default async function AllEvents() {
    // Fetch page 1 just for the global stats (the backend only returns `stats`
    // on page 1). The feed list itself is loaded client-side by <EventsFeed>.
    const { data } = await getAllEvents({ page: 1, limit: 1 });
    const stats = data?.stats ?? { total: 0, open: 0, sports: [] };

    const matchCount = stats.total ?? 0;
    const openCount = stats.open ?? 0;
    const sportCount = stats.sports?.length ?? 0;

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
                            <Stat value={matchCount} label="Matches" />
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

            {/* sticky filter rail + infinite-scroll feed */}
            <div className="relative mt-8">
                <EventsFeed initialStats={stats} />
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
