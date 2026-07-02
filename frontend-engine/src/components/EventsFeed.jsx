"use client";

import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Link from "next/link";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import {
    CalendarDays,
    Loader2,
    Search,
    SlidersHorizontal,
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
    const { query, sport, timeframe, openOnly, page } = useSelector(selectEventFilters);

    // Debounced search: type into local state, push to the filter (which refetches) after a pause.
    const [searchInput, setSearchInput] = useState(query);
    useEffect(() => {
        const t = setTimeout(() => {
            if (searchInput !== query) dispatch(setEventFilter({ key: "query", value: searchInput }));
        }, 350);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput]);

    const { data, isFetching, isLoading } = useGetEventsQuery({
        page,
        limit: PAGE_SIZE,
        sport,
        timeframe,
        q: query,
        openOnly: openOnly ? "true" : undefined,
    });

    const events = data?.events ?? [];
    const hasMore = data?.pagination?.hasMore ?? false;
    const total = data?.pagination?.total ?? 0;
    // stats arrive with page 1; fall back to the server-rendered snapshot for the sport chips.
    const stats = data?.stats ?? initialStats ?? { sports: [] };
    const sportOptions = stats.sports ?? [];

    const hasActiveFilters = query || sport !== "all" || timeframe !== "all" || openOnly;
    const activeCount =
        [Boolean(query), sport !== "all", timeframe !== "all", openOnly].filter(Boolean).length;

    const setSport = (v) => dispatch(setEventFilter({ key: "sport", value: v }));
    const setTimeframe = (v) => dispatch(setEventFilter({ key: "timeframe", value: v }));
    const toggleOpenOnly = () =>
        dispatch(setEventFilter({ key: "openOnly", value: !openOnly }));
    const clearAll = () => {
        setSearchInput("");
        dispatch(resetEventFilters());
    };

    // Shared props for the filter control set (rendered in 3 places: desktop top bar,
    // desktop floating rail, mobile/tablet drawer).
    const filterProps = {
        searchInput,
        setSearchInput,
        sport,
        setSport,
        timeframe,
        setTimeframe,
        openOnly,
        toggleOpenOnly,
        sportOptions,
        hasActiveFilters,
        onClear: clearAll,
    };

    // ---- Desktop: dock filters on top, then float them to a sticky left rail on scroll ----
    const [floating, setFloating] = useState(false);
    const floatSentinelRef = useRef(null);
    useEffect(() => {
        const node = floatSentinelRef.current;
        if (!node) return;
        const io = new IntersectionObserver(
            ([entry]) => setFloating(!entry.isIntersecting),
            // fire once the sentinel passes under the sticky navbar (~top-24 = 96px)
            { rootMargin: "-96px 0px 0px 0px", threshold: 0 }
        );
        io.observe(node);
        return () => io.disconnect();
    }, []);

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
            {/* trips the top->left float once it scrolls under the navbar */}
            <div ref={floatSentinelRef} className="h-px w-full" />

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
                            <EventFilters orientation="vertical" {...filterProps} />
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            {/* desktop: docked-on-top bar, collapses as it floats left */}
            <div
                className={cn(
                    "hidden overflow-hidden transition-all duration-500 ease-out lg:block",
                    floating
                        ? "max-h-0 -translate-y-2 opacity-0"
                        : "mb-6 max-h-[400px] translate-y-0 opacity-100"
                )}
            >
                <div className="glass-neutral rounded-3xl border border-border p-4 md:p-5">
                    <EventFilters orientation="horizontal" {...filterProps} />
                </div>
            </div>

            {/* row: floating left rail (desktop) + feed */}
            <div className="lg:flex lg:items-start">
                {/* left rail — width animates 0 -> 18rem as it floats in; sticky while scrolling */}
                <aside
                    className={cn(
                        "hidden overflow-hidden transition-all duration-500 ease-out lg:sticky lg:top-24 lg:block",
                        floating
                            ? "translate-x-0 opacity-100 lg:w-72"
                            : "pointer-events-none -translate-x-3 opacity-0 lg:w-0"
                    )}
                >
                    {/* fixed inner width so content doesn't squish during the width transition */}
                    <div className="w-72 pr-6">
                        <div className="glass-neutral rounded-3xl border border-border p-4 md:p-5">
                            <EventFilters orientation="vertical" {...filterProps} />
                        </div>
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
// Filter control set — one component, two layouts. State is fully controlled
// by the parent so every instance (top bar / floating rail / drawer) stays in sync.
// ---------------------------------------------------------------------------
function EventFilters({
    orientation = "vertical",
    searchInput,
    setSearchInput,
    sport,
    setSport,
    timeframe,
    setTimeframe,
    openOnly,
    toggleOpenOnly,
    sportOptions,
    hasActiveFilters,
    onClear,
}) {
    const horizontal = orientation === "horizontal";

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

    const timeframeControl = horizontal ? (
        <div className="flex items-center gap-1 rounded-full border border-border bg-card/60 p-1 backdrop-blur-md">
            {TIMEFRAMES.map((t) => (
                <button
                    key={t.id}
                    onClick={() => setTimeframe(t.id)}
                    className={cn(
                        "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-300",
                        timeframe === t.id
                            ? "bg-primary text-primary-foreground shadow-[0_0_18px_rgba(29,185,84,0.4)]"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    {t.label}
                </button>
            ))}
        </div>
    ) : (
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
                "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-300",
                horizontal ? "shrink-0" : "w-full",
                openOnly
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_0_18px_rgba(29,185,84,0.4)]"
                    : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
            )}
        >
            <Users className="h-4 w-4" />
            {horizontal ? "Open spots" : "Open spots only"}
        </button>
    );

    const sports = (
        <div>
            {!horizontal && (
                <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Sport
                </p>
            )}
            <div
                className={cn(
                    "flex gap-2",
                    horizontal ? "scrollbar-hide -mx-1 overflow-x-auto px-1 pb-1" : "flex-wrap"
                )}
            >
                {horizontal && (
                    <span className="mr-1 hidden shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground sm:inline-flex">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Sport
                    </span>
                )}
                <Chip active={sport === "all"} onClick={() => setSport("all")} label="All" />
                {sportOptions.map((s) => (
                    <Chip
                        key={s.name}
                        active={sport === s.name}
                        onClick={() => setSport(s.name)}
                        label={s.name}
                        count={s.count}
                        icon={`/assets/icons/${s.name.toLowerCase()}.png`}
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

    if (horizontal) {
        return (
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="flex-1">{search}</div>
                    {timeframeControl}
                    {openToggle}
                    {clear}
                </div>
                {sports}
            </div>
        );
    }

    // vertical
    return (
        <div className="flex flex-col gap-5">
            {search}
            {timeframeControl}
            {openToggle}
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

function Chip({ active, onClick, label, count, icon }) {
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
            {icon && (
                <Image
                    src={icon}
                    alt={label}
                    width={16}
                    height={16}
                    className="h-4 w-4 object-contain"
                />
            )}
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
