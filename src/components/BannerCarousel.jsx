"use client"

import {
    Carousel,
    CarouselContent,
    CarouselItem,
} from "@/components/ui/carousel"
import Autoplay from "embla-carousel-autoplay"
import HeroCards from "@/components/HeroCards"

export default function BannerCarousel() {
    return (
        <Carousel
            plugins={[
                Autoplay({
                    delay: 3000,
                }),
            ]}
            opts={{
                loop: true,
                align: "start"
            }}
        >
            <div className="absolute top-0 right-0 h-full  pointer-events-none z-10" />
            <CarouselContent>
                {Array.from({ length: 3 }).map((_, index) => (
                    <CarouselItem
                        className="basis-1/2 mx-2 px-4"
                        key={index}>
                        <div className="">
                            <HeroCards key={index} activeIndex={index} />
                        </div>
                    </CarouselItem>
                ))}
            </CarouselContent>
        </Carousel>
    )
}