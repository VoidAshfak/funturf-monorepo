/**
 * The reduced-motion opt-out, on its own with no dependencies.
 *
 * Split out of `animations.js` so callers that only need to ASK the question
 * don't have to import GSAP to do it. The root smooth-scroll provider is the
 * reason: importing it from `animations.js` there put GSAP + ScrollTrigger in
 * the shared bundle of every route on the site, including ones with no animation
 * at all. `animations.js` re-exports this, so existing imports are unaffected.
 *
 * SSR-safe: returns false on the server so markup renders identically, then the
 * client re-checks inside an effect.
 */
export function prefersReducedMotion() {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
