import EventCard from "@/components/EventCard";
import FilterVenueInput from "@/components/FilterVanueInput";
import { Button } from "@/components/ui/button";
import { getAllEvents } from "@/utils/getData";
import Image from "next/image";
import Link from "next/link";

const AllEvents = async () => {
    const events = await getAllEvents();

    return (
        <div className="w-[90%] mx-auto">

            <div className="relative h-72 rounded-2xl mt-10">
                <Image
                    src="/assets/images/banner1.jpg"
                    alt="banner"
                    fill
                    className="rounded-2xl"
                />

                <div className="absolute inset-0 bg-black/50 rounded-2xl"></div>

                <div className="absolute inset-0 flex flex-col justify-center text-white px-10">
                    <h1 className="text-3xl md:text-5xl font-bold uppercase">Find Your Game</h1>
                    <Link href="/events/create" className="mt-12">
                        <Button className="text-white bg-green-500 hover:cursor-pointer hover:bg-green-700">Create New Event</Button>
                    </Link>
                </div>
            </div>


            <div className="my-10">
                <FilterVenueInput title="Find Events" />
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'>
                {events?.map(event => (
                    <Link
                        key={event._id}
                        href={`/events/${event._id}`}
                    >
                        <EventCard event={event} />
                    </Link>
                ))}
            </div>
        </div>
    )
}

export default AllEvents
