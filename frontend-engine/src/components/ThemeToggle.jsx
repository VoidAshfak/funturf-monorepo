"use client";

import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { prefersReducedMotion } from "@/lib/animations";

// Light/dark toggle. Guards against hydration mismatch by rendering a stable
// placeholder until mounted (theme is unknown on the server).
//
// The switch itself is driven by the View Transitions API: the browser snapshots
// the page before and after, and the page-fold keyframes in globals.css swing the
// old snapshot away around one edge to reveal the new theme underneath. See the
// "Theme toggle — page-fold transition" block there for the visual side.
export default function ThemeToggle({ className = "" }) {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const isDark = resolvedTheme === "dark";

    const toggleTheme = useCallback(() => {
        const next = isDark ? "light" : "dark";
        const root = document.documentElement;

        // Apply the theme and commit it to the DOM in one step. Called directly
        // for the plain path, and from inside the view transition for the
        // animated one — the class has to land synchronously either way, because
        // the browser snapshots the DOM the instant the transition callback
        // returns. A normal React state update would settle after that snapshot
        // and the fold would animate two identical frames.
        const applyTheme = () => {
            flushSync(() => setTheme(next));
            // next-themes writes the class from an effect. flushSync normally
            // flushes that too, but assert it here so the snapshot can never be
            // taken from a half-updated document.
            root.classList.toggle("dark", next === "dark");
            root.classList.toggle("light", next === "light");
        };

        // No View Transitions support (Firefox at time of writing), or the user
        // asked for reduced motion — a full-viewport 3D rotation is precisely
        // the kind of motion that setting opts out of. Swap instantly instead.
        if (
            typeof document.startViewTransition !== "function" ||
            prefersReducedMotion()
        ) {
            applyTheme();
            return;
        }

        // Which edge the page folds around. Dark and light fold off opposite
        // edges, so toggling back retraces the outbound path instead of
        // repeating it.
        root.dataset.themeFold = next === "dark" ? "to-dark" : "to-light";

        const transition = document.startViewTransition(applyTheme);

        // Clear the marker once the fold is done (or was skipped/interrupted),
        // so a stale value can never drive an unrelated transition later.
        transition.finished
            .catch(() => {})
            .finally(() => {
                delete root.dataset.themeFold;
            });
    }, [isDark, setTheme]);

    return (
        <button
            type="button"
            aria-label="Toggle theme"
            onClick={toggleTheme}
            className={`inline-flex items-center justify-center h-9 w-9 rounded-full border border-border text-foreground hover:bg-primary/10 hover:text-primary transition-all duration-200 active:scale-[0.92] active:duration-75 motion-reduce:transition-none motion-reduce:active:scale-100 cursor-pointer ${className}`}
        >
            {mounted ? (
                isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />
            ) : (
                <Sun className="h-5 w-5 opacity-0" />
            )}
        </button>
    );
}
