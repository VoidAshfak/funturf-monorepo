"use client";

import { useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import Link from "next/link";
import SportIcon from "./icons/SportIcon";
import { useGSAP } from "@gsap/react";
import {
    selectVenueFilters,
    setVenueFilter,
    setVenuePage,
    resetVenueFilters,
} from "@/store/slices/filtersSlice";
import {
    Search,
    SlidersHorizontal,
    X,
    Star,
    MapPin,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { gsap } from "@/lib/animations";
import { getLocationString } from "@/utils/utility-functions";
import { VenueCard } from "./VenueCard";
import EmptyState from "./EmptyState";

const SORTS = [
    { id: "recommended", label: "Recommended" },
    { id: "rating", label: "Top rated" },
    { id: "name", label: "A–Z" },
];

const PAGE_SIZE = 9;

function venueSports(venue) {
    // A ground's sport_type is a MULTISELECT — it's an array like
    // ["Football","Cricket"], and sports_available can be nested the same way.
    // Flatten one level, coerce to strings, and dedupe so callers always get a
    // flat list of unique sport names (an array leaking through here would become
    // a comma-joined React key and break both the chips and the sport filter).
    const raw =
        Array.isArray(venue.sports_available) && venue.sports_available.length
            ? venue.sports_available
            : (venue.grounds || []).map((g) => g.sport_type);

    return [...new Set(raw.flat().filter(Boolean).map(String))];
}

function locationText(venue) {
    try {
        return getLocationString(venue.address_line_1 || {});
    } catch {
        return "";
    }
}

// Compact page list with ellipses: 1 … 4 5 [6] 7 8 … 12
function getPageList(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = new Set([1, total, current, current - 1, current + 1]);
    const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
    const out = [];
    let prev = 0;
    for (const p of sorted) {
        if (p - prev > 1) out.push("…");
        out.push(p);
        prev = p;
    }
    return out;
}

export default function VenuesExplorer({ venues = [] }) {
    const dispatch = useDispatch();
    const { query, sport, sort, topRated, page } = useSelector(selectVenueFilters);

    const setQuery = (value) => dispatch(setVenueFilter({ key: "query", value }));
    const setSport = (value) => dispatch(setVenueFilter({ key: "sport", value }));
    const setSort = (value) => dispatch(setVenueFilter({ key: "sort", value }));
    const setTopRated = (updater) =>
        dispatch(
            setVenueFilter({
                key: "topRated",
                value: typeof updater === "function" ? updater(topRated) : updater,
            })
        );

    const scope = useRef(null);

    // Sports present in the data, with live counts.
    const sportOptions = useMemo(() => {
        const counts = new Map();
        for (const v of venues) {
            for (const s of venueSports(v)) {
                counts.set(s, (counts.get(s) || 0) + 1);
            }
        }
        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }));
    }, [venues]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        let list = venues.filter((v) => {
            if (sport !== "all" && !venueSports(v).includes(sport)) return false;
            if (topRated && (v.rating ?? 0) < 4) return false;
            if (q) {
                const haystack = [v.name, locationText(v), ...venueSports(v)]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });

        if (sort === "rating") {
            list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        } else if (sort === "name") {
            list = [...list].sort((a, b) =>
                (a.name || "").localeCompare(b.name || "")
            );
        }
        return list;
    }, [venues, query, sport, topRated, sort]);

    const hasActiveFilters =
        query || sport !== "all" || sort !== "recommended" || topRated;

    const clearAll = () => dispatch(resetVenueFilters());

    // Pagination derived from the filtered list. The slice resets page to 1
    // automatically whenever a filter changes.
    const filterKey = `${query}|${sport}|${sort}|${topRated}`;
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

    const safePage = Math.min(page, pageCount);
    const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const goTo = (p) => {
        const next = Math.min(Math.max(p, 1), pageCount);
        if (next === safePage) return;
        dispatch(setVenuePage(next));
        scope.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    // Re-animate the grid on filter / page change.
    useGSAP(
        () => {
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            if (reduce) {
                gsap.set(".venue-card-item", { opacity: 1, y: 0, scale: 1 });
                return;
            }
            gsap.fromTo(
                ".venue-card-item",
                { opacity: 0, y: 24, scale: 0.97 },
                {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    duration: 0.5,
                    ease: "power3.out",
                    stagger: 0.06,
                }
            );
        },
        { dependencies: [filterKey, safePage], scope }
    );

    // One-time entrance for the filter bar.
    useGSAP(
        () => {
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            if (reduce) return;
            gsap.from(".filter-reveal", {
                opacity: 0,
                y: 16,
                duration: 0.6,
                ease: "power3.out",
                stagger: 0.08,
            });
        },
        { scope }
    );

    return (
        <div ref={scope}>
            {/* filter bar */}
            <div className="glass-neutral filter-reveal relative z-10 rounded-3xl border border-border p-4 md:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="group flex flex-1 items-center gap-3 rounded-full border border-border bg-card/60 px-4 py-2.5 backdrop-blur-md transition-all focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(29,185,84,0.12)]">
                        <Search className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-focus-within:text-primary" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search turfs, areas, sports…"
                            className="h-6 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                        />
                        {query && (
                            <button
                                onClick={() => setQuery("")}
                                aria-label="Clear search"
                                className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* sort segmented control */}
                    <div className="flex items-center gap-1 rounded-full border border-border bg-card/60 p-1 backdrop-blur-md">
                        {SORTS.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => setSort(s.id)}
                                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 ${
                                    sort === s.id
                                        ? "bg-primary text-primary-foreground shadow-[0_0_18px_rgba(29,185,84,0.4)]"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>

                    {/* top-rated toggle */}
                    <button
                        onClick={() => setTopRated((v) => !v)}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${
                            topRated
                                ? "border-primary bg-primary text-primary-foreground shadow-[0_0_18px_rgba(29,185,84,0.4)]"
                                : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Star className="h-4 w-4" />
                        4★ &amp; up
                    </button>
                </div>

                {/* sport chips */}
                <div className="scrollbar-hide -mx-1 mt-4 flex items-center gap-2 overflow-x-auto px-1 pb-1">
                    <span className="mr-1 hidden shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground sm:inline-flex">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Sport
                    </span>
                    <Chip
                        active={sport === "all"}
                        onClick={() => setSport("all")}
                        label="All sports"
                        count={venues.length}
                    />
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

            {/* result meta */}
            <div className="mt-6 mb-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    <span className="font-bold text-foreground">{filtered.length}</span>{" "}
                    {filtered.length === 1 ? "turf" : "turfs"} found
                </p>
                {hasActiveFilters && (
                    <button
                        onClick={clearAll}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-brand-dark"
                    >
                        <X className="h-4 w-4" />
                        Clear filters
                    </button>
                )}
            </div>

            {/* grid */}
            {filtered.length === 0 ? (
                <EmptyState
                    Icon={MapPin}
                    title="No turfs found"
                    description="Try a different sport or clear your filters."
                />
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {paged.map((venue) => (
                            <Link
                                key={venue.id}
                                href={`/venues/${venue.id}`}
                                className="venue-card-item will-change-transform"
                            >
                                <VenueCard venue={venue} />
                            </Link>
                        ))}
                    </div>

                    {pageCount > 1 && (
                        <Pagination page={safePage} pageCount={pageCount} onGo={goTo} />
                    )}
                </>
            )}
        </div>
    );
}

function Chip({ active, onClick, label, count, sport }) {
    return (
        <button
            onClick={onClick}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold capitalize transition-all duration-300 ${
                active
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_0_18px_rgba(29,185,84,0.4)]"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
        >
            {sport && <SportIcon sport={sport} className="h-4 w-4" />}
            {label}
            <span
                className={`rounded-full px-1.5 text-[11px] font-bold ${
                    active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                }`}
            >
                {count}
            </span>
        </button>
    );
}

function Pagination({ page, pageCount, onGo }) {
    return (
        <nav
            aria-label="Pagination"
            className="mt-10 flex items-center justify-center gap-1.5"
        >
            <PageButton
                onClick={() => onGo(page - 1)}
                disabled={page === 1}
                aria-label="Previous page"
            >
                <ChevronLeft className="h-4 w-4" />
            </PageButton>

            {getPageList(page, pageCount).map((p, i) =>
                p === "…" ? (
                    <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground">
                        …
                    </span>
                ) : (
                    <PageButton
                        key={p}
                        active={p === page}
                        onClick={() => onGo(p)}
                        aria-current={p === page ? "page" : undefined}
                    >
                        {p}
                    </PageButton>
                )
            )}

            <PageButton
                onClick={() => onGo(page + 1)}
                disabled={page === pageCount}
                aria-label="Next page"
            >
                <ChevronRight className="h-4 w-4" />
            </PageButton>
        </nav>
    );
}

function PageButton({ active, disabled, children, ...props }) {
    return (
        <button
            disabled={disabled}
            className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full border px-3 text-sm font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_0_18px_rgba(29,185,84,0.4)]"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
            {...props}
        >
            {children}
        </button>
    );
}
