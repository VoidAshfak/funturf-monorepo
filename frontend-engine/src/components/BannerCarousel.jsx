"use client";

import { useEffect, useState } from "react";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import HeroCards from "@/components/HeroCards";
import { cn } from "@/lib/utils";

// Spotlight turfs for the hero. Placeholder copy until this reads real /venues
// data — but keep it Bangladesh-local (Dhaka areas, ৳ BDT, 7-a-side football),
// since that is the market Funturf serves.
const SPOTLIGHTS = [
    {
        image: "/assets/images/hero-1.jpg",
        name: "Banani Turf Arena",
        location: "Banani, Dhaka",
        sport: "7-a-side Football",
        rating: "4.8",
        price: "৳2,500",
    },
    {
        image: "/assets/images/hero-2.jpg",
        name: "Bashundhara Sports Hub",
        location: "Bashundhara R/A, Dhaka",
        sport: "Box Cricket",
        rating: "4.6",
        price: "৳2,000",
    },
    {
        image: "/assets/images/hero-3.jpg",
        name: "Uttara Kickoff Turf",
        location: "Sector 7, Uttara, Dhaka",
        sport: "Futsal",
        rating: "4.9",
        price: "৳1,800",
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
        // `lg:mr-0` cancels the auto right margin so the card sits flush against
        // the hero's right rail instead of floating centred in its grid column —
        // otherwise the hero looks lopsided, left edge further out than the right.
        <div className="relative mx-auto w-full max-w-[400px] lg:mr-0">
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
