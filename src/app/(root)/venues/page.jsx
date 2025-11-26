import FilterVenueInput from "@/components/FilterVanueInput";
import { VenueCard } from "@/components/VenueCard";
import { getAllVenues } from "@/utils/getData";
import Image from "next/image";
import Link from "next/link";

export default async function AllVenues() {
    const venues = await getAllVenues();

    return (
        <div className="relative">
            <div className="relative w-full h-72 md:h-80 lg:h-96 md:mb-16">
                <Image
                    src="/assets/images/bg2.jpg"
                    alt="venue-banner"
                    fill
                    priority
                    className="object-cover rounded-b-4xl"
                />
                <div className="absolute inset-0 bg-black/50 rounded-b-4xl"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <h1 className="text-white text-4xl font-bold">Choose Your Venue</h1>
                </div>
            </div>

            <div className="md:w-4/5 md:absolute mx-2 md:m-0 md:top-68 lg:top-84 md:left-18 lg:left-28 xl:left-36 shadow-2xl border rounded-2xl">
                <FilterVenueInput title="Find Venue" />
            </div>

            <div className='grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 p-3 md:p-8'>
                {venues.data?.map((venue) => (
                    <Link
                        key={venue.id}
                        href={`/venues/${venue.id}`}
                    >
                        <VenueCard venue={venue} />
                    </Link>
                ))}
            </div>
        </div>
    )
}