import EventListWrapper from "@/components/EventListWrapper";
import FilterVenueInput from "@/components/FilterVanueInput";
import Image from "next/image";
import CreateNewEvent from "./_components/CreateNewEvent";

export default function AllEvents() {
    return (
        <div className="w-[90%] mx-auto pb-10">
            <div className="relative h-72 rounded-2xl mt-10">
                <Image
                    src="/assets/images/banner1.jpg"
                    alt="banner"
                    fill
                    className="rounded-2xl"
                />

                <div className="absolute inset-0 bg-black/50 rounded-2xl"></div>

                <div className="absolute inset-0 flex flex-col justify-center gap-10 text-white px-10">
                    <h1 className="text-3xl md:text-5xl font-bold uppercase">Find Your Game</h1>
                    <CreateNewEvent />
                </div>
            </div>

            <div className="my-10">
                <FilterVenueInput title="Find Events" />
            </div>

            <EventListWrapper />

        </div>
    )
}