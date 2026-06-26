"use client";

import { useRef } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import { CalendarPlus, MapPin, Search } from "lucide-react";
import BannerCarousel from "@/components/BannerCarousel";
import { Button } from "@/components/ui/button";
import { gsap, heroReveal } from "@/lib/animations";

const STATS = [
    { value: "120+", label: "Turfs" },
    { value: "5k+", label: "Players" },
    { value: "800+", label: "Matches" },
];

// Theme-aware hero — light surfaces in light mode, green-glass dark in dark mode.
export default function Hero() {
    const scope = useRef(null);

    useGSAP(() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) return;
        heroReveal(".hero-item");
        gsap.from(".hero-media", {
            opacity: 0,
            x: 40,
            duration: 1,
            ease: "power3.out",
            delay: 0.25,
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

            <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pb-14 pt-24 md:px-12 md:pb-16 md:pt-28 lg:grid-cols-2 lg:px-20 lg:pb-20 lg:pt-28">
                {/* Copy column */}
                <div className="text-center lg:text-left">
                    <span className="hero-item glass-chip mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-muted-foreground lg:mx-0">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        Your local turf community
                    </span>

                    <h1 className="hero-item mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
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

                    {/* Search */}
                    <div className="hero-item mt-8 flex w-full max-w-md items-center gap-2 rounded-full border border-border bg-card/60 p-1.5 pl-5 backdrop-blur-md mx-auto lg:mx-0">
                        <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search turf grounds near you"
                            className="h-10 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                        />
                        <Button asChild className="shrink-0 rounded-full px-5 green-glow">
                            <Link href="/venues">Search</Link>
                        </Button>
                    </div>

                    {/* CTAs */}
                    <div className="hero-item mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                        <Button asChild size="lg" className="rounded-full px-6">
                            <Link href="/venues">
                                <MapPin className="h-4 w-4" />
                                Book a Turf
                            </Link>
                        </Button>
                        <Button asChild size="lg" variant="glass" className="rounded-full px-6">
                            <Link href="/events">
                                <CalendarPlus className="h-4 w-4" />
                                Create a Match
                            </Link>
                        </Button>
                    </div>

                    {/* Stats */}
                    <div className="hero-item mt-10 flex justify-center gap-8 lg:justify-start">
                        {STATS.map((s) => (
                            <div key={s.label} className="text-center lg:text-left">
                                <p className="text-2xl font-extrabold text-foreground sm:text-3xl">
                                    {s.value}
                                </p>
                                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    {s.label}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Media column */}
                <div className="hero-media relative hidden lg:block">
                    <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-primary/10 blur-2xl" />
                    <BannerCarousel />
                </div>
            </div>
        </section>
    );
}
