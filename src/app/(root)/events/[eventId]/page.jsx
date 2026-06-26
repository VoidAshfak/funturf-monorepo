import EventListWrapper from "@/components/EventListWrapper"
import PlayerItem from "@/components/PlayerItem"
import RulesAndComments from "@/components/RulesAndComments"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { getIndividualEventByEventId } from "@/utils/getData"
import { getLocationString } from "@/utils/utility-functions"
import { format } from "date-fns"
import { ArrowUpRight, Clock, MapPin, User2 } from "lucide-react"
import Link from "next/link"

export default async function EventDetails({ params }) {

    const { eventId } = await params;
    const { data: event } = await getIndividualEventByEventId(eventId);

    const { title, organizer, event_date, start_time, end_time, ground, venue_id, rules, max_players, min_players, current_players, participants } = event;

    return (
        <div className="w-[90%] mx-auto mt-10 pb-10">
            <div className="lg:grid grid-cols-3 gap-10">
                <div className="glass-card col-span-2 p-5 md:p-10 rounded-2xl">
                    {/* EVENT INFO */}
                    <div className="flex items-center justify-between mb-10">
                        <div className="space-y-2">
                            <h1 className="text-xl md:text-3xl font-bold md:font-extrabold text-foreground">{title}</h1>
                            <div className="flex items-center gap-2">
                                <User2 className="w-5 text-muted-foreground" />
                                <p className="text-muted-foreground">Organized by {`${organizer.first_name} ${organizer.last_name}`}</p>
                            </div>
                        </div>

                        <Link href="#">
                            <Avatar className="cursor-pointer h-14 w-14" >
                                <AvatarImage src={organizer.profile_picture_url} alt="@profile" />
                                <AvatarFallback>{`${organizer.first_name} ${organizer.last_name}`}</AvatarFallback>
                            </Avatar>
                        </Link>
                    </div>

                    <div className="flex items-center gap-2 mb-5">
                        <Clock className="w-5 text-muted-foreground" />
                        <div>
                            <p className="font-semibold md:font-bold md:text-2xl text-foreground"> {format(event_date, "EEEE, d MMMM yyyy")} </p>
                            <p> {format(start_time, 'hh:mm a')} - {format(end_time, 'hh:mm a')} </p>
                        </div>
                    </div>

                    <div className="md:flex items-center justify-between">
                        <div className="md:flex items-center gap-2">
                            <div className="flex gap-2">
                                <MapPin className="w-5 text-muted-foreground" />
                                <div>
                                    <p>{ground.name}, {ground.turf.name}</p>
                                    <p>{getLocationString(ground.turf.address_line_1)}</p>
                                </div>
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

                <div className="glass-card rounded-2xl p-5 mt-10 lg:m-0">
                    <h1 className="text-2xl font-bold">Players {current_players} / {min_players}</h1>
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
                    <h1 className="font-bold text-3xl text-foreground pb-4"> Similar Events </h1>
                    <Link
                        href="/events"
                        className="text-muted-foreground underline hover:text-primary cursor-pointer"
                    >See All Events
                    </Link>
                </div>
                <EventListWrapper />
            </div>
        </div>
    )
}