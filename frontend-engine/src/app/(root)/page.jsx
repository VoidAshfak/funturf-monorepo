import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import CityPulse from "@/sections/CityPulse";
import FeaturedEvents from "@/sections/FeaturedEvents";
import FeaturedTurfs from "@/sections/FeaturedTurfs";
import Hero from "@/sections/Hero";
import HowItWorks from "@/sections/HowItWorks";
import LiveTicker from "@/sections/LiveTicker";

export default function Home() {
    return (
        <>
            <Hero />

            {/*
                Sections share the hero's + navbar's rail (`app_rail`), so every
                left/right edge lines up down the whole page instead of each
                block picking its own margin.

                Vertical rhythm follows the DESIGN.md section scale: 48px on
                mobile, 64px on tablet, 80px on desktop — both between the
                sections and around the group.

                Order is the funnel: show what's available right now, explain how
                it works, then let them browse, and close on proof that the city
                is actually using it.
            */}
            <div className="app_rail space-y-12 py-12 md:space-y-16 md:py-16 lg:space-y-20 lg:py-20">
                <CityPulse />

                <HowItWorks />

                <FeaturedTurfs />

                <FeaturedEvents />

                {/*
                    Streamed: the ticker is the only section that awaits a network
                    read at the top level, so Suspense keeps it from holding back
                    the rest of the page.
                */}
                <Suspense
                    fallback={<Skeleton className="h-[420px] w-full rounded-[2rem]" />}
                >
                    <LiveTicker />
                </Suspense>
            </div>
        </>
    );
}
