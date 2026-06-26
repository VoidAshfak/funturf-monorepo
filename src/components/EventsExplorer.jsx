"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import {
    Search,
    SlidersHorizontal,
    X,
    Users,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { gsap } from "@/lib/animations";
import EventCard from "./EventCard";
import EmptyState from "./EmptyState";

const TIMEFRAMES = [
    { id: "all", label: "All dates" },
    { id: "today", label: "Today" },
    { id: "week", label: "This week" },
    { id: "month", label: "This month" },
];

function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function matchesTimeframe(event, timeframe) {
    if (timeframe === "all") return true;
    if (!event.event_date) return false;
    const now = new Date();
    const today = startOfDay(now);
    const day = startOfDay(new Date(event.event_date));

    if (timeframe === "today") return day.getTime() === today.getTime();
    if (timeframe === "week") {
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        return day >= today && day < weekEnd;
    }
    if (timeframe === "month") {
        const d = new Date(event.event_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    return true;
}

function isOpen(event) {
    const min = event.min_players ?? 0;
    const cur = event.current_players ?? 0;
    return !(min > 0 && cur >= min);
}

const PAGE_SIZE = 9;

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

export default function EventsExplorer({ events = [] }) {
    const [query, setQuery] = useState("");
    const [sport, setSport] = useState("all");
    const [timeframe, setTimeframe] = useState("all");
    const [openOnly, setOpenOnly] = useState(false);
    const [page, setPage] = useState(1);

    const scope = useRef(null);

    // Sports actually present in the data, with live counts.
    const sportOptions = useMemo(() => {
        const counts = new Map();
        for (const e of events) {
            const s = e.sport_type;
            if (!s) continue;
            counts.set(s, (counts.get(s) || 0) + 1);
        }
        return [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name, count }));
    }, [events]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return events.filter((e) => {
            if (sport !== "all" && e.sport_type !== sport) return false;
            if (openOnly && !isOpen(e)) return false;
            if (!matchesTimeframe(e, timeframe)) return false;
            if (q) {
                const haystack = [
                    e.title,
                    e.sport_type,
                    e.grounds?.turfs?.name,
                    e.grounds?.turfs?.address_line_1,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }, [events, query, sport, timeframe, openOnly]);

    const hasActiveFilters =
        query || sport !== "all" || timeframe !== "all" || openOnly;

    const clearAll = () => {
        setQuery("");
        setSport("all");
        setTimeframe("all");
        setOpenOnly(false);
    };

    // Pagination derived from the filtered list.
    const filterKey = `${query}|${sport}|${timeframe}|${openOnly}`;
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

    // Reset to first page whenever the filters change.
    useEffect(() => {
        setPage(1);
    }, [filterKey]);

    const safePage = Math.min(page, pageCount);
    const paged = filtered.slice(
        (safePage - 1) * PAGE_SIZE,
        safePage * PAGE_SIZE
    );

    const goTo = (p) => {
        const next = Math.min(Math.max(p, 1), pageCount);
        if (next === safePage) return;
        setPage(next);
        scope.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    useGSAP(
        () => {
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            if (reduce) {
                gsap.set(".event-card-item", { opacity: 1, y: 0, scale: 1 });
                return;
            }
            gsap.fromTo(
                ".event-card-item",
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
                {/* search + meta row */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="group flex flex-1 items-center gap-3 rounded-full border border-border bg-card/60 px-4 py-2.5 backdrop-blur-md transition-all focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(29,185,84,0.12)]">
                        <Search className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-focus-within:text-primary" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search matches, turfs, areas…"
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

                    {/* timeframe segmented control */}
                    <div className="flex items-center gap-1 rounded-full border border-border bg-card/60 p-1 backdrop-blur-md">
                        {TIMEFRAMES.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setTimeframe(t.id)}
                                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 ${
                                    timeframe === t.id
                                        ? "bg-primary text-primary-foreground shadow-[0_0_18px_rgba(29,185,84,0.4)]"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* open-only toggle */}
                    <button
                        onClick={() => setOpenOnly((v) => !v)}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${
                            openOnly
                                ? "border-primary bg-primary text-primary-foreground shadow-[0_0_18px_rgba(29,185,84,0.4)]"
                                : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Users className="h-4 w-4" />
                        Open spots
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
                        count={events.length}
                    />
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

            {/* result meta */}
            <div className="mt-6 mb-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    <span className="font-bold text-foreground">{filtered.length}</span>{" "}
                    {filtered.length === 1 ? "match" : "matches"} found
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
                    Icon={CalendarDays}
                    title="No matches found"
                    description="Try a different sport, date, or clear your filters."
                />
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {paged.map((event) => (
                            <Link
                                key={event.id}
                                href={`/events/${event.id}`}
                                className="event-card-item will-change-transform"
                            >
                                <EventCard event={event} />
                            </Link>
                        ))}
                    </div>

                    {pageCount > 1 && (
                        <Pagination
                            page={safePage}
                            pageCount={pageCount}
                            onGo={goTo}
                        />
                    )}
                </>
            )}
        </div>
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
                    <span
                        key={`gap-${i}`}
                        className="px-1 text-sm text-muted-foreground"
                    >
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

function Chip({ active, onClick, label, count, icon }) {
    return (
        <button
            onClick={onClick}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold capitalize transition-all duration-300 ${
                active
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_0_18px_rgba(29,185,84,0.4)]"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
        >
            {icon && (
                <Image src={icon} alt={label} width={16} height={16} className="h-4 w-4 object-contain" />
            )}
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
