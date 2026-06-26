"use client"

import * as React from "react"
import { ImageOff } from "lucide-react"

import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel"
import { cn } from "@/lib/utils"

export function ImageCarousel({ images = [] }) {
    const [api, setApi] = React.useState(null)
    const [current, setCurrent] = React.useState(0)
    const [count, setCount] = React.useState(0)

    React.useEffect(() => {
        if (!api) return
        setCount(api.scrollSnapList().length)
        setCurrent(api.selectedScrollSnap())
        const onSelect = () => setCurrent(api.selectedScrollSnap())
        api.on("select", onSelect)
        return () => api.off("select", onSelect)
    }, [api])

    if (!images.length) {
        return (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl bg-muted text-muted-foreground">
                <ImageOff className="h-8 w-8" />
                <p className="text-sm">No images</p>
            </div>
        )
    }

    return (
        <Carousel setApi={setApi} className="group relative w-full">
            <CarouselContent className="-ml-0">
                {images.map((src, index) => (
                    <CarouselItem key={index} className="pl-0">
                        <div className="relative aspect-video w-full overflow-hidden rounded-2xl">
                            <img
                                src={src}
                                alt={`View ${index + 1}`}
                                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                            />
                            {/* depth + frame */}
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
                            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
                        </div>
                    </CarouselItem>
                ))}
            </CarouselContent>

            {/* slide counter */}
            <div className="glass-chip absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-bold text-white">
                {current + 1} / {count}
            </div>

            {/* glass nav arrows */}
            <CarouselPrevious className="left-3 h-10 w-10 border-white/20 bg-black/30 text-white backdrop-blur-md transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_20px_rgba(29,185,84,0.5)]" />
            <CarouselNext className="right-3 h-10 w-10 border-white/20 bg-black/30 text-white backdrop-blur-md transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_20px_rgba(29,185,84,0.5)]" />

            {/* dot indicators */}
            {count > 1 && (
                <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                    {Array.from({ length: count }).map((_, i) => (
                        <button
                            key={i}
                            aria-label={`Go to slide ${i + 1}`}
                            onClick={() => api?.scrollTo(i)}
                            className={cn(
                                "h-1.5 rounded-full transition-all duration-300",
                                i === current
                                    ? "w-6 bg-primary shadow-[0_0_10px_rgba(29,185,84,0.7)]"
                                    : "w-1.5 bg-white/50 hover:bg-white/80"
                            )}
                        />
                    ))}
                </div>
            )}
        </Carousel>
    )
}
