"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { staggerOnScroll } from "@/lib/animations";
import { cn } from "@/lib/utils";

/**
 * Client grid for server-rendered card lists: the server component fetches and
 * renders the cards as children, this wraps them and runs the shared
 * stagger-on-scroll recipe. Keeps the data layer on the server (design skill's
 * server/client split) while still animating.
 *
 * Replaces the venue-only version so venue and event grids reveal identically —
 * they sit next to each other on the landing page, and only one of them used to
 * animate.
 *
 * Children must carry `itemClass` for the stagger to find them.
 */
export default function CardGrid({ children, itemClass = "grid-card", className }) {
    const scope = useRef(null);

    useGSAP(
        () => {
            // Recipe no-ops under prefers-reduced-motion.
            staggerOnScroll(`.${itemClass}`, scope.current);
        },
        { scope, dependencies: [itemClass] }
    );

    return (
        <div
            ref={scope}
            className={cn(
                "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3",
                className
            )}
        >
            {children}
        </div>
    );
}
