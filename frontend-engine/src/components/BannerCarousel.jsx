"use client";

import { useEffect, useState } from "react";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import HeroCards from "@/components/HeroCards";
import { cn } from "@/lib/utils";

// Spotlight turfs for the hero. Swap freely for real /venues data later.
const SPOTLIGHTS = [
    {
        image: "/assets/images/hero-1.jpg",
        name: "Green Valley Arena",
        location: "Andheri, Mumbai",
        sport: "5-a-side Football",
        rating: "4.8",
        price: "₹1200",
    },
    {
        image: "/assets/images/hero-2.jpg",
        name: "Skyline Box Cricket",
        location: "Baner, Pune",
        sport: "Box Cricket",
        rating: "4.6",
        price: "₹900",
    },
    {
        image: "/assets/images/hero-3.jpg",
        name: "Urban Kickturf",
        location: "Indiranagar, Bengaluru",
        sport: "Futsal",
        rating: "4.9",
        price: "₹1500",
    },
];

export default function BannerCarousel() {
    const [api, setApi] = useState(null);
    const [selected, setSelected] = useState(0);

    useEffect(() => {
        if (!api) return;
        const onSelect = () => setSelected(api.selectedScrollSnap());
        onSelect();
        api.on("select", onSelect);
        return () => api.off("select", onSelect);
    }, [api]);

    return (
        <div className="relative mx-auto w-full max-w-[400px]">
            <Carousel
                className="rounded-3xl"
                setApi={setApi}
                plugins={[Autoplay({ delay: 3500, stopOnInteraction: false })]}
                opts={{ loop: true, align: "center" }}
            >
                <CarouselContent className="ml-0">
                    {SPOTLIGHTS.map((item) => (
                        <CarouselItem key={item.name} className="pl-0">
                            <HeroCards item={item} />
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>

            {/* dot indicators */}
            <div className="mt-5 flex items-center justify-center gap-2">
                {SPOTLIGHTS.map((item, i) => (
                    <button
                        key={item.name}
                        type="button"
                        aria-label={`Go to ${item.name}`}
                        onClick={() => api?.scrollTo(i)}
                        className={cn(
                            "h-2 rounded-full transition-all duration-300",
                            selected === i
                                ? "w-7 bg-primary"
                                : "w-2 bg-muted-foreground/40 hover:bg-muted-foreground/70"
                        )}
                    />
                ))}
            </div>
        </div>
    );
}
