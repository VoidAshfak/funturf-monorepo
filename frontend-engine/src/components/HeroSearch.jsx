"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, MapPin, Search, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ImageWithFallback from "@/components/ImageWithFallback";
import { useGetVenuesQuery } from "@/store/api/apiSlice";
import { locationText, searchVenues, venueSports } from "@/utils/venueSearch";

// Homepage hero quick-search. Types-to-search over the venue list (loaded via
// RTK Query, shared cache with the rest of the app), previews the top 2 matches
// in an anchored dropdown, and hands off to the full turfs page — carrying the
// query as `?q=` so /venues lands pre-filtered. Purely a client search over
// already-public data, so no auth is involved.
export default function HeroSearch({ className = "" }) {
    const router = useRouter();
    const { data: venues = [] } = useGetVenuesQuery();

    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    const trimmed = query.trim();

    // Top 2 matches for the preview dropdown. Recomputed only when the query or
    // the venue list changes.
    const results = useMemo(
        () => searchVenues(venues, trimmed, 2),
        [venues, trimmed]
    );

    // Land on the full turfs page, carrying the query so the explorer seeds its
    // filter from `?q=`. Empty query just opens the unfiltered page.
    const goToResults = () => {
        setOpen(false);
        router.push(trimmed ? `/venues?q=${encodeURIComponent(trimmed)}` : "/venues");
    };

    const onKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            goToResults();
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    };

    // Close the dropdown on an outside click.
    useEffect(() => {
        if (!open) return;
        const onDocClick = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [open]);

    const showDropdown = open && trimmed.length > 0;

    return (
        <div ref={containerRef} className={`relative z-50 w-full max-w-md ${className}`}>
            {/* search pill */}
            <div className="flex items-center gap-2 rounded-full border border-border bg-card/60 p-1.5 pl-5 backdrop-blur-md focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(29,185,84,0.12)]">
                <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                    placeholder="Search turf grounds near you"
                    aria-label="Search turfs"
                    className="h-10 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery("");
                            setOpen(false);
                        }}
                        aria-label="Clear search"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
                <Button
                    type="button"
                    onClick={goToResults}
                    className="shrink-0 rounded-full px-5 green-glow"
                >
                    Search
                </Button>
            </div>

            {/* results dropdown — top 2 preview + a CTA into the full page */}
            {showDropdown && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-popover/95 text-left shadow-xl backdrop-blur-md">
                    {results.length > 0 ? (
                        <ul className="p-2">
                            {results.map((v) => (
                                <li key={v.id}>
                                    <Link
                                        href={`/venues/${v.id}`}
                                        onClick={() => setOpen(false)}
                                        className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted"
                                    >
                                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border">
                                            <ImageWithFallback
                                                src={v.images?.[0]}
                                                alt={v.name || "Turf"}
                                                fill
                                                sizes="48px"
                                                className="object-cover"
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-foreground">
                                                {v.name}
                                            </p>
                                            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                                                <MapPin className="h-3 w-3 shrink-0" />
                                                <span className="truncate">
                                                    {locationText(v) ||
                                                        venueSports(v).join(", ") ||
                                                        "Turf"}
                                                </span>
                                            </p>
                                        </div>
                                        {v.rating != null && (
                                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                                                <Star className="h-3 w-3 fill-current" />
                                                {v.rating}
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="px-4 py-5 text-center text-sm text-muted-foreground">
                            No turfs match “{trimmed}”.
                        </p>
                    )}

                    {/* CTA into the full turfs page, pre-filtered by the query */}
                    <button
                        type="button"
                        onClick={goToResults}
                        className="flex w-full items-center justify-between gap-2 border-t border-border bg-muted/40 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-muted"
                    >
                        See all results on the turfs page
                        <ArrowRight className="h-4 w-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
