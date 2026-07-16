"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Loader2, LogIn, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { notifyError, notifySuccess } from "@/lib/notify";
import { getApiErrorMessage } from "@/utils/apiError";
import { useGetVenueByIdQuery, useRateTurfMutation } from "@/store/api/apiSlice";

// Interactive turf rating. ONE rating per user — clicking a star creates it the
// first time and updates it on every later click (raise or lower). The headline
// average + count come from the backend aggregate; the caller's own stars are
// pre-filled from `my_rating` (only present when signed in).
//
// Seeded by the server-rendered venue (avg/count) for instant paint, then kept
// live via RTK Query — which, being an authenticated call, also fills `my_rating`.
export default function TurfRating({ venueId, initialRating = 0, initialCount = 0 }) {
    const { data: session } = useSession();
    const signedIn = !!session?.user;

    const { data: venue } = useGetVenueByIdQuery(venueId, { skip: !venueId });
    const [rate, { isLoading }] = useRateTurfMutation();

    // Live values fall back to the server-rendered seed.
    const average = Number(venue?.rating ?? initialRating) || 0;
    const count = venue?.rating_count ?? initialCount ?? 0;
    const myRating = venue?.my_rating ?? 0;

    // Star currently hovered (preview), 0 when not hovering.
    const [hover, setHover] = useState(0);
    // What the stars should show: hover preview wins, else the caller's saved rating.
    const shown = hover || myRating;

    const submit = async (value) => {
        try {
            const res = await rate({ venueId, rating: value }).unwrap();
            notifySuccess(
                myRating ? "Rating updated" : "Thanks for rating!",
                `You rated this turf ${res.my_rating}/5.`
            );
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Couldn't save your rating."));
        }
    };

    return (
        <div className="glass-card rounded-3xl p-5 md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold text-foreground">Rate this turf</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {average > 0 ? (
                            <>
                                <span className="font-bold text-foreground">{average.toFixed(1)}</span>
                                {" / 5 · "}
                                {count} rating{count === 1 ? "" : "s"}
                            </>
                        ) : (
                            "No ratings yet — be the first."
                        )}
                    </p>
                </div>

                {signedIn ? (
                    <div
                        className="flex items-center gap-1"
                        onMouseLeave={() => setHover(0)}
                        role="radiogroup"
                        aria-label="Your rating"
                    >
                        {[1, 2, 3, 4, 5].map((v) => (
                            <button
                                key={v}
                                type="button"
                                disabled={isLoading}
                                aria-label={`${v} star${v === 1 ? "" : "s"}`}
                                aria-checked={myRating === v}
                                role="radio"
                                onMouseEnter={() => setHover(v)}
                                onClick={() => submit(v)}
                                className="rounded-full p-0.5 transition-transform hover:scale-110 disabled:opacity-60"
                            >
                                <Star
                                    className={cn(
                                        "h-7 w-7 transition-colors",
                                        v <= shown
                                            ? "fill-yellow-400 text-yellow-400"
                                            : "text-muted-foreground/40"
                                    )}
                                />
                            </button>
                        ))}
                        {isLoading && (
                            <Loader2 className="ml-2 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                    </div>
                ) : (
                    <Button asChild variant="outline" className="rounded-full">
                        <Link href="/login">
                            <LogIn className="h-4 w-4" /> Sign in to rate
                        </Link>
                    </Button>
                )}
            </div>

            {signedIn && myRating > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                    Your rating: <span className="font-semibold text-foreground">{myRating}/5</span>.
                    Tap a different star to change it.
                </p>
            )}
        </div>
    );
}
