"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { fadeUpOnScroll, materializeReveal } from "@/lib/animations";

/**
 * Thin client wrapper that runs a shared entrance recipe on its own subtree.
 *
 * Exists so server components (section headers, static panels) can pick up
 * scroll motion without turning their data layer into client code — the
 * server/client split the design skill asks for.
 *
 * Both recipes no-op under `prefers-reduced-motion`, so nothing here needs a
 * media-query branch of its own.
 *
 * @param {"fade"|"materialize"} variant - "materialize" adds a slight scale so
 *   glass surfaces read as arriving toward the viewer instead of just fading.
 */
export default function Reveal({ children, className, variant = "fade" }) {
    const scope = useRef(null);

    useGSAP(() => {
        const run = variant === "materialize" ? materializeReveal : fadeUpOnScroll;
        run(scope.current);
    }, { scope, dependencies: [variant] });

    return (
        <div ref={scope} className={className}>
            {children}
        </div>
    );
}
