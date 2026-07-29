"use client";

import { useEffect } from "react";
import "lenis/dist/lenis.css";
import { prefersReducedMotion } from "@/lib/reducedMotion";

/**
 * Site-wide smooth scrolling.
 *
 * Deliberately gentle (`lerp: 0.12`). Smooth scrolling is a trade: it buys
 * continuity but inserts latency between the wheel and the pixels, and past a
 * certain point the page stops feeling *direct* and starts feeling like it's
 * catching up with you. The value here settles in a few frames — enough to take
 * the edge off a wheel notch, not enough to float.
 *
 * Four things this has to get right, all of which are how smooth-scroll
 * libraries usually go wrong:
 *
 *  1. **ScrollTrigger stays in sync.** Lenis is driven from GSAP's ticker rather
 *     than its own rAF loop. Two independent loops means ScrollTrigger can read a
 *     scroll position Lenis is about to change later in the same frame, which
 *     shows up as jitter in exactly the sticky/scroll-driven work this site has
 *     (see HowItWorks).
 *
 *  2. **Modals.** Radix locks body scroll while a dialog or drawer is open and
 *     marks it with `data-scroll-locked`. Lenis knows nothing about that and
 *     would happily keep translating the page behind the overlay, so it is
 *     stopped and started off that attribute.
 *
 *  3. **Nested scrollers.** Chat panels, dropdowns, the venue list beside the
 *     map — anything with its own scrollbar must keep native scrolling, or the
 *     wheel scrolls the page out from under whatever the user is reading.
 *     Handled generically below rather than by tagging each container.
 *
 *  4. **Reduced motion.** Not initialised at all — interposing an easing curve
 *     between input and page movement is precisely the kind of motion that
 *     setting opts out of. The browser's own instant scrolling is the correct
 *     behaviour there, not a shorter animation.
 */
export default function SmoothScroll({ children }) {
    useEffect(() => {
        if (prefersReducedMotion()) return;

        // Cleanup is registered from inside an async setup, so it has to be
        // reachable from the synchronous return below — and setup has to be able
        // to abort if the component unmounts before the imports resolve.
        let disposed = false;
        let dispose = () => {};

        // Lenis and GSAP are imported here rather than at module scope on
        // purpose. This provider sits in the ROOT layout, so a static import
        // would put both in the shared bundle of every route on the site —
        // login, signup, the whole dashboard — none of which need them. Loading
        // them inside the effect keeps that cost on the pages that scroll.
        (async () => {
            const [{ default: Lenis }, { gsap, ScrollTrigger }] = await Promise.all([
                import("lenis"),
                import("@/lib/animations"),
            ]);
            if (disposed) return;

            const lenis = new Lenis({
                // Fraction of the remaining distance covered per frame. Higher
                // is snappier; this lands just short of "instant".
                lerp: 0.12,
                // Let Lenis animate `#hash` navigation (the hero's scroll cue)
                // so anchors ease the same way as everything else.
                anchors: true,
                // Touch is left completely alone: native momentum scrolling is
                // already excellent, and syncing it is where these libraries
                // feel worst — a phone is the one place smooth scroll makes
                // things worse.
                syncTouch: false,

                /**
                 * Keep native scrolling for any element that scrolls on its own.
                 *
                 * Checked generically instead of tagging containers with
                 * `data-lenis-prevent` one by one: there are ~17 scrollable
                 * panels today, and the tagging approach silently breaks on the
                 * next one somebody adds. The manual attribute is still honoured
                 * as an override.
                 *
                 * Cheap DOM properties are tested BEFORE `getComputedStyle`, so
                 * the expensive call only happens for the rare node that
                 * actually overflows — this runs over the event path on every
                 * wheel tick.
                 */
                prevent: (node) => {
                    if (node?.hasAttribute?.("data-lenis-prevent")) return true;
                    if (!node?.scrollHeight || node.scrollHeight <= node.clientHeight) {
                        return false;
                    }
                    const overflowY = getComputedStyle(node).overflowY;
                    return overflowY === "auto" || overflowY === "scroll";
                },
            });

            // --- GSAP ticker drives Lenis (see note 1 above) ---
            const raf = (time) => lenis.raf(time * 1000); // ticker: s, Lenis: ms
            gsap.ticker.add(raf);
            // GSAP normally clamps large frame deltas to hide jank; with an
            // external scroll source that clamping makes the page lurch after a
            // stall instead of hiding it.
            gsap.ticker.lagSmoothing(0);
            lenis.on("scroll", ScrollTrigger.update);

            // --- Modal scroll-lock (see note 2 above) ---
            const body = document.body;
            const syncScrollLock = () => {
                if (body.hasAttribute("data-scroll-locked")) lenis.stop();
                else lenis.start();
            };
            syncScrollLock();
            const lockObserver = new MutationObserver(syncScrollLock);
            lockObserver.observe(body, {
                attributes: true,
                attributeFilter: ["data-scroll-locked"],
            });

            dispose = () => {
                lockObserver.disconnect();
                gsap.ticker.remove(raf);
                gsap.ticker.lagSmoothing(500, 33); // GSAP's own defaults
                lenis.off("scroll", ScrollTrigger.update);
                lenis.destroy();
            };
        })();

        return () => {
            disposed = true;
            dispose();
        };
    }, []);

    return children;
}
