import { Clock, MapPin, ArrowUpRight, User2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import EventCard from "@/components/EventCard"
import events from "../../../../../public/data/events.json"
// import { getIndividualEvent } from "@/utils/getData"
import RulesAndComments from "@/components/RulesAndComments"
import PlayerItem from "@/components/PlayerItem"
import { format } from "date-fns"
import { Separator } from "@/components/ui/separator"

const EventDetails = async ({ params }) => {

    const { eventId } = await params

    const event = events.find(e => e._id === eventId)
    // const event = await getIndividualEvent(eventId);

    const { _id, name, sport, description, location, slot, organizer, participants, teams, venue, isBooked, booking, playersRequired, isPublic, rules } = event;

    return (
        <div className="w-[90%] mx-auto mt-10">
            <div className="lg:grid grid-cols-3 gap-10">
                <div className="bg-white col-span-2 border border-gray-300 p-5 md:p-10 rounded-xl">
                    {/* EVENT INFO */}
                    <div className="flex items-center justify-between mb-10">
                        <div className="space-y-2">
                            <h1 className="text-xl md:text-3xl font-bold md:font-extrabold text-gray-700">{name}</h1>
                            <div className="flex items-center gap-2">
                                <User2 className="w-5 text-gray-600" />
                                <p className="text-gray-600">Organized by {organizer}</p>
                            </div>
                        </div>

                        <Link href="#">
                            <Avatar className="cursor-pointer h-14 w-14" >
                                <AvatarImage src="https://github.com/shadcn.png" alt="@profile" />
                                <AvatarFallback>PF</AvatarFallback>
                            </Avatar>
                        </Link>
                    </div>

                    <div className="flex items-center gap-2 mb-5">
                        <Clock className="w-5 text-gray-600" />
                        <div>
                            <p className="font-semibold md:font-bold md:text-2xl text-gray-700"> {format(slot.date, "EEEE, d MMMM yyyy")} </p>
                            <p> {slot.startTime} - {slot.endTime} </p>
                        </div>
                    </div>

                    <div className="md:flex items-center justify-between">
                        <div className="md:flex items-center gap-2">
                            <div className="flex gap-2">
                                <MapPin className="w-5 text-gray-600" />
                                <p>{location}</p>
                            </div>
                            <Button
                                variant="outline"
                                className="cursor-pointer ml-7 mt-3 md:m-0"
                            >
                                View Map
                                <ArrowUpRight />
                            </Button>
                        </div>
                        <Button className="w-full md:w-40 lg:w-32 xl:w-40 mt-5 md:m-0">Join Request</Button>
                    </div>

                    <Separator className="my-10" />

                    {/* RULES AND COMMENTS */}
                    <RulesAndComments rules={rules} />
                </div>

                <div className="bg-white border rounded-2xl p-5 mt-10 lg:m-0">
                    <h1 className="text-2xl font-bold">Players {participants.length} / {playersRequired}</h1>
                    <div className="mt-7">
                        {participants.map((participant, index) => (
                            <PlayerItem key={participant} userId={participant} />
                        ))}
                    </div>
                </div>
            </div>

            {/* SIMILAR EVENTS */}
            <div className="mt-10">
                <div className="flex items-center justify-between">
                    <h1 className="font-bold text-3xl text-gray-700 pb-4"> Similar Events </h1>
                    <Link
                        href="/events"
                        className="text-gray-500 underline hover:text-green-500 cursor-pointer"
                    >See All Events
                    </Link>
                </div>
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'>
                    {events.map((event) => (
                        <Link
                            key={event._id}
                            href={`/events/${event._id}`}
                        >
                            <EventCard event={event} />
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default EventDetails
