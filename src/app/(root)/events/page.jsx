import EventCard from "@/components/EventCard";
import FilterVenueInput from "@/components/FilterVanueInput";
import { getAllEvents } from "@/utils/getData";
import Link from "next/link";

const AllEvents = async () => {
    const events = await getAllEvents();

    return (
        <div className="w-[90%] mx-auto">
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
