"use client"

import { useEffect, useState } from "react"

export function useMediaQuery(query) {
    const [value, setValue] = useState(false)

    useEffect(() => {
        const mediaQuery = window.matchMedia(query);

        const handler = () => setValue(mediaQuery.matches);
        handler();

        mediaQuery.addEventListener("change", handler);
        return () => mediaQuery.removeEventListener("change", handler)
    }, [query])

    return value
}
