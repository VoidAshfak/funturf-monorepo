import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register once on the client. Safe to import anywhere.
if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
}

export { gsap, ScrollTrigger };

/**
 * Canonical motion presets for funturf. Tune here once; whole site follows.
 * Durations in seconds, eases are GSAP free eases only.
 */
export const MOTION = {
    duration: { fast: 0.4, base: 0.6, slow: 0.9 },
    ease: { out: "power3.out", inOut: "power2.inOut", pop: "back.out(1.6)" },
    stagger: 0.08,
    yLift: 24, // default upward travel distance (px)
};

/**
 * Hero reveal: fade + lift children of `scope` in sequence.
 * Use inside useGSAP for a landing/hero section.
 * @param {string|Element[]} targets - selector or elements to reveal
 */
export function heroReveal(targets, opts = {}) {
    return gsap.from(targets, {
        y: MOTION.yLift * 1.5,
        opacity: 0,
        duration: MOTION.duration.slow,
        ease: MOTION.ease.out,
        stagger: MOTION.stagger * 1.5,
        ...opts,
    });
}

/**
 * Staggered list reveal tied to scroll. Use for venue / event / team card grids.
 * @param {string|Element[]} items - the card elements
 * @param {Element} trigger - container element (usually the useGSAP scope ref)
 */
export function staggerOnScroll(items, trigger, opts = {}) {
    return gsap.from(items, {
        y: MOTION.yLift,
        opacity: 0,
        duration: MOTION.duration.base,
        ease: MOTION.ease.out,
        stagger: MOTION.stagger,
        scrollTrigger: {
            trigger,
            start: "top 80%",
            toggleActions: "play none none none",
        },
        ...opts,
    });
}

/**
 * Fade a section up when it scrolls into view.
 * @param {string|Element[]} targets
 */
export function fadeUpOnScroll(targets, opts = {}) {
    return gsap.from(targets, {
        y: MOTION.yLift,
        opacity: 0,
        duration: MOTION.duration.base,
        ease: MOTION.ease.out,
        scrollTrigger: {
            trigger: targets,
            start: "top 85%",
            toggleActions: "play none none none",
        },
        ...opts,
    });
}

/**
 * Subtle hover pop for cards/buttons. Returns a cleanup-friendly timeline
 * you attach in event handlers, or use CSS for simple cases.
 * @param {Element} el
 */
export function hoverPop(el) {
    const tl = gsap.timeline({ paused: true });
    tl.to(el, { scale: 1.03, duration: MOTION.duration.fast, ease: MOTION.ease.pop });
    return tl;
}
