import Link from "next/link";
import {
    Activity,
    ArrowRight,
    CalendarCheck,
    MapPinned,
    Radio,
    Trophy,
    UsersRound,
} from "lucide-react";
import ActivityFeed from "@/components/ActivityFeed";
import CountUp from "@/components/CountUp";
import Reveal from "@/components/Reveal";
import { getCityStats } from "@/utils/getData";

/**
 * Social proof, from live data rather than marketing numbers.
 *
 * Server component: the counters and the first page of activity are fetched here
 * so they are in the HTML immediately (the numbers then animate up from zero on
 * the client, and the feed polls itself). A visitor with JS disabled still sees
 * real, correct figures.
 */

export default async function LiveTicker() {
    const { data } = await getCityStats();
    const counters = data?.counters ?? {};
    const activity = data?.activity ?? [];

    /*
        Defined here rather than at module scope so the labels sit next to the
        values they describe.

        `sheen` is the tile's own background wash and `ink` the gradient the
        number is painted with. Both stay inside the brand's green→teal range —
        a mid-tone brand gradient is the one gradient DESIGN.md allows on
        theme-adaptive surfaces, because it reads on a light card and a dark one
        alike (a white or black stop would vanish on one of them).
    */
    const tiles = [
        {
            value: counters.matches_this_week ?? 0,
            label: "Matches this week",
            icon: Trophy,
            sheen: "from-primary/20 via-primary/5",
            ink: "from-brand to-teal",
        },
        {
            value: counters.players_joined_30d ?? 0,
            label: "Players joined",
            icon: UsersRound,
            sheen: "from-teal/20 via-teal/5",
            ink: "from-teal to-brand",
        },
        {
            value: counters.bookings_today ?? 0,
            label: "Booked today",
            icon: CalendarCheck,
            sheen: "from-primary/20 via-teal/5",
            ink: "from-brand-light to-teal",
        },
        {
            value: counters.turfs_live ?? 0,
            label: "Turfs live",
            icon: MapPinned,
            sheen: "from-teal/20 via-primary/5",
            ink: "from-teal to-brand-light",
        },
    ];

    return (
        <section className="relative isolate overflow-hidden rounded-[2rem] border border-border bg-gradient-to-b from-[#eef3ef] to-[#e7f1ea] px-5 py-12 dark:from-[#0c1410] dark:to-[#0a0a0a] md:px-10 md:py-16">
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-teal/20 blur-[120px]" />

            <Reveal className="relative mb-10">
                <span className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-[0.02em] text-muted-foreground">
                    <Radio className="h-3.5 w-3.5 text-primary" />
                    The city right now
                </span>

                <h2 className="mt-4 text-3xl font-extrabold leading-[1.15] tracking-[-0.015em] text-foreground md:text-4xl md:leading-[1.1] md:tracking-[-0.025em]">
                    Funturf is{" "}
                    <span className="bg-gradient-to-r from-brand to-teal bg-clip-text text-transparent dark:from-brand-light">
                        busy today
                    </span>
                </h2>
            </Reveal>

            <div className="relative grid gap-5 lg:grid-cols-[1fr_minmax(0,420px)]">
                {/* counters */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2">
                    {tiles.map((tile) => {
                        const Icon = tile.icon;
                        return (
                            <div
                                key={tile.label}
                                className="glass-card group relative isolate overflow-hidden rounded-2xl p-5 text-center transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 lg:text-left"
                            >
                                {/* Corner wash. Sits behind the content (`-z-10`)
                                    and fades to nothing, so it adds depth without
                                    ever competing with the number for contrast. */}
                                <div
                                    className={`pointer-events-none absolute -right-10 -top-10 -z-10 h-32 w-32 rounded-full bg-gradient-to-br to-transparent blur-2xl ${tile.sheen}`}
                                />

                                <span className="mx-auto mb-3 grid h-9 w-9 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary lg:mx-0">
                                    <Icon className="h-4 w-4" />
                                </span>

                                <p
                                    className={`bg-gradient-to-br bg-clip-text text-3xl font-extrabold tabular-nums tracking-[-0.02em] text-transparent sm:text-4xl ${tile.ink}`}
                                >
                                    <CountUp value={tile.value} suffix={tile.suffix ?? ""} />
                                </p>

                                <p className="mt-1 text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
                                    {tile.label}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* live feed */}
                <div className="glass-neutral overflow-hidden rounded-2xl">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Activity className="h-4 w-4 text-primary" />
                            Live activity
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75 motion-reduce:animate-none" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                            </span>
                            live
                        </span>
                    </div>

                    <ActivityFeed initial={activity} />

                    <Link
                        href="/events"
                        className="flex items-center justify-between border-t border-border px-4 py-3 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary/5 motion-reduce:transition-none"
                    >
                        See every open match
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </div>
            </div>
        </section>
    );
}
