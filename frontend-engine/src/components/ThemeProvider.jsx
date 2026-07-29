"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Wraps next-themes with Funturf defaults: class strategy, dark-first.
//
// `nonce` is required by the CSP: next-themes injects a blocking INLINE script
// (the anti-flash script that sets the theme class before first paint), and our
// script-src has no 'unsafe-inline'. Without the nonce the browser blocks it and
// the page flashes light before hydration. The value is threaded down from
// `src/middleware.js` via the `x-nonce` request header — see `layout.js`.
export default function ThemeProvider({ children, nonce }) {
    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
            nonce={nonce}
        >
            {children}
        </NextThemesProvider>
    );
}
