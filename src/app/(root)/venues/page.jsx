import FilterVenueInput from "@/components/FilterVanueInput";
import { VenueCard } from "@/components/VenueCard";
import Image from "next/image";
import Link from "next/link";

export default async function AllVenues() {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/data/venues.json`);
    const venues = await response.json();

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

            <FilterVenueInput />

            <div className='grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 p-3 md:p-8'>
                {venues?.map((venue) => (
                    <Link
                        key={venue._id}
                        href={`/venues/${venue._id}`}
                    >
                        <VenueCard venue={venue} />
                    </Link>
                ))}
            </div>
        </div>
    )
}