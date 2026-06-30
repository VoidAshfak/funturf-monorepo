"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap, staggerOnScroll } from "@/lib/animations";

// Client grid: server component fetches venues and passes the cards as children;
// this wraps them and runs the shared GSAP stagger-on-scroll recipe.
export default function VenueGrid({ children }) {
    const scope = useRef(null);

    useGSAP(() => {
        // Skip non-essential motion when the user opts out.
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) {
            gsap.set(".venue-card", { opacity: 1, y: 0 });
            return;
        }
        staggerOnScroll(".venue-card", scope.current);
    }, { scope });

    return (
        <div
            ref={scope}
            className="py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
            {children}
        </div>
    );
}
