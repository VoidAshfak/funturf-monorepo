"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, MOTION, prefersReducedMotion } from "@/lib/animations";

/**
 * A number that counts up to its value the first time it scrolls into view.
 *
 * The final value is rendered on the server and sits in the HTML from the very
 * first paint — the animation only ever replaces text that is already correct.
 * That way the number is right for search engines, for reduced-motion users, and
 * in the window before hydration, instead of starting life as a misleading "0".
 */
export default function CountUp({ value = 0, suffix = "", className = "" }) {
    const ref = useRef(null);

    useGSAP(
        () => {
            const target = Number(value) || 0;
            // Counting from zero is decorative motion; the honest value is
            // already on screen, so opting out costs nothing.
            if (prefersReducedMotion() || target === 0) return;

            const counter = { n: 0 };
            gsap.to(counter, {
                n: target,
                duration: MOTION.duration.slow * 1.6,
                ease: "power2.out",
                scrollTrigger: {
                    trigger: ref.current,
                    start: "top 90%",
                    toggleActions: "play none none none",
                },
                onUpdate: () => {
                    if (ref.current) {
                        ref.current.textContent =
                            Math.round(counter.n).toLocaleString() + suffix;
                    }
                },
            });
        },
        { dependencies: [value, suffix] }
    );

    return (
        <span ref={ref} className={className}>
            {Number(value ?? 0).toLocaleString()}
            {suffix}
        </span>
    );
}
