"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import { CalendarPlus, ChevronDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import HeroSearch from "@/components/HeroSearch";
import HeroStats from "@/components/HeroStats";
import { gsap, heroReveal, MOTION, prefersReducedMotion } from "@/lib/animations";

// Heavy embla carousel — lazy-loaded so it doesn't block hero paint.
const BannerCarousel = dynamic(() => import("@/components/BannerCarousel"), {
    ssr: false,
    loading: () => (
        // Mirrors BannerCarousel's own wrapper (incl. `lg:mr-0`) so the real
        // carousel drops in without shifting sideways.
        <div className="mx-auto w-full max-w-[400px] lg:mr-0">
            <Skeleton className="aspect-[4/5] w-full rounded-3xl" />
        </div>
    ),
});

// Theme-aware hero — light surfaces in light mode, green-glass dark in dark mode.
export default function Hero() {
    const scope = useRef(null);

    useGSAP(() => {
        if (prefersReducedMotion()) return;

        heroReveal(".hero-item");

        // The media column lifts and scales up on the same axis as the copy
        // instead of sliding in from the right. Two unrelated entrance
        // directions read as two separate things arriving; one shared direction
        // reads as one hero settling into place. The scale is what makes the
        // glass card feel like a material coming toward the viewer rather than
        // a picture fading in.
        gsap.from(".hero-media", {
            opacity: 0,
            y: MOTION.yLift * 1.5,
            scale: 0.96,
            duration: MOTION.duration.slow,
            ease: MOTION.ease.out,
            delay: 0.2,
        });
    }, { scope });

    return (
        <section
            ref={scope}
            className="relative isolate overflow-hidden rounded-b-[2.5rem] md:rounded-b-[3rem] bg-gradient-to-br from-[#eef3ef] via-[#e7f1ea] to-[#eef3ef] dark:from-[#0a0a0a] dark:via-[#0c1a12] dark:to-[#0a0a0a]"
        >
            {/* Ambient green glows */}
            <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
            <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-teal/10 blur-[120px]" />

            {/* Dotted turf texture, masked to fade at the edges. Every section
                below the hero carries this; without it the hero was the one flat
                surface on the page and read as belonging to a different site. */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.16] dark:opacity-[0.1]"
                style={{
                    backgroundImage:
                        "radial-gradient(rgba(29,185,84,0.5) 1px, transparent 1px)",
                    backgroundSize: "22px 22px",
                    maskImage:
                        "radial-gradient(ellipse at center, black, transparent 78%)",
                    WebkitMaskImage:
                        "radial-gradient(ellipse at center, black, transparent 78%)",
                }}
            />

            {/* Shared content rail — see `.app_rail` in globals.css. */}
            <div className="app_rail relative grid items-center gap-12 pb-14 pt-24 md:pb-16 md:pt-28 lg:grid-cols-2 lg:pb-20 lg:pt-28">
                {/* Copy column */}
                <div className="text-center lg:text-left">
                    {/* Small text gets slightly *positive* tracking — the mirror
                        of the headline treatment below. */}
                    <span className="hero-item glass-chip mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-[0.02em] text-muted-foreground lg:mx-0">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        Your local turf community
                    </span>

                    {/*
                        Tracking and leading are set per size, not once for all
                        three. Letters read progressively too far apart as type
                        grows, so the 72px desktop headline is tightened hardest
                        and the 36px mobile one barely at all; leading moves the
                        other way — looser small, tighter large.
                    */}
                    <h1 className="hero-item mt-6 text-4xl font-extrabold leading-[1.1] tracking-[-0.015em] text-foreground sm:text-6xl sm:leading-[1.06] sm:tracking-[-0.03em] lg:text-7xl lg:leading-[1.03] lg:tracking-[-0.04em]">
                        Book the turf.
                        <br />
                        Find your{" "}
                        <span className="bg-gradient-to-r from-brand to-teal bg-clip-text text-transparent dark:from-brand-light">
                            squad.
                        </span>
                    </h1>

                    <p className="hero-item mx-auto mt-5 max-w-md text-base leading-7 text-muted-foreground lg:mx-0">
                        Book matches, join teams, and explore venues near you. Built for
                        players, made by players.
                    </p>

                    {/* Search — live quick-search with a top-2 results dropdown that
                        hands off to the full turfs page (see HeroSearch). */}
                    <HeroSearch className="hero-item mt-8 mx-auto lg:mx-0" />

                    {/*
                        CTAs. `size="lg"` alone is a 40px control; the spec's
                        primary-action height is 50px on mobile / 52px above it,
                        so the height is set explicitly here rather than left at
                        the shared default (which serves denser in-app UI).
                    */}
                    <div className="hero-item mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                        <Button
                            asChild
                            size="lg"
                            className="h-[50px] rounded-full px-6 sm:h-[52px]"
                        >
                            <Link href="/venues">
                                <MapPin className="h-4 w-4" />
                                Book a Turf
                            </Link>
                        </Button>
                        <Button
                            asChild
                            size="lg"
                            variant="glass"
                            className="h-[50px] rounded-full px-6 sm:h-[52px]"
                        >
                            <Link href="/events">
                                <CalendarPlus className="h-4 w-4" />
                                Create a Match
                            </Link>
                        </Button>
                    </div>

                    {/* Live counts from the same endpoint the ticker uses. */}
                    <HeroStats className="hero-item mt-10" />
                </div>

                {/*
                    Media column. Shown at every width now — the mobile hero was
                    a wall of text with the product's one visual hidden, which is
                    backwards on the viewport where most visitors arrive. It sits
                    after the copy in source order, so it stacks below on mobile
                    and lands in the right-hand column from `lg` up.
                */}
                <div className="hero-media relative">
                    <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-primary/10 blur-2xl" />
                    <BannerCarousel />
                </div>
            </div>

            {/*
                Scroll cue. The live map is the strongest thing on the page and
                sits entirely below the fold; without an affordance the hero
                reads as the whole screen. It's a real anchor link, so it works
                without JS and is reachable by keyboard.
            */}
            <div className="relative flex justify-center pb-8">
                <Link
                    href="#city-pulse"
                    aria-label="Skip to what's open right now"
                    className="group inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-colors duration-200 hover:text-primary motion-reduce:transition-none"
                >
                    See what&apos;s open now
                    <ChevronDown className="h-4 w-4 animate-bounce group-hover:text-primary motion-reduce:animate-none" />
                </Link>
            </div>
        </section>
    );
}
