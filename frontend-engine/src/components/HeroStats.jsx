"use client";

import CountUp from "@/components/CountUp";
import { useGetCityStatsQuery } from "@/store/api/apiSlice";
import { cn } from "@/lib/utils";

/**
 * The hero's proof row — real numbers, not marketing ones.
 *
 * These used to be hardcoded ("120+ turfs, 5k+ players, 800+ matches"), which
 * became indefensible the moment the page started showing genuine counts further
 * down: two different sets of figures for the same city, one of them invented.
 * Same endpoint as the ticker now, so the whole page agrees with itself.
 *
 * Client-side rather than server-fetched on purpose. The hero is the first paint
 * on the site, and awaiting a backend call in the page would block ALL of it —
 * headline included — behind the slowest thing on the screen. RTK Query dedupes
 * against the ticker's own subscription, so this costs no extra request.
 *
 * Labels say exactly what each number measures. "Players" over a 30-day signup
 * count would be a quieter version of the same overstatement this replaced.
 */

const TILES = [
    { key: "turfs_live", label: "Turfs live", ink: "from-brand to-teal" },
    { key: "matches_this_week", label: "Matches this week", ink: "from-teal to-brand" },
    {
        key: "players_joined_30d",
        label: "Players this month",
        ink: "from-brand-light to-teal",
    },
];

export default function HeroStats({ className = "" }) {
    const { data, isLoading } = useGetCityStatsQuery();
    const counters = data?.counters ?? {};

    return (
        <dl
            className={cn(
                "flex justify-center gap-8 lg:justify-start",
                className
            )}
        >
            {TILES.map((tile) => {
                const value = counters[tile.key];
                return (
                    <div key={tile.key} className="text-center lg:text-left">
                        <dd
                            className={cn(
                                "bg-gradient-to-br bg-clip-text text-2xl font-extrabold tabular-nums tracking-[-0.02em] text-transparent sm:text-3xl",
                                tile.ink
                            )}
                        >
                            {/* An em dash while loading, never a placeholder digit:
                                a "0" that later becomes 42 is a number the visitor
                                read and believed for a moment. */}
                            {isLoading || value == null ? (
                                <span className="text-muted-foreground">—</span>
                            ) : (
                                <CountUp value={value} />
                            )}
                        </dd>
                        <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {tile.label}
                        </dt>
                    </div>
                );
            })}
        </dl>
    );
}
