"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

// Light/dark toggle. Guards against hydration mismatch by rendering a stable
// placeholder until mounted (theme is unknown on the server).
export default function ThemeToggle({ className = "" }) {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const isDark = resolvedTheme === "dark";

    return (
        <button
            type="button"
            aria-label="Toggle theme"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className={`inline-flex items-center justify-center h-9 w-9 rounded-full border border-border text-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer ${className}`}
        >
            {mounted ? (
                isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />
            ) : (
                <Sun className="h-5 w-5 opacity-0" />
            )}
        </button>
    );
}
