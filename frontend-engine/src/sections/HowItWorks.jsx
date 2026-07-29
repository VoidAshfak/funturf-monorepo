"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import { CalendarPlus, MapPin, Route, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollTrigger, fadeUpOnScroll, prefersReducedMotion } from "@/lib/animations";
import { cn } from "@/lib/utils";

/**
 * How Funturf works, told by scrolling.
 *
 * Desktop is a scroll-driven stage: a tall track holds a `position: sticky`
 * panel, and a single ScrollTrigger maps scroll progress through the track onto
 * a step index. The step cards rotate through in 3D like a dealt deck while the
 * board beside them swaps to that step's photo.
 *
 * Sticky rather than GSAP's `pin`: pin injects a spacer element and rewrites the
 * section's height, which is where scrollytelling usually breaks on resize and
 * on mobile. Sticky is native, adds no DOM, and the whole thing degrades to a
 * plain stacked list below `lg` with no extra code.
 *
 * LAYOUT TRAP — do not put `overflow-hidden` on any ancestor of the sticky
 * panel. It makes that ancestor the nearest scroll container, and because the
 * ancestor itself never scrolls, the sticky element silently stops sticking. The
 * ambient glow is therefore clipped by its own absolutely-positioned wrapper
 * instead of by the section.
 */

/**
 * How much scroll each step gets, in vh — how long a step stays on screen.
 *
 * Read this together with the track height below, because the two are easy to
 * get wrong together: a ScrollTrigger running `top top` → `bottom bottom` only
 * has `trackHeight − 100vh` of travel, since the last viewport-height of the
 * track is consumed reaching the end. Sizing the track at `steps × perStep`
 * therefore gave the steps a THIRD of their intended scroll (3×55vh of track
 * = only 65vh of actual travel, ~22vh a step), which is why a flick blew
 * through all three. The track adds a viewport so this number means what it says.
 */
const STEP_SCROLL_VH = 70;

const STEPS = [
    {
        id: "find",
        icon: MapPin,
        title: "Find a turf",
        body: "Search grounds near you, compare hourly rates, and see exactly which 90-minute slots are still free today.",
        cta: { href: "/venues", label: "Browse turfs" },
        // Swap these for real turf photography — see the note in the section
        // header comment. The field exists so it stays a one-line change.
        image: "/assets/images/hero-2.jpg",
        imageAlt: "A floodlit football pitch",
        caption: "Banani Turf Arena",
        sub: "7-a-side · ৳2,500/hr",
        chips: ["6:00 PM", "7:30 PM", "9:00 PM"],
    },
    {
        id: "post",
        icon: CalendarPlus,
        title: "Post the match",
        body: "Lock the slot, set how many players you need, and your match goes live to everyone in the city.",
        cta: { href: "/events/create", label: "Create a match" },
        image: "/assets/images/hero-1.jpg",
        imageAlt: "Players contesting the ball during a match",
        caption: "Friday night 7-a-side",
        sub: "Needs 4 more players",
        chips: ["Football", "Tonight", "Banani"],
    },
    {
        id: "fill",
        icon: Users,
        title: "Fill the squad",
        body: "Players request to join, you approve who plays, and the cost splits across everyone who turns up.",
        cta: { href: "/turfmates", label: "Find turfmates" },
        image: "/assets/images/hero-3.jpg",
        imageAlt: "A player ready for kick-off",
        caption: "Squad complete",
        sub: "14 of 14 confirmed",
        chips: ["৳180 each", "Chat open", "Ready"],
    },
];

/**
 * The photo board. All three images are mounted at once and cross-faded — the
 * next step's photo is already decoded when its turn comes, so the swap never
 * shows a blank frame the way a single swapped `src` would.
 */
function StepBoard({ steps, active, animate }) {
    return (
        <div className="glass-card relative h-full w-full overflow-hidden rounded-3xl">
            {steps.map((step, i) => {
                const on = i === active;
                return (
                    <div
                        key={step.id}
                        aria-hidden={!on}
                        // Matched to the deck's timing — the photo and the copy
                        // describe the same step, so they must land together.
                        className="absolute inset-0 transition-[opacity,transform] duration-[420ms] ease-out"
                        style={{
                            opacity: on ? 1 : 0,
                            // A touch of scale on the way in reads as the photo
                            // arriving rather than simply appearing.
                            transform: animate ? `scale(${on ? 1 : 1.06})` : "none",
                        }}
                    >
                        <Image
                            src={step.image}
                            alt={step.imageAlt}
                            fill
                            sizes="(max-width: 1024px) 100vw, 460px"
                            className="object-cover"
                            // Only the first board is above the fold-ish; the rest
                            // can wait rather than competing with the hero.
                            priority={i === 0}
                        />

                        {/* Scrim — the overlay copy has to stay legible on any
                            photo and in either theme. */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />

                        <div className="absolute inset-x-0 bottom-0 p-6">
                            <p className="text-xl font-bold tracking-[-0.01em] text-white">
                                {step.caption}
                            </p>
                            <p className="mt-1 text-sm text-white/75">{step.sub}</p>

                            <div className="mt-4 flex flex-wrap gap-2">
                                {step.chips.map((chip) => (
                                    <span
                                        key={chip}
                                        className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md"
                                    >
                                        {chip}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* progress rail */}
            <div className="absolute right-5 top-5 z-10 flex flex-col gap-1.5">
                {steps.map((step, i) => (
                    <span
                        key={step.id}
                        className={cn(
                            "w-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none",
                            i === active ? "h-7 bg-primary" : "h-1.5 bg-white/40"
                        )}
                    />
                ))}
            </div>
        </div>
    );
}

/** Step copy. Shared by the rotating desktop deck and the plain mobile list. */
function StepBody({ step, index, active }) {
    return (
        <>
            <div className="flex items-center gap-3">
                <span
                    className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold tabular-nums transition-colors duration-300 motion-reduce:transition-none",
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                >
                    {index + 1}
                </span>
                <h3 className="text-xl font-bold tracking-[-0.01em] text-foreground">
                    {step.title}
                </h3>
            </div>

            <p className="mt-3 text-base leading-7 text-muted-foreground">{step.body}</p>

            <Button asChild variant="glass" className="mt-4 h-12 rounded-full px-5">
                <Link href={step.cta.href}>{step.cta.label}</Link>
            </Button>
        </>
    );
}

export default function HowItWorks() {
    const scope = useRef(null);
    const trackRef = useRef(null);
    const [active, setActive] = useState(0);
    // Resolved after mount so the server and first client render agree; the
    // transforms below are skipped entirely when motion is reduced.
    const [animate, setAnimate] = useState(true);

    useEffect(() => setAnimate(!prefersReducedMotion()), []);

    useGSAP(
        () => {
            fadeUpOnScroll(".hiw-head");

            // ONE ScrollTrigger over the whole track, not one per step: progress
            // through the track maps straight onto the step index, so scrolling
            // up and down are symmetric for free and there is no chance of two
            // triggers disagreeing about which step is current.
            const track = trackRef.current;
            if (!track) return;

            const trigger = ScrollTrigger.create({
                trigger: track,
                start: "top top",
                end: "bottom bottom",
                onUpdate: (self) => {
                    const i = Math.min(
                        STEPS.length - 1,
                        Math.floor(self.progress * STEPS.length)
                    );
                    // React bails out of identical state, so this is a no-op on
                    // most frames despite firing on every scroll tick.
                    setActive(i);
                },
            });

            return () => trigger.kill();
        },
        { scope }
    );

    return (
        <section ref={scope} className="relative isolate rounded-[2rem] border border-border bg-gradient-to-b from-[#eef3ef] to-[#e7f1ea] dark:from-[#0c1410] dark:to-[#0a0a0a]">
            {/* Decoration only. Clipped here — NOT on the section — so no
                overflow-hidden ancestor ever sits above the sticky panel. */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]">
                <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-primary/15 blur-[120px]" />
            </div>

            <div className="relative px-5 py-12 md:px-10 md:py-16">
                <div className="hiw-head mb-10 max-w-md">
                    <span className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-[0.02em] text-muted-foreground">
                        <Route className="h-3.5 w-3.5 text-primary" />
                        From idea to kick-off
                    </span>

                    <h2 className="mt-4 text-3xl font-extrabold leading-[1.15] tracking-[-0.015em] text-foreground md:text-4xl md:leading-[1.1] md:tracking-[-0.025em]">
                        Three steps to a{" "}
                        <span className="bg-gradient-to-r from-brand to-teal bg-clip-text text-transparent dark:from-brand-light">
                            full squad
                        </span>
                    </h2>

                    <p className="mt-2 text-base leading-7 text-muted-foreground">
                        No group chat archaeology. No chasing people for confirmations.
                    </p>
                </div>

                {/* ---- mobile: one card per step, photo included ---- */}
                <ol className="space-y-6 lg:hidden">
                    {STEPS.map((step, i) => (
                        <li
                            key={step.id}
                            className="overflow-hidden rounded-2xl border border-border bg-card/50"
                        >
                            <div className="relative aspect-[16/10] w-full">
                                <Image
                                    src={step.image}
                                    alt={step.imageAlt}
                                    fill
                                    sizes="100vw"
                                    className="object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-black/10" />
                                <div className="absolute inset-x-0 bottom-0 p-4">
                                    <p className="text-base font-bold text-white">
                                        {step.caption}
                                    </p>
                                    <p className="text-xs text-white/75">{step.sub}</p>
                                </div>
                            </div>
                            <div className="p-5">
                                <StepBody step={step} index={i} active />
                            </div>
                        </li>
                    ))}
                </ol>

                {/*
                    ---- desktop: scroll-driven stage ----
                    The track is tall; the panel inside it sticks. Scrolling the
                    track's height is what advances the deck.
                */}
                {/*
                    Track height = one viewport + the scroll the steps actually
                    need. The `100vh` term is what the trigger burns getting from
                    `top top` to `bottom bottom`; without it every step silently
                    gets a fraction of STEP_SCROLL_VH.

                    The sticky panel stays stuck for `trackHeight − (6rem + panel
                    height)` ≈ 234vh, comfortably longer than the 210vh of
                    progress, so the deck never unsticks mid-sequence.
                */}
                <div
                    ref={trackRef}
                    className="hidden lg:block"
                    style={{ height: `calc(100vh + ${STEPS.length * STEP_SCROLL_VH}vh)` }}
                >
                    {/* Columns stretch to the panel height (the grid default) so
                        the photo board's `h-full` has something to resolve
                        against; the card is top-aligned inside its column
                        instead, via `top-0`. */}
                    <div className="sticky top-24 grid h-[min(70vh,600px)] grid-cols-2 gap-16">
                        {/*
                            Rotating deck.

                            Cards are top-aligned in the column, not centred, so
                            the active card's first line always sits level with
                            the top of the photo board beside it. Centring made
                            the copy jump vertically whenever a step's body
                            wrapped to a different number of lines.
                        */}
                        <ol className="relative h-full [perspective:1400px]">
                            {STEPS.map((step, i) => {
                                const offset = i - active;
                                const on = offset === 0;

                                // One card is on screen at a time. Upcoming cards
                                // wait just below, tilted back; past ones leave
                                // through the top — so the deck moves with the
                                // scroll rather than against it. Both are fully
                                // transparent, so this is purely the path in and
                                // out, never a stack of half-read cards.
                                const transform = animate
                                    ? `translateY(${offset === 0 ? 0 : offset > 0 ? 44 : -44}px) rotateX(${
                                          offset === 0 ? 0 : offset > 0 ? -16 : 16
                                      }deg) scale(${on ? 1 : 0.96})`
                                    : "none";

                                return (
                                    <li
                                        key={step.id}
                                        aria-current={on}
                                        aria-hidden={!on}
                                        className={cn(
                                            // `inset-x-0 top-0`: every card occupies
                                            // the exact same box, so switching steps
                                            // never shifts the layout.
                                            // `visibility` is in the transition list
                                            // on purpose: CSS switches it as a
                                            // discrete step at the END of the
                                            // transition, so the card fades out
                                            // first and only then stops being
                                            // focusable — omit it and the fade is
                                            // cut off at frame one.
                                            "absolute inset-x-0 top-0 rounded-2xl border p-6 transition-[transform,opacity,visibility] duration-[380ms] ease-out [transform-style:preserve-3d] motion-reduce:transition-none",
                                            on
                                                ? "z-10 border-primary/40 bg-primary/5"
                                                : "border-border bg-card/40"
                                        )}
                                        style={{
                                            transform,
                                            opacity: on ? 1 : 0,
                                            // Hidden cards must not be clickable or
                                            // tabbable — their CTA is a real link.
                                            pointerEvents: on ? "auto" : "none",
                                            visibility: on ? "visible" : "hidden",
                                        }}
                                    >
                                        <StepBody step={step} index={i} active={on} />
                                    </li>
                                );
                            })}
                        </ol>

                        {/* photo board */}
                        <StepBoard steps={STEPS} active={active} animate={animate} />
                    </div>
                </div>
            </div>
        </section>
    );
}
