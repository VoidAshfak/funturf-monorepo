import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { format } from "date-fns";
import { CalendarDays, Clock } from "lucide-react";
import Image from "next/image";
import AvatarGroup from "./AvatarGroup";

export default function EventCard({ event }) {

    const { id, title, description, sport_type, grounds, event_date, start_time, end_time, organizer_id, min_players, max_players, current_players, event_participants } = event;

    const isParticipantsFull = min_players === current_players;

    return (
        <Card className="border-0 transition-all duration-300 will-change-transform hover:shadow-lg hover:-translate-y-2">
            <CardHeader>
                <CardTitle className="bg-gradient-to-r from-black via-blue-500 to-green-500 text-transparent bg-clip-text">{title}</CardTitle>
                <CardDescription>{grounds.turfs.address_line_1}</CardDescription>
                <div className="flex justify-between items-center">
                    <AvatarGroup people={event_participants} />
                    <p className={`font-bold ${isParticipantsFull && 'text-red-500'}`}>{current_players}/<span className="font-normal">{min_players} </span>Joined</p>
                </div>
            </CardHeader>
            <CardContent className="h-28 flex flex-col justify-between">
                <p className="font-bold text-lg text-gray-700 line-clamp-2">{description}</p>
                <div className="flex gap-2 border-2 p-2 rounded-xl backdrop-blur-sm bg-gray-200/30">
                    <Clock className="w-4" />
                    <p>{format(start_time, 'hh:mm a')} - {format(end_time, 'hh:mm a')}</p>
                </div>
            </CardContent>
            <CardFooter className="flex justify-between">
                <Image
                    src={`/assets/icons/${sport_type.toLowerCase()}.png`}
                    alt={sport_type}
                    width={20}
                    height={20}
                />
                <div className="flex items-center gap-2">
                    <CalendarDays className="w-4" />
                    <p> {format(event_date, "MMMM dd, yyyy")} </p>
                </div>
            </CardFooter>
        </Card>
    )
}