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

    const { name, description, location, slot, participants, playersRequired } = event;

    const isParticipantsFull = playersRequired === participants.length;

    return (
        <Card className="border-0 transition-all duration-300 will-change-transform hover:shadow-lg hover:-translate-y-2">
            <CardHeader>
                <CardTitle className="bg-gradient-to-r from-black via-blue-500 to-green-500 text-transparent bg-clip-text">{name}</CardTitle>
                <CardDescription>{location}</CardDescription>
                <div className="flex justify-between items-center">
                    <AvatarGroup people={participants} />
                    <p className={`font-bold ${isParticipantsFull && 'text-red-500'}`}>{participants.length}/<span className="font-normal">{playersRequired} </span>Joined</p>
                </div>
            </CardHeader>
            <CardContent className="h-28 flex flex-col justify-between">
                <p className="font-bold text-lg text-gray-700 line-clamp-2">{description}</p>
                <div className="flex gap-2 border-2 p-2 rounded-xl backdrop-blur-sm bg-gray-200/30">
                    <Clock className="w-4" />
                    <p>{slot.startTime} - {slot.endTime}</p>
                </div>
            </CardContent>
            <CardFooter className="flex justify-between">
                <Image
                    src={`/assets/icons/${event?.sport.toLowerCase()}.png`}
                    alt="football"
                    width={20}
                    height={20}
                />
                <div className="flex items-center gap-2">
                    <CalendarDays className="w-4" />
                    <p> {format(slot.date, "MMMM dd, yyyy")} </p>
                </div>
            </CardFooter>
        </Card>
    )
}