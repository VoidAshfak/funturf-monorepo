import Image from "next/image";
import { getAllVenues } from "@/utils/getData";
import VenuesExplorer from "@/components/VenuesExplorer";

export default async function AllVenues() {
    const { data: venues = [] } = await getAllVenues();

    return (
        <div className="relative pb-16">
            {/* banner */}
            <div className="relative h-72 w-full md:h-80 lg:h-96">
                <Image
                    src="/assets/images/bg2.jpg"
                    alt="venue-banner"
                    fill
                    priority
                    className="rounded-b-4xl object-cover"
                />
                <div className="absolute inset-0 rounded-b-4xl bg-gradient-to-t from-black/70 via-black/40 to-black/30" />
                <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                    <h1 className="text-4xl font-extrabold text-white md:text-5xl">
                        Choose Your Venue
                    </h1>
                    <p className="mt-3 max-w-md text-sm text-white/80 md:text-base">
                        Find and book the best turfs near you — filter by sport, rating,
                        and more.
                    </p>
                </div>
            </div>

            {/* filter + grid */}
            <div className="mx-auto -mt-10 max-w-7xl px-4 md:px-8">
                {venues.length === 0 ? (
                    <div className="glass-neutral flex flex-col items-center gap-3 rounded-3xl border border-border p-12 text-center">
                        <h3 className="text-xl font-bold text-foreground">No venues yet</h3>
                        <p className="text-muted-foreground">
                            Check back soon — new turfs are added regularly.
                        </p>
                    </div>
                ) : (
                    <VenuesExplorer venues={venues} />
                )}
            </div>
        </div>
    );
}
