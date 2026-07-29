"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import {
    CalendarClock,
    Clock,
    Compass,
    Loader2,
    LocateFixed,
    MapPin,
    Star,
    Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DHAKA_CENTER } from "@/components/CityPulseMap";
import { useGetCityPulseQuery } from "@/store/api/apiSlice";
import { fadeUpOnScroll } from "@/lib/animations";
import { cn } from "@/lib/utils";

// Leaflet touches `window` on import, so the map can only ever render client-side.
const CityPulseMap = dynamic(() => import("@/components/CityPulseMap"), {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

/** Radius options, in km. Matches the backend's clamp window. */
const RADIUS_OPTIONS = [5, 10, 25];

const LAYERS = [
    {
        id: "slots",
        label: "Free slots",
        icon: Clock,
        blurb: "Grounds you can still book today",
    },
    {
        id: "matches",
        label: "Open games",
        icon: Users,
        blurb: "Matches looking for players",
    },
];

/** "18:00" -> "6:00 PM". Falls back to the raw value if it isn't a HH:mm. */
function prettyTime(hhmm) {
    if (!hhmm || !/^\d{2}:\d{2}/.test(hhmm)) return hhmm ?? "";
    const [h, m] = hhmm.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * One turf in the side list. Hovering or selecting it drives the map, so the two
 * halves of the section are always talking about the same place.
 */
function TurfRow({ turf, layer, active, onSelect }) {
    const count = layer === "matches" ? turf.open_matches : turf.open_slots;
    const countLabel = layer === "matches" ? "open games" : "free slots";

    return (
        <button
            type="button"
            onClick={() => onSelect(turf.id)}
            onMouseEnter={() => onSelect(turf.id)}
            aria-current={active}
            className={cn(
                "w-full rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.99] active:duration-75 motion-reduce:transition-none motion-reduce:active:scale-100",
                active
                    ? "border-primary/45 bg-primary/10 shadow-[0_0_24px_rgba(29,185,84,0.18)]"
                    : "border-border bg-card/50 hover:border-primary/30 hover:bg-primary/5"
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                        {turf.name}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{turf.city}</span>
                        {turf.distance_km != null && (
                            <span className="shrink-0">· {turf.distance_km} km</span>
                        )}
                    </p>
                </div>

                <span
                    className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums",
                        count > 0
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                    )}
                >
                    {count ?? 0}
                </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>
                    {count ?? 0} {countLabel}
                </span>
                {turf.next_free_slot && (
                    <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        next {prettyTime(turf.next_free_slot)}
                    </span>
                )}
                {turf.rating != null && turf.rating > 0 && (
                    <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-current text-primary" />
                        {turf.rating}
                    </span>
                )}
            </div>

            {/* Match previews only matter on the games layer — on the slots layer
                they'd bury the availability the visitor came for. */}
            {layer === "matches" && turf.matches?.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                    {turf.matches.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2">
                            <Link
                                href={`/events/${m.id}`}
                                className="truncate text-xs font-medium text-foreground hover:text-primary"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {m.title}
                            </Link>
                            <span className="shrink-0 text-[11px] font-semibold text-primary">
                                {m.spots_left > 0 ? `${m.spots_left} spots` : "full"}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <Link
                href={`/venues/${turf.id}`}
                onClick={(e) => e.stopPropagation()}
                className="mt-3 inline-flex text-xs font-semibold text-primary hover:underline"
            >
                {layer === "matches" ? "View turf" : "Book a slot"} →
            </Link>
        </button>
    );
}

export default function CityPulse() {
    const scope = useRef(null);

    const [center, setCenter] = useState(DHAKA_CENTER);
    const [radius, setRadius] = useState(10);
    const [layer, setLayer] = useState("slots");
    const [activeId, setActiveId] = useState(null);
    const [locating, setLocating] = useState(false);
    // Geolocation was tried and refused/failed. Shown once, quietly — a denied
    // permission is a choice, not an error to nag about.
    const [locationDenied, setLocationDenied] = useState(false);

    // `date` is intentionally omitted: the backend fills in today in Bangladesh
    // wall-clock, which is the only correct answer regardless of the visitor's
    // device clock or timezone.
    const { data, isLoading, isFetching } = useGetCityPulseQuery({
        lat: center[0],
        lng: center[1],
        radius,
    });

    const turfs = useMemo(() => data?.turfs ?? [], [data]);

    // Sort by whatever the active layer is about, so the list answers the
    // question the toggle just asked. Ties fall back to distance.
    const sorted = useMemo(() => {
        const key = layer === "matches" ? "open_matches" : "open_slots";
        return [...turfs].sort(
            (a, b) => (b[key] ?? 0) - (a[key] ?? 0) || (a.distance_km ?? 0) - (b.distance_km ?? 0)
        );
    }, [turfs, layer]);

    const totals = data?.totals ?? {};

    useGSAP(() => {
        fadeUpOnScroll(".pulse-head");
    }, { scope });

    // Geolocation only ever runs from this button — never automatically on load,
    // which would fire a permission prompt at a visitor who never asked for one.
    const useMyLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setLocationDenied(true);
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setCenter([pos.coords.latitude, pos.coords.longitude]);
                setActiveId(null);
                setLocating(false);
            },
            () => {
                // Denied or unavailable: stay on Dhaka. Nothing is broken.
                setLocationDenied(true);
                setLocating(false);
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
        );
    }, []);

    return (
        <section
            ref={scope}
            // `id` is the hero's scroll-cue target; `scroll-mt-24` keeps the
            // fixed navbar from covering the heading on arrival.
            id="city-pulse"
            className="relative isolate scroll-mt-24 overflow-hidden rounded-[2rem] border border-border bg-gradient-to-b from-[#eaf2ee] to-[#e7f1ea] px-5 py-12 dark:from-[#0a1410] dark:to-[#0a0a0a] md:px-10 md:py-16"
        >
            <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/20 blur-[120px]" />
            <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-teal/15 blur-[120px]" />

            {/* header */}
            <div className="pulse-head relative mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <span className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-[0.02em] text-muted-foreground">
                        <Compass className="h-3.5 w-3.5 text-primary" />
                        Live across the city
                    </span>

                    <h2 className="mt-4 text-3xl font-extrabold leading-[1.15] tracking-[-0.015em] text-foreground md:text-4xl md:leading-[1.1] md:tracking-[-0.025em]">
                        What&apos;s{" "}
                        <span className="bg-gradient-to-r from-brand to-teal bg-clip-text text-transparent dark:from-brand-light">
                            open right now
                        </span>
                    </h2>

                    <p className="mt-2 max-w-md text-base leading-7 text-muted-foreground">
                        Every free slot and every match still looking for players, on
                        one map. Updated as bookings land.
                    </p>
                </div>

                <div className="flex flex-col items-start gap-3 lg:items-end">
                    <Button
                        type="button"
                        variant="glass"
                        onClick={useMyLocation}
                        disabled={locating}
                        className="h-12 rounded-full px-5"
                    >
                        {locating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <LocateFixed className="h-4 w-4" />
                        )}
                        {locating ? "Finding you…" : "Use my location"}
                    </Button>
                    {locationDenied && (
                        <p className="text-xs text-muted-foreground">
                            Showing central Dhaka — location isn&apos;t available.
                        </p>
                    )}
                </div>
            </div>

            {/* controls */}
            <div className="relative mb-6 flex flex-wrap items-center gap-3">
                {/* layer toggle */}
                <div
                    role="tablist"
                    aria-label="Map layer"
                    className="glass-chip inline-flex rounded-full p-1"
                >
                    {LAYERS.map((l) => {
                        const Icon = l.icon;
                        const on = layer === l.id;
                        return (
                            <button
                                key={l.id}
                                type="button"
                                role="tab"
                                aria-selected={on}
                                title={l.blurb}
                                onClick={() => {
                                    setLayer(l.id);
                                    setActiveId(null);
                                }}
                                className={cn(
                                    "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-all duration-200 active:scale-[0.97] active:duration-75 motion-reduce:transition-none motion-reduce:active:scale-100",
                                    on
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {l.label}
                            </button>
                        );
                    })}
                </div>

                {/* radius */}
                <div className="glass-chip inline-flex rounded-full p-1">
                    {RADIUS_OPTIONS.map((r) => (
                        <button
                            key={r}
                            type="button"
                            onClick={() => setRadius(r)}
                            aria-pressed={radius === r}
                            className={cn(
                                "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold tabular-nums transition-all duration-200 active:scale-[0.97] active:duration-75 motion-reduce:transition-none motion-reduce:active:scale-100",
                                radius === r
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {r} km
                        </button>
                    ))}
                </div>

                {/* live totals */}
                <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
                    {isFetching && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    <span>
                        <strong className="font-extrabold tabular-nums text-foreground">
                            {totals.open_slots ?? 0}
                        </strong>{" "}
                        free slots
                    </span>
                    <span>
                        <strong className="font-extrabold tabular-nums text-foreground">
                            {totals.open_matches ?? 0}
                        </strong>{" "}
                        open games
                    </span>
                </div>
            </div>

            {/* map + list */}
            <div className="relative grid gap-5 lg:grid-cols-[minmax(0,340px)_1fr]">
                {/* list — scrolls independently so the map stays put beside it */}
                <div className="order-2 max-h-[520px] space-y-3 overflow-y-auto pr-1 lg:order-1">
                    {isLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                        ))
                    ) : sorted.length === 0 ? (
                        <div className="glass-neutral rounded-2xl p-6 text-center">
                            <CalendarClock className="mx-auto h-8 w-8 text-muted-foreground" />
                            <p className="mt-3 text-sm font-semibold text-foreground">
                                Nothing within {radius} km
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Try a wider radius, or browse every turf.
                            </p>
                            <Button asChild variant="glass" className="mt-4 h-11 rounded-full px-5">
                                <Link href="/venues">Browse all turfs</Link>
                            </Button>
                        </div>
                    ) : (
                        sorted.map((turf) => (
                            <TurfRow
                                key={turf.id}
                                turf={turf}
                                layer={layer}
                                active={turf.id === activeId}
                                onSelect={setActiveId}
                            />
                        ))
                    )}
                </div>

                {/* map */}
                <div className="order-1 h-[380px] overflow-hidden rounded-2xl border border-border md:h-[520px] lg:order-2">
                    <CityPulseMap
                        turfs={turfs}
                        center={center}
                        layer={layer}
                        activeId={activeId}
                        onSelect={setActiveId}
                    />
                </div>
            </div>
        </section>
    );
}
