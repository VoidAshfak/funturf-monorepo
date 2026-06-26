"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Wraps next-themes with Funturf defaults: class strategy, dark-first.
export default function ThemeProvider({ children }) {
    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
        >
            {children}
        </NextThemesProvider>
    );
}
