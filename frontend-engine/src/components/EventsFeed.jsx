"use client";

import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSession } from "next-auth/react";
import Link from "next/link";
import SportIcon from "./icons/SportIcon";
import { useGSAP } from "@gsap/react";
import {
    CalendarDays,
    Loader2,
    Search,
    SlidersHorizontal,
    UserCheck,
    Users,
    X,
} from "lucide-react";
import {
    resetEventFilters,
    selectEventFilters,
    setEventFilter,
    setEventPage,
} from "@/store/slices/filtersSlice";
import { useGetEventsQuery } from "@/store/api/apiSlice";
import { gsap } from "@/lib/animations";
import { cn } from "@/lib/utils";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import EventFeedCard from "./EventFeedCard";
import EmptyState from "./EmptyState";

const TIMEFRAMES = [
    { id: "all", label: "All dates" },
    { id: "today", label: "Today" },
    { id: "week", label: "This week" },
    { id: "month", label: "This month" },
];

const PAGE_SIZE = 8;

export default function EventsFeed({ initialStats }) {
    const dispatch = useDispatch();
    // "Only my matches" only makes sense for a signed-in user (the backend no-ops
    // it for anonymous callers), so the toggle is gated on an active session.
    const { status: authStatus } = useSession();
    const isAuthed = authStatus === "authenticated";
    const { query, sport, timeframe, openOnly, joinedOnly, page } = useSelector(selectEventFilters);

    // Debounced search: type into local state, push to the filter (which refetches) after a pause.
    const [searchInput, setSearchInput] = useState(query);
    useEffect(() => {
        const t = setTimeout(() => {
            if (searchInput !== query) dispatch(setEventFilter({ key: "query", value: searchInput }));
        }, 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput]);

    // Only send joinedOnly when authenticated — it's a no-op server-side otherwise.
    const effectiveJoinedOnly = isAuthed && joinedOnly;
    const { data, isFetching, isLoading } = useGetEventsQuery({
        page,
        limit: PAGE_SIZE,
        sport,
        timeframe,
        q: query,
        openOnly: openOnly ? "true" : undefined,
        joinedOnly: effectiveJoinedOnly ? "true" : undefined,
    });

    const events = data?.events ?? [];
    const hasMore = data?.pagination?.hasMore ?? false;
    const total = data?.pagination?.total ?? 0;
    // stats arrive with page 1; fall back to the server-rendered snapshot for the sport chips.
    const stats = data?.stats ?? initialStats ?? { sports: [] };
    const sportOptions = stats.sports ?? [];

    const hasActiveFilters =
        query || sport !== "all" || timeframe !== "all" || openOnly || effectiveJoinedOnly;
    const activeCount =
        [Boolean(query), sport !== "all", timeframe !== "all", openOnly, effectiveJoinedOnly].filter(
            Boolean
        ).length;

    const setSport = (v) => dispatch(setEventFilter({ key: "sport", value: v }));
    const setTimeframe = (v) => dispatch(setEventFilter({ key: "timeframe", value: v }));
    const toggleOpenOnly = () =>
        dispatch(setEventFilter({ key: "openOnly", value: !openOnly }));
    const toggleJoinedOnly = () =>
        dispatch(setEventFilter({ key: "joinedOnly", value: !joinedOnly }));
    const clearAll = () => {
        setSearchInput("");
        dispatch(resetEventFilters());
    };

    // Shared props for the filter control set (rendered in 2 places: the desktop
    // left rail and the mobile/tablet drawer).
    const filterProps = {
        searchInput,
        setSearchInput,
        sport,
        setSport,
        timeframe,
        setTimeframe,
        openOnly,
        toggleOpenOnly,
        // "Only my matches" toggle is only offered to signed-in users.
        showJoinedOnly: isAuthed,
        joinedOnly,
        toggleJoinedOnly,
        sportOptions,
        hasActiveFilters,
        onClear: clearAll,
    };

    // ---- Mobile/tablet drawer ----
    const [sheetOpen, setSheetOpen] = useState(false);

    // ---- Infinite scroll: bump the page when the sentinel enters the viewport ----
    const sentinelRef = useRef(null);
    useEffect(() => {
        const node = sentinelRef.current;
        if (!node || !hasMore) return;
        const io = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isFetching) {
                    dispatch(setEventPage(page + 1));
                }
            },
            { rootMargin: "400px" } // prefetch before the user hits the bottom
        );
        io.observe(node);
        return () => io.disconnect();
    }, [hasMore, isFetching, page, dispatch]);

    // ---- Smooth reveal: animate only the freshly-appended cards ----
    const scope = useRef(null);
    const prevCountRef = useRef(0);
    useGSAP(
        () => {
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            const cards = gsap.utils.toArray(".feed-card");
            // page 1 (fresh/filtered) re-reveals everything; later pages only the new tail.
            const startIdx = page === 1 ? 0 : prevCountRef.current;
            const fresh = cards.slice(startIdx);
            prevCountRef.current = cards.length;
            if (!fresh.length) return;
            if (reduce) {
                gsap.set(fresh, { opacity: 1, y: 0 });
                return;
            }
            gsap.fromTo(
                fresh,
                { opacity: 0, y: 24 },
                { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.07 }
            );
        },
        { dependencies: [events.length, page], scope }
    );

    return (
        <div ref={scope}>
            {/* mobile + tablet: filters live behind a button (slide-over drawer).
                sticky so the button stays reachable the whole way down the feed. */}
            <div className="sticky top-20 z-30 mb-4 lg:hidden">
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetTrigger asChild>
                        <button className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-5 py-2.5 text-sm font-semibold text-foreground shadow-lg backdrop-blur-md transition-colors hover:border-primary/40">
                            <SlidersHorizontal className="h-4 w-4 text-primary" />
                            Filters
                            {activeCount > 0 && (
                                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                                    {activeCount}
                                </span>
                            )}
                        </button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[320px] overflow-y-auto p-0 sm:w-[360px]">
                        <SheetHeader>
                            <SheetTitle className="flex items-center gap-2">
                                <SlidersHorizontal className="h-4 w-4 text-primary" />
                                Filters
                            </SheetTitle>
                        </SheetHeader>
                        <div className="p-4">
                            <EventFilters {...filterProps} />
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            {/* row: permanent left filter rail (desktop) + feed */}
            <div className="lg:flex lg:items-start lg:gap-6">
                {/* Left rail. Sticks under the navbar and fills the rest of the viewport,
                    so the filter menu owns the full column height; if the controls
                    outgrow the screen the rail scrolls on its own, not the page. */}
                <aside className="hidden lg:sticky lg:top-24 lg:block lg:w-72 lg:shrink-0">
                    <div className="glass-neutral flex h-[calc(100vh-8rem)] flex-col overflow-y-auto rounded-3xl border border-border p-4 md:p-5">
                        <EventFilters {...filterProps} />
                    </div>
                </aside>

                {/* feed */}
                <div className="min-w-0 flex-1">
                    <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            <span className="font-bold text-foreground">{total}</span>{" "}
                            {total === 1 ? "match" : "matches"} found
                        </p>
                    </div>

                    {isLoading ? (
                        <FeedSkeleton />
                    ) : events.length === 0 ? (
                        <EmptyState
                            Icon={CalendarDays}
                            title="No matches found"
                            description="Try a different sport, date, or clear your filters."
                        />
                    ) : (
                        <>
                            <div className="flex flex-col gap-5">
                                {events.map((event) => (
                                    <Link
                                        key={event.id}
                                        href={`/events/${event.id}`}
                                        className="feed-card block will-change-transform"
                                    >
                                        <EventFeedCard event={event} />
                                    </Link>
                                ))}
                            </div>

                            {/* infinite-scroll sentinel + loader */}
                            <div ref={sentinelRef} className="h-10" />
                            {isFetching && page > 1 && (
                                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                    Loading more…
                                </div>
                            )}
                            {!hasMore && (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    You&apos;re all caught up.
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Filter control set — a single vertical column, rendered in the desktop left
// rail and in the mobile drawer. State is fully controlled by the parent so both
// instances stay in sync.
// ---------------------------------------------------------------------------
function EventFilters({
    searchInput,
    setSearchInput,
    sport,
    setSport,
    timeframe,
    setTimeframe,
    openOnly,
    toggleOpenOnly,
    showJoinedOnly,
    joinedOnly,
    toggleJoinedOnly,
    sportOptions,
    hasActiveFilters,
    onClear,
}) {
    const search = (
        <div className="group flex items-center gap-2.5 rounded-full border border-border bg-card/60 px-4 py-2.5 backdrop-blur-md transition-all focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(29,185,84,0.12)]">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search matches, turfs…"
                className="h-6 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {searchInput && (
                <button
                    onClick={() => setSearchInput("")}
                    aria-label="Clear search"
                    className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );

    const timeframeControl = (
        <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                When
            </p>
            <div className="grid grid-cols-2 gap-2">
                {TIMEFRAMES.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTimeframe(t.id)}
                        className={cn(
                            "rounded-full px-3 py-2 text-xs font-semibold transition-all duration-300",
                            timeframe === t.id
                                ? "bg-primary text-primary-foreground shadow-[0_0_18px_rgba(29,185,84,0.4)]"
                                : "border border-border bg-card/60 text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
        </div>
    );

    const openToggle = (
        <button
            onClick={toggleOpenOnly}
            className={cn(
                "inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-300",
                openOnly
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_0_18px_rgba(29,185,84,0.4)]"
                    : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
            )}
        >
            <Users className="h-4 w-4" />
            Open spots only
        </button>
    );

    // Signed-in only: narrow the feed to matches the user organises or plays in.
    const joinedOnlyToggle = showJoinedOnly ? (
        <button
            onClick={toggleJoinedOnly}
            className={cn(
                "inline-flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-300",
                joinedOnly
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_0_18px_rgba(29,185,84,0.4)]"
                    : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
            )}
        >
            <UserCheck className="h-4 w-4" />
            Only matches I&apos;ve joined
        </button>
    ) : null;

    const sports = (
        <div>
            <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Sport
            </p>
            <div className="flex flex-wrap gap-2">
                <Chip active={sport === "all"} onClick={() => setSport("all")} label="All" />
                {sportOptions.map((s) => (
                    <Chip
                        key={s.name}
                        active={sport === s.name}
                        onClick={() => setSport(s.name)}
                        label={s.name}
                        count={s.count}
                        sport={s.name}
                    />
                ))}
            </div>
        </div>
    );

    const clear = hasActiveFilters ? (
        <button
            onClick={onClear}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-brand-dark"
        >
            <X className="h-4 w-4" />
            Clear
        </button>
    ) : null;

    return (
        <div className="flex flex-col gap-5">
            {search}
            {timeframeControl}
            {openToggle}
            {joinedOnlyToggle}
            {sports}
            {clear}
        </div>
    );
}

function FeedSkeleton() {
    return (
        <div className="flex flex-col gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
                <div
                    key={i}
                    className="h-52 animate-pulse rounded-3xl border border-border bg-card/50"
                />
            ))}
        </div>
    );
}

function Chip({ active, onClick, label, count, sport }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold capitalize transition-all duration-300",
                active
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_0_18px_rgba(29,185,84,0.4)]"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
        >
            {sport && <SportIcon sport={sport} className="h-4 w-4" />}
            {label}
            {typeof count === "number" && (
                <span
                    className={cn(
                        "rounded-full px-1.5 text-[11px] font-bold",
                        active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                    )}
                >
                    {count}
                </span>
            )}
        </button>
    );
}
