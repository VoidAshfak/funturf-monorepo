"use client";

import { useEffect, useMemo, useState } from "react";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import HeroCards from "@/components/HeroCards";
import { prefersReducedMotion } from "@/lib/animations";
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

    /*
        Autoplay is a slow, permanent loop right at the top of the page, so it
        needs two escape hatches:

        - `prefers-reduced-motion` turns it off entirely (an unstoppable looping
          animation is exactly what that setting is for).
        - `stopOnMouseEnter` + `stopOnFocusIn` hand control back the moment
          someone reaches for the card. It previously ran with
          `stopOnInteraction: false` and no pause condition, so a user reading a
          spotlight had it slide away under them with no way to hold it.
          `stopOnInteraction` stays false so it resumes on mouse-out rather than
          dying on the first hover.

        This component is dynamically imported with `ssr: false`, so reading the
        media query during render cannot desync from a server pass.
    */
    const plugins = useMemo(
        () =>
            prefersReducedMotion()
                ? []
                : [
                      Autoplay({
                          delay: 3500,
                          stopOnInteraction: false,
                          stopOnMouseEnter: true,
                          stopOnFocusIn: true,
                      }),
                  ],
        []
    );

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
                plugins={plugins}
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

            {/*
                Dot indicators. The visible bar stays 8px tall, but the button
                around it is a full 48px tap zone — the indicator used to be an
                8px target, well under the minimum for a touch control.
            */}
            <div className="mt-2 flex items-center justify-center">
                {SPOTLIGHTS.map((item, i) => (
                    <button
                        key={item.name}
                        type="button"
                        aria-label={`Show ${item.name}`}
                        aria-current={selected === i}
                        onClick={() => api?.scrollTo(i)}
                        className="group grid h-12 w-10 place-items-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-primary/35"
                    >
                        <span
                            className={cn(
                                "h-2 rounded-full transition-all duration-300 motion-reduce:transition-none",
                                selected === i
                                    ? "w-7 bg-primary"
                                    : "w-2 bg-muted-foreground/40 group-hover:bg-muted-foreground/70"
                            )}
                        />
                    </button>
                ))}
            </div>
        </div>
    );
}
