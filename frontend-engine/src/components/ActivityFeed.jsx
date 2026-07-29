"use client";

import { useRef } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { CalendarPlus, UserPlus } from "lucide-react";
import { useGetCityStatsQuery } from "@/store/api/apiSlice";
import { cn } from "@/lib/utils";

/**
 * Live feed of what's happening across the city right now.
 *
 * Seeded with `initial` from the server so the list is populated in the HTML on
 * first paint, then polled so it keeps moving while the tab is open. RTK Query
 * pauses polling on an unfocused window by default, so a background tab doesn't
 * sit there hitting the API.
 *
 * The rows only ever describe things that are already public (a public match
 * being posted, someone joining one) and carry first names only.
 */

const KINDS = {
    match_created: { icon: CalendarPlus, tint: "text-primary", verb: "New match" },
    player_joined: { icon: UserPlus, tint: "text-teal", verb: "joined" },
};

function timeAgo(at) {
    try {
        return formatDistanceToNowStrict(new Date(at), { addSuffix: false });
    } catch {
        return "";
    }
}

function Row({ row }) {
    const meta = KINDS[row.kind] ?? KINDS.match_created;
    const Icon = meta.icon;

    return (
        <li>
            <Link
                href={row.href || "/events"}
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors duration-200 hover:bg-primary/5 motion-reduce:transition-none"
            >
                <span
                    className={cn(
                        "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10",
                        meta.tint
                    )}
                >
                    <Icon className="h-4 w-4" />
                </span>

                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">
                        {row.kind === "player_joined" ? (
                            <>
                                <strong className="font-semibold">{row.actor}</strong> joined{" "}
                                {row.text}
                            </>
                        ) : (
                            <>
                                <strong className="font-semibold">New match</strong> · {row.text}
                            </>
                        )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {row.place ? `${row.place} · ` : ""}
                        {timeAgo(row.at)} ago
                        {row.spots_left > 0 ? ` · ${row.spots_left} spots left` : ""}
                    </span>
                </span>
            </Link>
        </li>
    );
}

export default function ActivityFeed({ initial = [] }) {
    // Keep the server-rendered rows as the fallback for the first client render
    // and for any poll that fails — the feed should never blank out mid-scroll.
    const seed = useRef(initial);

    const { data } = useGetCityStatsQuery(undefined, {
        pollingInterval: 60_000,
        skipPollingIfUnfocused: true,
    });

    const rows = data?.activity?.length ? data.activity : seed.current;

    if (!rows?.length) {
        return (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nothing yet today — be the first to post a match.
            </p>
        );
    }

    return (
        <ul className="divide-y divide-border">
            {rows.slice(0, 6).map((row) => (
                <Row key={row.id} row={row} />
            ))}
        </ul>
    );
}
